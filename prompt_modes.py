"""Prompt builders for the translation modes supported by Hy-MT2."""


MODE_DEFINITIONS = [
    {
        "key": "default",
        "label": "普通翻译",
        "description": "仅翻译文本，不额外解释",
    },
    {
        "key": "terminology",
        "label": "术语翻译",
        "description": "参考术语对照进行翻译",
    },
    {
        "key": "style",
        "label": "风格翻译",
        "description": "按指定风格进行翻译",
    },
    {
        "key": "personalization",
        "label": "个性化翻译",
        "description": "按用户偏好进行翻译",
    },
    {
        "key": "delimiters",
        "label": "保留分隔符",
        "description": "保持分隔符数量和位置",
    },
    {
        "key": "structured_data",
        "label": "结构化数据",
        "description": "保持数据结构，只翻译可见文本",
    },
    {
        "key": "structured_data_background",
        "label": "结构化数据+背景",
        "description": "结合背景信息并保持数据结构",
    },
]

SUPPORTED_MODE_KEYS = {item["key"] for item in MODE_DEFINITIONS}


def _text_option(options, key):
    value = options.get(key, "")
    return value.strip() if isinstance(value, str) else ""


def _default_prompt(source_text, target_language, target_name, is_chinese):
    if is_chinese:
        return (
            f"将以下文本翻译为{target_name}，"
            "注意只需要输出翻译后的结果，不要额外解释：\n\n"
            f"{source_text}"
        )
    return (
        f"Translate the following text into {target_language}. "
        "Note that you should only output the translated result without any "
        f"additional explanation:\n\n{source_text}"
    )


def build_prompt(
    source_text,
    target_language,
    support_lang_map,
    mode="default",
    mode_options=None,
    refer_text="",
):
    """Build a Hy-MT2 prompt using one of the official task patterns."""
    if mode not in SUPPORTED_MODE_KEYS:
        raise ValueError(f"不支持的翻译模式：{mode}")

    options = mode_options if isinstance(mode_options, dict) else {}
    target_name = support_lang_map[target_language]
    is_chinese = target_language == "Chinese"
    reference = refer_text.strip() if isinstance(refer_text, str) else ""

    if mode == "default" and not reference and not _text_option(options, "background"):
        return _default_prompt(source_text, target_language, target_name, is_chinese)

    if mode in {"default", "background"}:
        background = _text_option(options, "background") or reference
        if is_chinese:
            return (
                f"【背景信息】\n{background}\n\n"
                f"请结合背景信息将以下文本翻译为{target_name}。\n\n"
                f"【待翻译文本】\n{source_text}"
            )
        return (
            f"[Background Information]\n{background}\n\n"
            f"Please translate the following text into {target_language}, "
            "taking the provided background information into consideration.\n\n"
            f"[Source Text]\n{source_text}"
        )

    if mode == "terminology":
        terminology = _text_option(options, "terminology") or reference
        if is_chinese:
            return (
                f"参考下面的翻译：\n{terminology}\n\n"
                f"将以下文本翻译为{target_name}，注意只需要输出翻译后的结果，"
                f"不要额外解释：\n\n{source_text}"
            )
        return (
            f"Reference the following translations:\n{terminology}\n\n"
            f"Translate the following text into {target_language}. "
            "Note that you must ONLY output the translated result without any "
            f"additional explanation:\n\n{source_text}"
        )

    if mode == "style":
        style = _text_option(options, "style") or reference or "自然、准确"
        if is_chinese:
            return (
                f"请将以下文本翻译为{target_name}。\n"
                f"注意翻译的风格要严格符合【{style}】\n\n{source_text}"
            )
        return (
            f"Please translate the following text into {target_language}. "
            f"Note that the translation style must strictly conform to [{style}]:\n\n"
            f"{source_text}"
        )

    if mode == "personalization":
        preferences = _text_option(options, "preferences") or reference
        if is_chinese:
            return (
                f"【待翻译文本】\n{source_text}\n\n"
                f"【翻译任务】\n1、{preferences}\n"
                f"2、将【待翻译文本】翻译为{target_name}。"
            )
        return (
            f"[Source Text]\n{source_text}\n\n"
            f"[Translation Tasks]\n1. {preferences}\n"
            f"2. Translate the [Source Text] into {target_language}."
        )

    if mode == "delimiters":
        if is_chinese:
            return (
                f"请将以下文本准确翻译为{target_name}。\n"
                "你必须在译文中保留等量的分隔符，绝对不可遗漏、转义或翻译该符号，"
                f"并注意分隔符的位置。\n\n{source_text}"
            )
        return (
            f"Please accurately translate the following text into {target_language}.\n"
            "You must retain the exact same number of delimiters in the translation. "
            "Strictly do not omit, escape, or translate these symbols, and pay close "
            f"attention to their placement.\n\n{source_text}"
        )

    format_type = _text_option(options, "format_type") or "structured data"
    background = _text_option(options, "background")
    if mode == "structured_data_background" and not background:
        background = reference
    if is_chinese:
        background_section = (
            f"\n# 背景信息\n{background}\n" if background else ""
        )
        return (
            f"# 任务目标\n将下方文本中的 {format_type} 格式数据翻译为{target_name}。"
            f"{background_section}\n"
            "# 严格约束\n"
            "1. 结构锁定：保持原有数据结构、缩进和层级完全不变。\n"
            "2. 选择性翻译：仅翻译面向用户展示的可见文本内容。\n"
            "3. 禁止修改：严禁翻译或更改代码标签、键名、变量占位符或代码属性。\n\n"
            f"# 数据输入\n{source_text}"
        )
    background_section = (
        f"\n### Background Information\n{background}\n" if background else ""
    )
    return (
        f"### Task\nTranslate the user-facing text within the following {format_type} data "
        f"into {target_language}.\n\n"
        f"{background_section}"
        "### Strict Rules\n"
        "1. Structure Preservation: Preserve the original data structure, nesting, "
        "hierarchy, and indentation exactly.\n"
        "2. Selective Translation: Translate ONLY visible, user-facing text.\n"
        "3. Strict Non-Translation: Never alter code tags, keys, properties, or "
        "variable placeholders.\n\n"
        f"### Source Data\n{source_text}"
    )
