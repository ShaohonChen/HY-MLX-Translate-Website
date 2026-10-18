import argparse
import csv
import json
from pathlib import Path
import threading
import time
from uuid import uuid4

from flask import Flask, Response, jsonify, render_template, request, stream_with_context
from flask_cors import CORS

from prompt_modes import MODE_DEFINITIONS, build_prompt

app = Flask(__name__)
app.json.sort_keys = False
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
MODEL_NAME = "Hy-MT2-1.8B"
MODEL_PATH = BASE_DIR / MODEL_NAME
LANGUAGE_FILE = BASE_DIR / "language_support.csv"
MAX_TOKENS = 4096

model = None
tokenizer = None
model_load_lock = threading.Lock()
inference_lock = threading.Lock()
cancel_events_lock = threading.Lock()

# Hy-MT2-1.8B README 推荐的推理参数。
sampler = None
logits_processors = None
stream_generate = None

# 每个翻译请求对应一个线程安全的取消事件。
cancel_events = {}


def load_supported_languages(path):
    with path.open(newline="", encoding="utf-8") as language_file:
        reader = csv.DictReader(language_file)
        required_columns = {"language", "name_zh"}
        if not required_columns.issubset(reader.fieldnames or []):
            raise ValueError(f"语言配置缺少字段：{required_columns}")
        languages = {
            row["language"].strip(): row["name_zh"].strip()
            for row in reader
            if row["language"].strip() and row["name_zh"].strip()
        }
    if not languages:
        raise ValueError(f"语言配置为空：{path}")
    return languages


support_lang_map = load_supported_languages(LANGUAGE_FILE)

# 快捷键语言配置 - 这里统一维护
quick_langs = [
    {"key": "Chinese", "label": "中文"},
    {"key": "English", "label": "英文"}
]


def format_sse(event_type, content):
    payload = {"type": event_type, "content": content}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def load_model():
    global logits_processors, model, sampler, stream_generate, tokenizer
    if model is None:
        with model_load_lock:
            if model is None:
                if not MODEL_PATH.is_dir():
                    raise FileNotFoundError(
                        f"模型目录不存在：{MODEL_PATH}。请先运行 download_model.sh。"
                    )
                from mlx_lm import load, stream_generate as mlx_stream_generate
                from mlx_lm.sample_utils import make_logits_processors, make_sampler

                app.logger.info("正在从 %s 加载模型", MODEL_PATH)
                model, tokenizer = load(str(MODEL_PATH))
                sampler = make_sampler(temp=0.7, top_p=0.6, top_k=20)
                logits_processors = make_logits_processors(repetition_penalty=1.05)
                stream_generate = mlx_stream_generate
                app.logger.info("%s 加载成功", MODEL_NAME)


def parse_translation_request(data):
    """Validate a translation payload and build its model prompt."""
    data = data if isinstance(data, dict) else {}
    source_text = data.get('text', '')
    target_language = data.get('target_language', '')
    refer_text = data.get('refer_text', '')
    mode = data.get('mode', 'default')
    mode_options = data.get('mode_options', {})
    request_id = str(data.get('request_id') or uuid4())

    if not isinstance(source_text, str) or not source_text.strip():
        return None, ({'error': '请提供要翻译的文本'}, 400)

    if target_language not in support_lang_map:
        return None, ({'error': f'不支持的目标语言：{target_language}'}, 400)

    if not isinstance(refer_text, str):
        return None, ({'error': '参考文本必须是字符串'}, 400)

    if not isinstance(mode, str):
        return None, ({'error': '翻译模式必须是字符串'}, 400)

    if not isinstance(mode_options, dict):
        return None, ({'error': 'mode_options 必须是对象'}, 400)

    try:
        prompt = build_prompt(
            source_text,
            target_language,
            support_lang_map,
            mode=mode,
            mode_options=mode_options,
            refer_text=refer_text,
        )
    except ValueError as error:
        return None, ({'error': str(error)}, 400)

    return {
        'prompt': prompt,
        'mode': mode,
        'request_id': request_id,
        'target_language': target_language,
    }, None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/languages', methods=['GET'])
def get_languages():
    return jsonify({
        "model": MODEL_NAME,
        "language_count": len(support_lang_map),
        "languages": support_lang_map,
        "quick_langs": quick_langs,
        "modes": MODE_DEFINITIONS,
    })


@app.route('/api/translate', methods=['POST'])
def translate():
    params, error = parse_translation_request(request.get_json(silent=True))
    if error is not None:
        body, status = error
        return jsonify(body), status

    prompt = params['prompt']
    mode = params['mode']
    request_id = params['request_id']

    app.logger.debug(f"\n# ------\n# PROMPT: \n# ------\n{prompt}")

    cancel_event = threading.Event()
    with cancel_events_lock:
        cancel_events[request_id] = cancel_event

    def generate():
        start_time = None
        first_token_time = None
        token_count = 0
        token_times = []
        last_token_time = None
        prompt_token_count = 0
        inference_error = False

        try:
            if model is None:
                yield format_sse("status", "loading_model")
            load_model()

            messages = [{"role": "user", "content": prompt}]
            prompt_tokens = tokenizer.apply_chat_template(
                messages, add_generation_prompt=True,
            )
            prompt_token_count = len(prompt_tokens)
            response_text = ""
            yield format_sse("status", "waiting_inference")
            with inference_lock:
                yield format_sse("status", "translating")
                start_time = time.perf_counter()
                if not cancel_event.is_set():
                    for response in stream_generate(
                        model,
                        tokenizer,
                        prompt_tokens,
                        max_tokens=MAX_TOKENS,
                        sampler=sampler,
                        logits_processors=logits_processors,
                    ):
                        if cancel_event.is_set():
                            break

                        current_time = time.perf_counter()
                        if first_token_time is None:
                            first_token_time = current_time
                        token_count += 1
                        if last_token_time is not None:
                            token_times.append(current_time - last_token_time)
                        last_token_time = current_time
                        response_text += response.text
                        yield format_sse("text", response.text)
            app.logger.debug(f"\n# ------\n# RESPONSE: \n# ------\n{response_text}")
        except GeneratorExit:
            cancel_event.set()
            raise
        except Exception:
            inference_error = True
            app.logger.exception("翻译请求 %s 推理失败", request_id)
            yield format_sse("error", "模型推理失败，请检查服务日志")
        finally:
            with cancel_events_lock:
                if cancel_events.get(request_id) is cancel_event:
                    del cancel_events[request_id]

        end_time = time.perf_counter()
        total_time = end_time - start_time if start_time is not None else 0
        ttft = first_token_time - start_time if first_token_time else 0
        avg_tpot = sum(token_times) / len(token_times) if token_times else 0
        generation_time = total_time - ttft
        stats = {
            "token_count": token_count,
            "prompt_tokens": prompt_token_count,
            "complete_tokens": token_count,
            "total_time": round(total_time, 4),
            "ttft": round(ttft, 4),
            "avg_tpot": round(avg_tpot, 4),
            "prefill_speed": round(prompt_token_count / ttft, 2) if ttft > 0 else 0,
            "complete_speed": round(token_count / generation_time, 2) if generation_time > 0 else 0,
            "cancelled": cancel_event.is_set(),
            "error": inference_error,
        }
        yield format_sse("stats", stats)

    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }
    return Response(
        stream_with_context(generate()),
        content_type='text/event-stream; charset=utf-8',
        headers=headers,
    )


@app.route('/api/translate/sync', methods=['POST'])
def translate_sync():
    """Return one complete translation as a regular JSON response."""
    params, error = parse_translation_request(request.get_json(silent=True))
    if error is not None:
        body, status = error
        return jsonify(body), status

    start_time = time.perf_counter()
    prompt_tokens = 0
    token_count = 0
    response_text = ''

    try:
        load_model()
        messages = [{"role": "user", "content": params['prompt']}]
        prompt_tokens_list = tokenizer.apply_chat_template(
            messages, add_generation_prompt=True,
        )
        prompt_tokens = len(prompt_tokens_list)
        with inference_lock:
            for response in stream_generate(
                model,
                tokenizer,
                prompt_tokens_list,
                max_tokens=MAX_TOKENS,
                sampler=sampler,
                logits_processors=logits_processors,
            ):
                token_count += 1
                response_text += response.text
    except Exception:
        app.logger.exception("非流式翻译请求推理失败")
        return jsonify({'error': '模型推理失败，请检查服务日志'}), 500

    total_time = time.perf_counter() - start_time
    return jsonify({
        'model': MODEL_NAME,
        'mode': params['mode'],
        'target_language': params['target_language'],
        'translation': response_text,
        'stats': {
            'token_count': token_count,
            'prompt_tokens': prompt_tokens,
            'total_time': round(total_time, 4),
        },
    })


@app.route('/api/cancel', methods=['POST'])
def cancel_translate():
    data = request.get_json(silent=True) or {}
    request_id = data.get('request_id', '')
    with cancel_events_lock:
        cancel_event = cancel_events.get(str(request_id))
    if cancel_event is not None:
        cancel_event.set()
        return jsonify({'success': True, 'message': '翻译已取消'})
    return jsonify({'success': False, 'message': '未找到该翻译请求'}), 404


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='HY-MT Translator')
    parser.add_argument('--host', default='127.0.0.1', help='Host address to bind (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=5000, help='Port number to bind (default: 5000)')
    parser.add_argument('--debug', action='store_true', help='Enable Flask debug mode')
    args = parser.parse_args()
    app.run(host=args.host, port=args.port, debug=args.debug, threaded=True)
