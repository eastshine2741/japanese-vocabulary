#!/usr/bin/env bash
# Creates a git worktree and:
#   1. Copies gitignored config files (.env, local.properties)
#   2. Symlinks project-level Gradle/Kotlin caches to avoid re-sync
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
  "app/local.properties"
  "backend/local.properties"
  "app/google-services.json"
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

# ── 3. Symlink project-level Gradle & Kotlin caches ──────────────────────────
# ~/.gradle/caches  (dependencies)   - already global, no action needed
# app/.gradle/      (file hashes, execution history, config cache)
# app/.kotlin/      (incremental compilation metadata)
#
# NOTE: Do NOT run parallel Gradle builds across worktrees when using symlinks.
#       If you need parallel builds, remove the symlinks and let Gradle rebuild.

echo ""
echo "Symlinking project-level Gradle/Kotlin caches..."
CACHE_DIRS=(
  "app/.gradle"
  "app/.kotlin"
)

linked=0
for rel in "${CACHE_DIRS[@]}"; do
  src="$REPO_ROOT/$rel"
  dst="$WORKTREE_PATH/$rel"
  if [[ -d "$src" ]]; then
    # Remove empty dir that 'git worktree add' may have created
    [[ -d "$dst" && -z "$(ls -A "$dst")" ]] && rmdir "$dst"
    if [[ ! -e "$dst" ]]; then
      ln -s "$src" "$dst"
      echo "  linked : $rel -> $src"
      ((++linked))
    else
      echo "  skip   : $rel (already exists)"
    fi
  fi
done
[[ $linked -eq 0 ]] && echo "  (no cache dirs found)"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "Done!"
echo ""
echo "  cd $WORKTREE_PATH"
echo ""
echo "WARNING: app/.gradle and app/.kotlin are symlinked to the main worktree."
echo "         Avoid running Gradle in both worktrees simultaneously to prevent lock conflicts."
echo "         To run builds in parallel, remove the symlinks first:"
echo "           rm $WORKTREE_PATH/app/.gradle $WORKTREE_PATH/app/.kotlin"
