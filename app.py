from flask import Flask, request, jsonify, render_template, stream_with_context, Response
from flask_cors import CORS
from mlx_lm import load, stream_generate
import threading
import time
import json
import argparse

app = Flask(__name__)
CORS(app)

model_path = "HY-MT1.5-1.8B"
model = None
tokenizer = None
lock = threading.Lock()

# 用于取消翻译的变量
cancel_flags = {}

support_lang_map = {
    "Chinese": "中文",
    "English": "英语",
    "French": "法语",
    "Portuguese": "葡萄牙语",
    "Spanish": "西班牙语",
    "Japanese": "日语",
    "Turkish": "土耳其语",
    "Russian": "俄语",
    "Arabic": "阿拉伯语",
    "Korean": "韩语",
    "Thai": "泰语",
    "Italian": "意大利语",
    "German": "德语",
    "Vietnamese": "越南语",
    "Malay": "马来语",
    "Indonesian": "印尼语",
    "Filipino": "菲律宾语",
    "Hindi": "印地语",
    "Traditional Chinese": "繁体中文",
    "Polish": "波兰语",
    "Czech": "捷克语",
    "Dutch": "荷兰语",
    "Khmer": "高棉语",
    "Burmese": "缅甸语",
    "Persian": "波斯语",
    "Gujarati": "古吉拉特语",
    "Urdu": "乌尔都语",
    "Telugu": "泰卢固语",
    "Marathi": "马拉地语",
    "Hebrew": "希伯来语",
    "Bengali": "孟加拉语",
    "Tamil": "泰米尔语",
    "Ukrainian": "乌克兰语",
    "Tibetan": "藏语",
    "Kazakh": "哈萨克语",
    "Mongolian": "蒙古语",
    "Uyghur": "维吾尔语",
    "Cantonese": "粤语"
}

# 快捷键语言配置 - 这里统一维护
quick_langs = [
    {"key": "Chinese", "label": "中文"},
    {"key": "English", "label": "英文"}
]

def load_model():
    global model, tokenizer
    if model is None:
        with lock:
            if model is None:
                print("Loading model...")
                model, tokenizer = load(model_path)
                print("Model loaded successfully")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/languages', methods=['GET'])
def get_languages():
    return jsonify({
        "languages": support_lang_map,
        "quick_langs": quick_langs
    })

@app.route('/api/translate', methods=['POST'])
def translate():
    data = request.get_json()
    source_text = data.get('text', '')
    target_language = data.get('target_language', '')
    request_id = data.get('request_id', str(int(time.time())))
    refer_text = data.get('refer_text', '')
    if not source_text:
        return jsonify({'error': '请提供要翻译的文本'}), 400

    if target_language not in support_lang_map:
        return jsonify({'error': f'不支持的目标语言：{target_language}'}), 400

    load_model()
    if refer_text:
        if target_language == "Chinese":
            prompt = f"""{refer_text}\n\n参考上面的信息，把下面的文本翻译成{target_language}，注意不需要翻译上文，也不要额外解释：\n\n{source_text}"""
        else:
            prompt = f"""{refer_text}\nRefer to the information above. Translate the following segment into {target_language}. Do not translate the preceding text, and do not provide any additional explanation.\n\n{source_text}"""
    else:
        if target_language == "Chinese":
            prompt = f"""将以下文本翻译为中文，注意只需要输出翻译后的结果，不要额外解释：\n\n{source_text}"""
        else:
            prompt = f"""Translate the following segment into {target_language}，without additional explanation.\n\n{source_text}"""
        
    app.logger.debug(f"\n# ------\n# PROMPT: \n# ------\n{prompt}")

    messages = [{"role": "user", "content": prompt}]
    prompt_tokens = tokenizer.apply_chat_template(
        messages, add_generation_prompt=False,
    )

    # 初始化取消标志
    cancel_flags[request_id] = False

    def generate():
        start_time = time.time()
        first_token_time = None
        token_count = 0
        token_times = []
        last_token_time = None

        try:
            response_text = ""
            for response in stream_generate(model, tokenizer, prompt_tokens, max_tokens=131072):
                # 检查是否需要取消
                if cancel_flags.get(request_id, False):
                    break

                current_time = time.time()
                if first_token_time is None:
                    first_token_time = current_time
                token_count += 1
                if last_token_time is not None:
                    token_times.append(current_time - last_token_time)
                last_token_time = current_time
                # 使用 JSON 安全编码文本
                data = {
                    "type": "text",
                    "content": response.text
                }
                response_text += response.text
                yield f"data: {json.dumps(data)}\n\n"
            app.logger.debug(f"\n# ------\n# RESPONSE: \n# ------\n{response_text}")
        finally:
            end_time = time.time()
            total_time = end_time - start_time
            ttft = first_token_time - start_time if first_token_time else 0
            avg_tpot = sum(token_times) / len(token_times) if token_times else 0

            prompt_token_count = len(prompt_tokens)
            stats = {
                "token_count": token_count,
                "prompt_tokens": prompt_token_count,
                "complete_tokens": token_count,
                "total_time": round(total_time, 4),
                "ttft": round(ttft, 4),
                "avg_tpot": round(avg_tpot, 4),
                "prefill_speed": round(prompt_token_count / ttft, 2) if ttft > 0 else 0,
                "complete_speed": round(token_count / (total_time - ttft), 2) if (total_time - ttft) > 0 else 0
            }
            data = {
                "type": "stats",
                "content": stats
            }
            yield f"data: {json.dumps(data)}\n\n"
            
            # 清理取消标志
            if request_id in cancel_flags:
                del cancel_flags[request_id]

    return Response(stream_with_context(generate()), mimetype='text/event-stream')


@app.route('/api/cancel', methods=['POST'])
def cancel_translate():
    data = request.get_json()
    request_id = data.get('request_id', '')
    if request_id in cancel_flags:
        cancel_flags[request_id] = True
        return jsonify({'success': True, 'message': '翻译已取消'})
    return jsonify({'success': False, 'message': '未找到该翻译请求'}), 404

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='HY-MT Translator')
    parser.add_argument('--host', default='127.0.0.1', help='Host address to bind (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=5000, help='Port number to bind (default: 5000)')
    args = parser.parse_args()
    app.run(host=args.host, port=args.port, debug=True)