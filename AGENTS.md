# HY-MLX-Translator 开发说明

## 项目定位

- 这是一个小型开源项目：Flask + 原生 HTML/CSS/JavaScript + MLX-LM。
- 服务主要运行在 Apple Silicon Mac，并通过内网提供翻译能力。
- 不要为了保持“企业级”结构而引入认证、数据库、前端构建系统或复杂分层。

## 关键约束

- 模型提示词必须遵循 `Hy-MT2-1.8B/README.md` 的官方任务示例。
- 翻译模式集中在 `prompt_modes.py`，不要在路由中复制提示词字符串。
- 网页模式固定为 `default`、`terminology`、`style`、`personalization`、`delimiters`、`structured_data` 和 `background`；切勿把背景信息误实现为结构化数据模式。
- 高级模式的必填信息必须由网页的专用控件采集并放入 `mode_options`，不要恢复旧的 `refer_text` 或“添加参考”功能。
- `/api/translate` 的 SSE 事件类型 `status`、`text`、`error`、`stats` 需要保持兼容。
- `/api/translate/sync` 仅提供普通翻译的完整 JSON 译文；不要让它退化为 SSE 响应，也不要为它增加高级模式参数。
- `mode` 和 `mode_options` 仅供网页内部的 `/api/translate` 流式请求使用；对外 API 文档只描述 `/api/translate/sync`。
- 不要修改模型权重目录，也不要重新加入一次性兼容性测试脚本。

## 项目结构

- `app.py`：Flask 初始化、API 路由、模型加载和流式响应。
- `prompt_modes.py`：翻译模式元数据和提示词构造。
- `templates/index.html`：页面结构。
- `static/css/app.css`：页面样式。
- `static/js/app.js`：页面状态、模式控件和翻译请求。
- `static/js/text-matching.js`：段落/句子切分和双栏高亮。

## 修改与验证

- 优先使用现有依赖和简单函数，避免无必要的新依赖。
- 修改 Python 后至少运行 `python3 -m py_compile app.py prompt_modes.py`。
- 修改前端后检查 `/api/languages`、普通翻译、取消翻译、普通模式以外至少一种模式，以及模式所需字段的必填提示。
- API 字段或行为发生变化时，同步更新 `README.md` 和 `README_EN.md`。
