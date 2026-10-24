#!/usr/bin/env bash
# CTranslate2 dlopens CUDA 12 cuBLAS/cuDNN at run time and only looks on LD_LIBRARY_PATH, which has to be set before the process starts.
set -euo pipefail
cd "$(dirname "$0")"
SITE="$(.venv/bin/python -c 'import site; print(site.getsitepackages()[0])')"
export LD_LIBRARY_PATH="$SITE/nvidia/cublas/lib:$SITE/nvidia/cudnn/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec .venv/bin/python -m lyric_sync_agent "$@"
