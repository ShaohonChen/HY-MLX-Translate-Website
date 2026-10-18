# HY-MLX-Translator - Hy-MT2-1.8B Mac 本地翻译助手

[English Version](README_EN.md)

> 基于腾讯混元 Hy-MT2-1.8B，使用 MLX 在 Apple Silicon Mac 上本地部署的翻译网站。支持流式生成翻译结果，提供实时的翻译体验。
> ⚠️ 该项目99%代码来由vibe coding实现！可能存在一些bug或不完善的地方。请在使用时保持谨慎。

<p align="center">
  <img src="docs/hy-logo.png" alt="hy-logo" width="50%" />
</p>

由于Google Translate经常因为网络问题而无法正常工作，所以决定vibe coding一个本地的翻译助手。由于笔者本人用的Mac电脑，因此采用了[MLX-LM框架](https://github.com/MLX-LM/MLX-LM)作为推理引擎来加速Mac上运行LLM的速度。

模型使用[腾讯混元 Hy-MT2-1.8B](https://huggingface.co/tencent/Hy-MT2-1.8B)。它面向多语言翻译和复杂真实场景优化，支持翻译指令跟随；本项目按模型官方推荐的提示词与采样参数进行推理。

|  |
|:--:|
| ![翻译助手截图](docs/page.png) |
| *翻译助手界面（既然是生产力工具因此界面尽量的简洁）* |

## 近期更新

- 🚀 推理模型升级为 Hy-MT2-1.8B，并适配官方提示词、聊天模板和推荐采样参数
- ✨ 新增「消除回车 (Remove Line Breaks)」按钮，可一键删除输入文本中的所有换行符，解决复制粘贴时产生大量间断性回车的问题

## 项目特点

- 🍎 **Mac设备友好**：完全在本地运行，并且在苹果M系列芯片上速度较快
- 🌍 **多语言支持**：提供 Hy-MT2 README 所列的 38 个语言选项
- ⚡ **流式输出**：实时展示翻译结果，无需等待完整生成
- 📝 **参考翻译**：支持添加参考文本，提升翻译质量
- 📊 **性能统计**：实时显示 Tokens 数、总耗时、TTFT、TPOT 等性能指标

## 技术栈

- **后端**：Flask + Flask-CORS
- **框架**：MLX-LM（Apple Silicon 优化）
- **模型**：Hy-MT2-1.8B（腾讯混元）
- **前端**：原生 HTML + CSS + JavaScript

## 本地运行步骤

### 1. 安装依赖

```bash
pip install flask flask-cors mlx-lm
```

### 2. 下载模型

```bash
bash download_model.sh
```

脚本优先通过 Hugging Face 下载 `tencent/Hy-MT2-1.8B`，也支持回退到 ModelScope，并将模型保存到本地 `Hy-MT2-1.8B/` 目录。

### 3. 启动服务

```bash
python app.py
```

服务启动后，在浏览器中访问 `http://127.0.0.1:5000` 即可使用。

### 3.1 自定义 host 和 port

如需指定 host 或 port，可以使用命令行参数：

```bash
python app.py --host 0.0.0.0 --port 8080
```

参数说明：
- `--host`：指定监听地址（默认：`127.0.0.1`）
- `--port`：指定端口号（默认：`5000`）
- `--debug`：启用 Flask 调试模式（默认关闭）

## 对外暴露服务

默认情况下，服务只监听本地地址（`127.0.0.1`），只能在本机访问。如需对外暴露服务，使用 `--host 0.0.0.0` 参数：

```bash
python app.py --host 0.0.0.0 --port 5000
```

修改后，同一局域网内的设备可以通过 `http://<你的Mac的IP>:5000` 访问。

### ⚠️ 安全提醒

- 调试模式仅用于开发环境，生产环境请不要传入 `--debug`
- 对外暴露服务时请注意网络安全，建议在可信网络环境中使用
- 如需在公网访问，建议使用 Nginx 反向代理并配置 HTTPS

## API 接口说明

### 1. 获取支持的语言列表

```http
GET /api/languages
```

响应示例：
```json
{
  "model": "Hy-MT2-1.8B",
  "language_count": 38,
  "languages": {
    "Chinese": "中文",
    "English": "英语",
    ...
  },
  "quick_langs": [
    {"key": "Chinese", "label": "中文"},
    {"key": "English", "label": "英文"}
  ],
  "modes": [
    {"key": "default", "label": "普通翻译"},
    {"key": "terminology", "label": "术语翻译"},
    {"key": "style", "label": "风格翻译"},
    {"key": "personalization", "label": "个性化翻译"},
    {"key": "delimiters", "label": "保留分隔符"},
    {"key": "structured_data", "label": "结构化数据"},
    {"key": "structured_data_background", "label": "结构化数据+背景"}
  ]
}
```

### 2. 翻译接口（流式输出）

```http
POST /api/translate
Content-Type: application/json

{
  "text": "要翻译的文本",
  "target_language": "Chinese",
  "request_id": "1234567890",
  "refer_text": "参考文本（可选）",
  "mode": "default",
  "mode_options": {}
}
```

`mode` 支持 `default`、`terminology`、`style`、`personalization`、`delimiters`、
`structured_data` 和 `structured_data_background`。不同模式的附加参数放在
`mode_options` 中，例如 `style` 使用 `{"style": "正式、简洁"}`，结构化数据使用
`{"format_type": "JSON"}`。省略 `mode` 时默认为 `default`，现有只提交
`refer_text` 的调用仍然兼容。

响应使用 Server-Sent Events (SSE) 流式返回。
事件类型包括模型状态 `status`、译文片段 `text`、推理错误 `error` 和性能数据 `stats`。

### 3. 翻译接口（非流式输出）

如果调用方不需要流式结果，可以使用以下接口。接口会等待模型生成完成后返回一个 JSON 响应：

```http
POST /api/translate/sync
Content-Type: application/json

{
  "text": "Hello, world.",
  "target_language": "Chinese",
  "mode": "default",
  "mode_options": {}
}
```

响应示例：

```json
{
  "model": "Hy-MT2-1.8B",
  "mode": "default",
  "target_language": "Chinese",
  "translation": "你好，世界。",
  "stats": {
    "token_count": 5,
    "prompt_tokens": 28,
    "total_time": 1.2345
  }
}
```

### 4. 取消翻译

```http
POST /api/cancel
Content-Type: application/json

{
  "request_id": "1234567890"
}
```

## 致谢

- 模型：腾讯混元 [Hy-MT2-1.8B](https://huggingface.co/tencent/Hy-MT2-1.8B)
- 推理框架：[MLX-LM](https://github.com/ml-explore/mlx-lm)
- 代码：[豆包](https://www.doubao.com/chat/)

## 许可证

请参考 `Hy-MT2-1.8B/LICENSE.txt`。
