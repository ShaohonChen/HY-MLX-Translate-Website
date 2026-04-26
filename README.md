# HY-MLX-Translator - 混元1.8B模型Mac本地翻译助手

[English Version](README_EN.md)

> 基于腾讯混元（Hunyuan）1.8B模型，使用 MLX 在 Apple Silicon Mac 上本地部署的翻译网站。支持流式生成翻译结果，提供实时的翻译体验。
> ⚠️ 该项目99%代码来由vibe coding实现！可能存在一些bug或不完善的地方。请在使用时保持谨慎。

![hy-logo](docs/hy-logo.png)

由于Google Translate经常因为网络问题而无法正常工作，所以决定vibe coding一个本地的翻译助手。由于笔者本人用的Mac电脑，因此采用了[MLX-LM框架](https://github.com/MLX-LM/MLX-LM)作为推理引擎来加速Mac上运行LLM的速度。

模型选择上，笔者选择了[腾讯混元1.8B模型](https://huggingface.co/tencent/HY-MT1.5-1.8B)，因为其在Huggingface上宣传其翻译效果非常优秀，原文是“同规模模型中达到业界领先水平，超越大多数商业翻译 API”（笔者自己没有和其他同参数的模型做对比）。体感上该模型在论文翻译场景上能提供高质量的翻译结果。

|  |
|:--:|
| ![翻译助手截图](docs/page.png) |
| *翻译助手界面（既然是生产力工具因此界面尽量的简洁）* |

## 项目特点

- 🍎 **Mac设备友好**：完全在本地运行，并且在苹果M系列芯片上速度较快
- 🌍 **多语言支持**：支持 33 种语言的翻译（当然主要靠混元牛逼）
- ⚡ **流式输出**：实时展示翻译结果，无需等待完整生成
- 📝 **参考翻译**：支持添加参考文本，提升翻译质量
- 📊 **性能统计**：实时显示 Tokens 数、总耗时、TTFT、TPOT 等性能指标

## 技术栈

- **后端**：Flask + Flask-CORS
- **框架**：MLX-LM（Apple Silicon 优化）
- **模型**：HY-MT1.5-1.8B（腾讯混元）
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

该脚本会从 HuggingFace 下载 `tencent/HY-MT1.5-1.8B` 模型到本地 `HY-MT1.5-1.8B/` 目录。

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

## 对外暴露服务

默认情况下，服务只监听本地地址（`127.0.0.1`），只能在本机访问。如需对外暴露服务，使用 `--host 0.0.0.0` 参数：

```bash
python app.py --host 0.0.0.0 --port 5000
```

修改后，同一局域网内的设备可以通过 `http://<你的Mac的IP>:5000` 访问。

### ⚠️ 安全提醒

- `debug=True` 仅用于开发环境，生产环境请设置为 `False`
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
  "languages": {
    "Chinese": "中文",
    "English": "英语",
    ...
  },
  "quick_langs": [
    {"key": "Chinese", "label": "中文"},
    {"key": "English", "label": "英文"}
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
  "refer_text": "参考文本（可选）"
}
```

响应使用 Server-Sent Events (SSE) 流式返回。

### 3. 取消翻译

```http
POST /api/cancel
Content-Type: application/json

{
  "request_id": "1234567890"
}
```

## 致谢

- 模型：腾讯混元[HY-MT1.5-1.8B](https://huggingface.co/tencent/HY-MT1.5-1.8B)
- 推理框架：[MLX-LM](https://github.com/ml-explore/mlx-lm)
- 代码：[豆包](https://www.doubao.com/chat/)

## 许可证

请参考 HY-MT1.5-1.8B 模型的 License.txt 文件。
