#!/usr/bin/env bash
# Creates a git worktree and copies gitignored config files (.env, local.properties)
#
# Usage: ./create-worktree.sh <branch-name> [worktree-path]
# Example:
#   ./create-worktree.sh feature/new-screen
#   ./create-worktree.sh feature/new-screen ../japanese-vocabulary-feature

set -euo pipefail

BRANCH="${1:?Usage: $0 <branch-name> [worktree-path]}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
DEFAULT_PATH="${REPO_ROOT}/../$(basename "$REPO_ROOT")-${BRANCH//\//-}"
WORKTREE_PATH="${2:-$DEFAULT_PATH}"

# ── 1. Create worktree ────────────────────────────────────────────────────────
echo "Creating worktree: $WORKTREE_PATH  (branch: $BRANCH)"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git worktree add "$WORKTREE_PATH" "$BRANCH"
else
  git worktree add -b "$BRANCH" "$WORKTREE_PATH"
fi

# ── 2. Copy gitignored config files ──────────────────────────────────────────
IGNORED_FILES=(
  "backend/src/main/resources/application-local.yml"
  ".env"
  "backend/local.properties"
  "app-rn/.env"
  "app-rn/release.keystore"
)

echo ""
echo "Copying gitignored config files..."
copied=0
for rel in "${IGNORED_FILES[@]}"; do
  src="$REPO_ROOT/$rel"
  dst="$WORKTREE_PATH/$rel"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    echo "  copied : $rel"
    ((++copied))
  fi
done
[[ $copied -eq 0 ]] && echo "  (none found)"

# ── 3. Symlink Sudachi dictionary ─────────────────────────────────────────────
SUDACHI_DIC="backend/src/main/resources/sudachi/system_core.dic"
if [[ -f "$REPO_ROOT/$SUDACHI_DIC" ]]; then
  mkdir -p "$WORKTREE_PATH/$(dirname "$SUDACHI_DIC")"
  ln -s "$REPO_ROOT/$SUDACHI_DIC" "$WORKTREE_PATH/$SUDACHI_DIC"
  echo ""
  echo "Symlinked Sudachi dictionary"
  echo "  $SUDACHI_DIC -> $REPO_ROOT/$SUDACHI_DIC"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "Done!"
echo ""
echo "  cd $WORKTREE_PATH"
