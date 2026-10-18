#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
model_dir="${script_dir}/Hy-MT2-1.8B"

if command -v hf >/dev/null 2>&1; then
    hf download tencent/Hy-MT2-1.8B --local-dir "${model_dir}"
elif command -v huggingface-cli >/dev/null 2>&1; then
    huggingface-cli download tencent/Hy-MT2-1.8B --local-dir "${model_dir}"
elif command -v modelscope >/dev/null 2>&1; then
    modelscope download --model Tencent-Hunyuan/Hy-MT2-1.8B --local_dir "${model_dir}"
else
    echo "错误：请先安装 huggingface_hub 或 modelscope。" >&2
    exit 1
fi
