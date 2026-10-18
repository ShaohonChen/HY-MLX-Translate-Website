import csv
from pathlib import Path

from mlx_lm import load, stream_generate
from mlx_lm.sample_utils import make_logits_processors, make_sampler

# 翻译模型地址
base_dir = Path(__file__).resolve().parent
model_path = base_dir / "Hy-MT2-1.8B"

# 从与网站相同的配置读取支持语言，避免示例和后端列表不一致。
with (base_dir / "language_support.csv").open(newline="", encoding="utf-8") as language_file:
    support_lang_map = {
        row["language"]: row["name_zh"]
        for row in csv.DictReader(language_file)
    }
# 待翻译的文本 & 源语言 & 目标语言
source_language = "Chinese"
target_language = "English"
source_text = "今天天气真好。"

# Hy-MT2 支持的源语言和目标语言均须使用上表中的完整英文名称。
for language in (source_language, target_language):
    if language not in support_lang_map:
        raise ValueError(f"不支持的语言：{language}")

# Hy-MT2 没有默认 system prompt；按 README 使用中英文两种推荐提示词。
if source_language in {"Chinese", "Traditional Chinese", "Cantonese"}:
    prompt = (
        f"将以下文本翻译为{support_lang_map[target_language]}，"
        "注意只需要输出翻译后的结果，不要额外解释：\n\n"
        f"{source_text}"
    )
else:
    prompt = (
        f"Translate the following text into {target_language}. "
        "Note that you should only output the translated result without any "
        f"additional explanation:\n\n{source_text}"
    )

# 加载本地 Hy-MT2 模型和分词器。
model, tokenizer = load(str(model_path))

# 转换为tokens
messages = [{"role": "user", "content": prompt}]
prompt = tokenizer.apply_chat_template(
    messages, add_generation_prompt=True,
)

# Hy-MT2-1.8B README 推荐的采样参数。
sampler = make_sampler(temp=0.7, top_p=0.6, top_k=20)
logits_processors = make_logits_processors(repetition_penalty=1.05)

# 流式生成
for response in stream_generate(
    model,
    tokenizer,
    prompt,
    max_tokens=4096,
    sampler=sampler,
    logits_processors=logits_processors,
):
    print(response.text, end="", flush=True)
print()
