from mlx_lm import load, stream_generate

# 翻译模型地址
model_path = "HY-MT1.5-1.8B"
# 支持的语言
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
# 加载模型和分词器
model, tokenizer = load(model_path)

# 待翻译的文本 & 源语言 & 目标语言
target_language = "English"
source_text = "告诉我什么是苹果"

# 转换为提示词模版
assert target_language in support_lang_map.keys(), ValueError(f"不支持的源语言或目标语言：{target_language}")
prompt=""
if target_language in "Chinese":
    prompt = f"""将以下文本翻译为{target_language}，注意只需要输出翻译后的结果，不要额外解释：\n\n{source_text}"""
else:
    prompt = f"""Translate the following segment into {target_language}, without additional explanation.\n\n{source_text}"""

# 转换为tokens
messages = [{"role": "user", "content": prompt}]
prompt = tokenizer.apply_chat_template(
    messages, add_generation_prompt=False,
)

# 流式生成
for response in stream_generate(model, tokenizer, prompt, max_tokens=512):
    print(response.text, end="", flush=True)
print()