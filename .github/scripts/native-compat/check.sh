#!/usr/bin/env bash
# Usage: check.sh <base-ref> [head-ref=HEAD]
# <head-ref> 커밋의 app-rn 네이티브 fingerprint 가 <base-ref>(출시된 네이티브 태그)와 같은지 본다.
# 같으면 그 바이너리에 OTA 로 얹을 수 있다. 다르면 바뀐 입력을 출력하고 실패한다.
set -euo pipefail

BASE_REF="${1:?usage: check.sh <base-ref> [head-ref]}"
HEAD_REF="${2:-HEAD}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
APP="$REPO_ROOT/app-rn"
WORK="$(mktemp -d)"
trap 'for d in base head; do git -C "$REPO_ROOT" worktree remove --force "$WORK/$d" >/dev/null 2>&1 || true; done; rm -rf "$WORK"' EXIT

# 두 쪽 다 같은 env 로 app.config.js 를 평가해야 config 차이가 env 잡음이 되지 않는다.
export BUILD_ENV=prod EAS_UPDATE_CHANNEL=production DEPLOY_NS=main
unset NATIVE_RUNTIME_VERSION BUILD_VERSION_NAME BUILD_NUMBER BUILD_VERSION_CODE

# 둘 다 커밋된 상태의 깨끗한 worktree 에서 잰다. 로컬에만 있는 android/, ios/, google-services.json
# 같은 gitignore 파일이 섞이면 같은 네이티브여도 해시가 달라진다.
fingerprint_at() {
  local ref="$1" dir="$WORK/$2"
  git -C "$REPO_ROOT" worktree add --detach "$dir" "$ref" >/dev/null
  # 옛 커밋에는 fingerprint 설정이 없거나 다를 수 있어 지금 설정으로 맞춘다.
  cp "$APP/fingerprint.config.js" "$dir/app-rn/fingerprint.config.js"
  (cd "$dir/app-rn" \
    && npm ci --ignore-scripts --no-audit --no-fund --loglevel=error >/dev/null \
    && npx patch-package >/dev/null \
    && npx @expo/fingerprint . > "$WORK/$2.json")
}

fingerprint_at "$BASE_REF" base
fingerprint_at "$HEAD_REF" head

BASE_HASH="$(node -p "require('$WORK/base.json').hash")"
HEAD_HASH="$(node -p "require('$WORK/head.json').hash")"
echo "base ($BASE_REF): $BASE_HASH"
echo "head ($HEAD_REF): $HEAD_HASH"

if [[ "$BASE_HASH" == "$HEAD_HASH" ]]; then
  echo "네이티브 변경 없음 — $BASE_REF 바이너리에 OTA 가능"
  exit 0
fi

echo "::error::$BASE_REF 이후 네이티브 입력이 바뀌어 OTA 불가. 바뀐 입력:"
FP_MODULE="$(cd "$WORK/head/app-rn" && node -p "require.resolve(\"@expo/fingerprint\")")" node -e '
  const { diffFingerprints } = require(process.env.FP_MODULE);
  const [base, head] = process.argv.slice(1).map((f) => require(f));
  for (const d of diffFingerprints(base, head)) {
    const src = d.addedSource ?? d.removedSource ?? d.afterSource;
    console.log(`  ${d.op.padEnd(7)} ${src.filePath ?? src.id}`);
  }' "$WORK/base.json" "$WORK/head.json"
echo "새 네이티브 의존 없이 내보내려면 해당 PR 을 release 브랜치로 cherry-pick 할 것 (merge commit 은 -m 1)."
exit 1
