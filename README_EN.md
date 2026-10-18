# HY-MLX-Translator - Hy-MT2-1.8B Local Translation Assistant for Mac

> A local translation website for Apple Silicon Macs, powered by Tencent Hunyuan Hy-MT2-1.8B and MLX. It streams translation results for a responsive translation experience.
> ⚠️ 99% of this project's code is implemented by vibe coding! There may be some bugs or imperfections. Please use with caution.

<p align="center">
  <img src="docs/hy-logo.png" alt="hy-logo" width="50%" />
</p>

Since Google Translate often doesn't work properly due to network issues, I decided to create a local translation assistant. Since I use a Mac computer, I adopted the [MLX-LM framework](https://github.com/MLX-LM/MLX-LM) as the inference engine to accelerate LLM running speed on Mac.

The project uses [Tencent Hunyuan Hy-MT2-1.8B](https://huggingface.co/tencent/Hy-MT2-1.8B), a multilingual translation model optimized for complex real-world scenarios and translation instruction following. Inference follows the model's official prompt format and recommended sampling parameters.

|  |
|:--:|
| ![Translation Assistant Screenshot](docs/page.png) |
| *Translation Assistant Interface (Since it's a productivity tool, the interface is kept as simple as possible)* |

## Recent Updates

- 🚀 Upgraded the inference model to Hy-MT2-1.8B with its official prompts, chat template, and recommended sampling parameters
- ✨ Added "Remove Line Breaks" button to instantly remove all line breaks from input text, solving the issue of excessive intermittent line breaks when copying and pasting content

## Project Features

- 🍎 **Mac-friendly**: Runs completely locally and is fast on Apple M-series chips
- 🌍 **Multi-language support**: Provides all 38 language options listed in the Hy-MT2 README
- ⚡ **Streaming output**: Displays translation results in real-time without waiting for complete generation
- 📝 **Reference translation**: Supports adding reference text to improve translation quality
- 📊 **Performance statistics**: Real-time display of Tokens count, total time, TTFT, TPOT and other performance indicators

## Technology Stack

- **Backend**: Flask + Flask-CORS
- **Framework**: MLX-LM (Apple Silicon optimized)
- **Model**: Hy-MT2-1.8B (Tencent Hunyuan)
- **Frontend**: Native HTML + CSS + JavaScript

## Local Running Steps

### 1. Install Dependencies

```bash
pip install flask flask-cors mlx-lm
```

### 2. Download Model

```bash
bash download_model.sh
```

The script downloads `tencent/Hy-MT2-1.8B` from Hugging Face when available, falls back to ModelScope, and saves it to `Hy-MT2-1.8B/`.

### 3. Start Service

```bash
python app.py
```

After the service starts, access `http://127.0.0.1:5000` in your browser to use it.

### 3.1 Customize host and port

To specify host or port, you can use command-line parameters:

```bash
python app.py --host 0.0.0.0 --port 8080
```

Parameter description:
- `--host`: Specify listening address (default: `127.0.0.1`)
- `--port`: Specify port number (default: `5000`)
- `--debug`: Enable Flask debug mode (disabled by default)

## Exposing Service Externally

By default, the service only listens to the local address (`127.0.0.1`) and can only be accessed on the local machine. To expose the service externally, use the `--host 0.0.0.0` parameter:

```bash
python app.py --host 0.0.0.0 --port 5000
```

After modification, devices within the same local area network can access it through `http://<your Mac's IP>:5000`.

### ⚠️ Security Reminder

- Debug mode is intended for development only; do not pass `--debug` in production
- Please pay attention to network security when exposing services externally, it is recommended to use in a trusted network environment
- If you need to access it on the public network, it is recommended to use Nginx reverse proxy and configure HTTPS

## API Interface Description

### 1. Get Supported Language List

```http
GET /api/languages
```

Response example:
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

### 2. Translation Interface (Streaming Output)

```http
POST /api/translate
Content-Type: application/json

{
  "text": "Text to be translated",
  "target_language": "Chinese",
  "request_id": "1234567890",
  "refer_text": "Reference text (optional)",
  "mode": "default",
  "mode_options": {}
}
```

`mode` supports `default`, `terminology`, `style`, `personalization`, `delimiters`,
`structured_data`, and `structured_data_background`. Mode-specific values are sent
inside `mode_options`, for example `{"style": "formal and concise"}` or
`{"format_type": "JSON"}`. If `mode` is omitted, it defaults to `default`; requests
that only send `refer_text` remain compatible.

The response uses Server-Sent Events (SSE) to return streaming data.
Event types include model state (`status`), translated text chunks (`text`), inference errors (`error`), and performance data (`stats`).

### 3. Translation Interface (Non-Streaming Output)

Call this endpoint when a complete JSON response is preferred over streaming output:

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

Response example:

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

### 4. Cancel Translation

```http
POST /api/cancel
Content-Type: application/json

{
  "request_id": "1234567890"
}
```

## Acknowledgments

- Model: Tencent Hunyuan [Hy-MT2-1.8B](https://huggingface.co/tencent/Hy-MT2-1.8B)
- Inference framework: [MLX-LM](https://github.com/ml-explore/mlx-lm)
- Code: [Doubao](https://www.doubao.com/chat/)

## License

See `Hy-MT2-1.8B/LICENSE.txt`.
