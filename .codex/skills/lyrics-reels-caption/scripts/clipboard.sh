#!/usr/bin/env bash
# stdin 텍스트를 시스템 클립보드에 복사한다. Wayland/X11/macOS 순으로 시도.
set -euo pipefail

if command -v wl-copy >/dev/null 2>&1 && [ -n "${WAYLAND_DISPLAY:-}" ]; then
  wl-copy && echo "copied via wl-copy" && exit 0
fi
if command -v xclip >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
  xclip -selection clipboard && echo "copied via xclip" && exit 0
fi
if command -v xsel >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
  xsel --clipboard --input && echo "copied via xsel" && exit 0
fi
if command -v pbcopy >/dev/null 2>&1; then
  pbcopy && echo "copied via pbcopy" && exit 0
fi

echo "no clipboard tool found (wl-copy / xclip / xsel / pbcopy)" >&2
exit 1
