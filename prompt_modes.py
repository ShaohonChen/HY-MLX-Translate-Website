"""Prompt builders for the translation modes documented by Hy-MT2."""


MODE_DEFINITIONS = [
    {
        "key": "default",
        "label": "普通翻译",
        "description": "直接翻译原文，只输出译文，不添加解释。",
    },
    {
        "key": "terminology",
        "label": "术语翻译",
        "description": "提供原文与译文的术语对照，统一专有名词和固定表达。",
    },
    {
        "key": "style",
        "label": "风格翻译",
        "description": "指定译文必须遵循的语气、文体或使用场景。",
    },
    {
        "key": "personalization",
        "label": "个性化翻译",
        "description": "逐条填写翻译偏好，例如措辞、称谓和专名处理方式。",
    },
    {
        "key": "delimiters",
        "label": "保留分隔符",
        "description": "要求译文保留原文中分隔符的数量、符号和位置。",
    },
    {
        "key": "structured_data",
        "label": "结构化数据",
        "description": "保持数据结构、键名和占位符不变，只翻译可见文本。",
    },
    {
        "key": "background",
        "label": "背景信息",
        "description": "结合给定背景理解原文，适合需要上下文的翻译。",
    },
]

SUPPORTED_MODE_KEYS = {item["key"] for item in MODE_DEFINITIONS}


def _text_option(options, key):
    value = options.get(key, "")
    return value.strip() if isinstance(value, str) else ""


def _string_list_option(options, key):
    value = options.get(key, [])
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _terminology_option(options):
    entries = options.get("terminology", [])
    if not isinstance(entries, list):
        return []

    normalized = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        source = entry.get("source", "")
        target = entry.get("target", "")
        if not isinstance(source, str) or not isinstance(target, str):
            continue
        source = source.strip()
        target = target.strip()
        if source and target:
            normalized.append((source, target))
    return normalized


def _default_prompt(source_text, target_language, target_name, is_chinese):
    if is_chinese:
        return (
            f"将以下文本翻译为 {target_name}，"
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
):
    """Build and validate a prompt using the official Hy-MT2 task patterns."""
    if mode not in SUPPORTED_MODE_KEYS:
        raise ValueError(f"不支持的翻译模式：{mode}")

    options = mode_options if isinstance(mode_options, dict) else {}
    target_name = support_lang_map[target_language]
    is_chinese = target_language == "Chinese"

    if mode == "default":
        return _default_prompt(source_text, target_language, target_name, is_chinese)

    if mode == "terminology":
        terminology = _terminology_option(options)
        if not terminology:
            raise ValueError("术语翻译模式至少需要一组完整的术语对照")
        if is_chinese:
            entries = "\n".join(
                f"{source} 翻译成 {target}" for source, target in terminology
            )
            return (
                f"参考下面的翻译：\n{entries}\n\n"
                f"将以下文本翻译为 {target_name}，注意只需要输出翻译后的结果，"
                f"不要额外解释：\n\n{source_text}"
            )
        entries = "\n".join(
            f"{source} translates to {target}" for source, target in terminology
        )
        return (
            f"Reference the following translations:\n{entries}\n\n"
            f"Translate the following text into {target_language}. "
            "Note that you must ONLY output the translated result without any "
            f"additional explanation:\n\n{source_text}"
        )

    if mode == "style":
        style = _text_option(options, "style")
        if not style:
            raise ValueError("风格翻译模式需要填写目标风格")
        if is_chinese:
            return (
                f"请将以下文本翻译为 {target_name}。\n"
                f"注意翻译的风格要严格符合【{style}】\n\n{source_text}"
            )
        return (
            f"Please translate the following text into {target_language}. "
            f"Note that the translation style must strictly conform to [{style}]:\n\n"
            f"{source_text}"
        )

    if mode == "personalization":
        preferences = _string_list_option(options, "preferences")
        if not preferences:
            raise ValueError("个性化翻译模式至少需要填写一条翻译偏好")
        if is_chinese:
            tasks = "\n".join(
                f"{index}、{preference}"
                for index, preference in enumerate(preferences, start=1)
            )
            return (
                f"【待翻译文本】\n{source_text}\n\n"
                f"【翻译任务】\n{tasks}\n"
                f"{len(preferences) + 1}、将【待翻译文本】翻译为 {target_name}。"
            )
        tasks = "\n".join(
            f"{index}. {preference}"
            for index, preference in enumerate(preferences, start=1)
        )
        return (
            f"[Source Text]\n{source_text}\n\n"
            f"[Translation Tasks]\n{tasks}\n"
            f"{len(preferences) + 1}. Translate the [Source Text] into "
            f"{target_language}."
        )

    if mode == "delimiters":
        if is_chinese:
            return (
                f"请将以下文本准确翻译为 {target_name}。\n"
                "你必须在译文中保留等量的分隔符，绝对不可遗漏、转义或翻译该符号，"
                f"并注意分隔符的位置。\n\n{source_text}"
            )
        return (
            f"Please accurately translate the following text into {target_language}.\n"
            "You must retain the exact same number of delimiters in the translation. "
            "Strictly do not omit, escape, or translate these symbols, and pay close "
            f"attention to their placement.\n\n{source_text}"
        )

    if mode == "structured_data":
        format_type = _text_option(options, "format_type")
        if not format_type:
            raise ValueError("结构化数据模式需要填写数据格式")
        if is_chinese:
            return (
                f"# 任务目标\n将下方文本中的 {format_type} 格式数据翻译为 {target_name}。\n\n"
                "# 严格约束\n"
                f"1. 结构锁定：绝对保持原有的 {format_type} 数据结构、缩进和层级完全不变。\n"
                "2. 选择性翻译：仅翻译面向用户展示的可见文本内容。\n"
                "3. 禁止修改：严禁翻译或更改任何代码标签、键名 (Key)、变量占位符"
                "（如 {{var}}、${var}、%s、%d 等）或代码属性。\n\n"
                f"# 数据输入\n{source_text}"
            )
        return (
            f"### Task\nTranslate the user-facing text within the following {format_type} "
            f"data into {target_language}.\n\n"
            "### Strict Rules\n"
            f"1. Structure Preservation: You MUST preserve the original {format_type} "
            "data structure, nesting, hierarchy, and indentation exactly as they are.\n"
            "2. Selective Translation: Translate ONLY the visible, user-facing text "
            "content/values.\n"
            "3. Strict Non-Translation: NEVER translate or alter code tags, keys, "
            "properties, object names, or variable placeholders. Leave them exactly "
            "in their original English/code form.\n\n"
            f"### Source Data\n{source_text}"
        )

    background = _text_option(options, "background")
    if not background:
        raise ValueError("背景信息模式需要填写背景信息")
    if is_chinese:
        return (
            f"【背景信息】\n{background}\n\n"
            f"请结合背景信息将以下文本翻译为 {target_name}。\n\n"
            f"【待翻译文本】\n{source_text}"
        )
    return (
        f"[Background Information]\n{background}\n\n"
        f"Please translate the following text into {target_language}, taking the "
        "provided background information into consideration.\n\n"
        f"[Source Text]\n{source_text}"
    )
