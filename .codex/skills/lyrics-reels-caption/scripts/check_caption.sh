#!/usr/bin/env bash
# 캡션 파일이 인스타그램 제한(본문 2,200자, 해시태그 30개)을 지키는지 확인한다.
# 초과 시 종료 코드 1. 첫 줄 미리보기(릴스 약 55자 / 피드 약 125자)도 함께 출력.
#   check_caption.sh <caption.txt>
set -euo pipefail
FILE="${1:?usage: check_caption.sh <caption.txt>}"

python3 - "$FILE" <<'PY'
import sys, re
text = open(sys.argv[1], encoding="utf-8").read().strip("\n")
MAX_CHARS, MAX_TAGS, SAFE_CHARS = 2200, 30, 2000

n = len(text)                        # 코드 포인트 기준 (인스타 카운터와 같음)
tags = re.findall(r"(?<!\S)#\S+", text)
first_line = text.split("\n", 1)[0]

print(f"chars     : {n} / {MAX_CHARS}  (여유 {MAX_CHARS - n})")
print(f"hashtags  : {len(tags)} / {MAX_TAGS}")
print(f"first line: {len(first_line)}자  → {first_line}")
print(f"reels 55  : {text[:55].replace(chr(10), '⏎')}")
print(f"feed 125  : {text[:125].replace(chr(10), '⏎')}")

ok = True
if n > MAX_CHARS:
    print(f"FAIL: 본문 {n - MAX_CHARS}자 초과"); ok = False
elif n > SAFE_CHARS:
    print(f"WARN: {SAFE_CHARS}자 넘음. 인스타 앱에서 줄바꿈·이모지 처리로 카운트가 조금 달라질 수 있으니 줄이는 게 안전")
if len(tags) > MAX_TAGS:
    print(f"FAIL: 해시태그 {len(tags) - MAX_TAGS}개 초과"); ok = False
print("OK" if ok else "NG")
sys.exit(0 if ok else 1)
PY
