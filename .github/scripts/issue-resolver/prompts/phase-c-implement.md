## Phase C: Implement and Create PR

You are processing a single issue with label `status:approved`. Your job is to implement the approved plan, commit, push, and create a PR.

- If the working tree is dirty (uncommitted changes in the main repo), skip and exit with a warning comment on the issue.

### Steps

1. Read ALL comments to get the latest approved plan:
```
gh issue view ISSUE_NUMBER --json title,body,comments
```

2. Update label to implementing:
```
gh issue edit ISSUE_NUMBER --remove-label "status:approved" --add-label "status:implementing"
```

3. Decide a branch name that describes what the work does (NOT the issue number).
   - Format: `<type>/<short-description>` where type is `feat`, `fix`, `refactor`, `chore`, etc.
   - Use lowercase kebab-case for the description, max 4-5 words.
   - Examples: `feat/song-search-pagination`, `fix/flashcard-review-crash`, `refactor/lyric-sync-logic`
   - Do NOT use `fix/issue-NN` or `fix-issue-NN` format.

4. Create a worktree using the existing script (it also copies gitignored config files like .env):
```
./create-worktree.sh BRANCH_NAME
```
   The worktree is created at `../japanese-vocabulary-WORKTREE_DIR/` (branch name with `/` replaced by `-`).

5. Implement changes in the worktree directory, following the approved plan and CLAUDE.md conventions.

   [IMPORTANT] If the change involves UI design, update the Pencil design file using the Pencil CLI (`--prompt` mode).
   Pass the UI change description directly — Pencil's internal AI agent handles the design decisions.

   ```bash
   pencil --in ../japanese-vocabulary-WORKTREE_DIR/app-rn/japanese-vocabulary.pen \
          --out ../japanese-vocabulary-WORKTREE_DIR/app-rn/japanese-vocabulary.pen \
          --prompt "description of UI change from the approved plan"
   ```

   - Pass the approved plan's UI description as-is. Do NOT over-specify layout/color/spacing details — Pencil's agent handles those.
   - Use a 600000ms timeout (generation takes 1-5 minutes).
   - The .pen file changes must be included in the PR commit.

6. Commit, push, and create PR:
```
cd ../japanese-vocabulary-WORKTREE_DIR
git add -A
git commit -m "description of changes"
git push -u origin BRANCH_NAME
gh pr create --title "Short descriptive title" --body "Fixes #ISSUE_NUMBER

## Summary
- ...

## Test plan
- ..."
```

7. Comment the PR URL on the issue.

8. Return to repo and update label:
```
cd /home/eastshine/IdeaProjects/japanese-vocabulary
gh issue edit ISSUE_NUMBER --remove-label "status:implementing" --add-label "status:pr-created"
```
