#!/usr/bin/env bash
# Sets up the venv and a systemd user service that starts the agent whenever this user session starts.
set -euo pipefail
cd "$(dirname "$0")"
AGENT_DIR="$(pwd)"
ENV_FILE="$HOME/.config/kotonoha/lyric-sync-agent.env"
UNIT_DIR="$HOME/.config/systemd/user"

command -v uv >/dev/null || { echo "uv 가 필요하다: https://docs.astral.sh/uv/" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg 가 필요하다 (yt-dlp 가 wav 로 바꿀 때 쓴다)" >&2; exit 1; }
# yt-dlp 는 JS 런타임 없이 YouTube 를 푸는 경로를 deprecated 했다. 지금은 받아지지만 언제든 막힐 수 있다.
command -v deno >/dev/null || echo "Warning: deno 가 없다. yt-dlp 의 YouTube 추출이 막히면 deno 를 깐다" >&2

uv venv -p 3.12 .venv
uv pip install -p .venv -r requirements.txt

mkdir -p "$(dirname "$ENV_FILE")" "$UNIT_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<ENV
KOTONOHA_ADMIN_API=https://kotonoha.eastshine.dev/admin/api
LYRIC_SYNC_AGENT_TOKEN=
POLL_SECONDS=300
WHISPER_MODEL=large-v3
DEVICE=cuda
ENV
  chmod 600 "$ENV_FILE"
  echo "$ENV_FILE 에 LYRIC_SYNC_AGENT_TOKEN 을 채운다 (.env.prod 의 ADMIN_LYRIC_SYNC_AGENT_TOKEN 과 같은 값)"
fi

sed "s|@AGENT_DIR@|$AGENT_DIR|" lyric-sync-agent.service > "$UNIT_DIR/lyric-sync-agent.service"
systemctl --user daemon-reload
echo "켜기: systemctl --user enable --now lyric-sync-agent"
echo "로그: journalctl --user -u lyric-sync-agent -f"
