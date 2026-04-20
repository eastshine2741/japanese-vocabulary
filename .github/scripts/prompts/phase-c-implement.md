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

3. Create a worktree using the existing script (it also copies gitignored config files like .env):
```
./create-worktree.sh fix/issue-ISSUE_NUMBER
```
   The worktree is created at `../japanese-vocabulary-fix-issue-ISSUE_NUMBER/` by default.

4. Implement changes in the worktree directory, following the approved plan and CLAUDE.md conventions.
   [IMPORTANT] If the change involves UI design, update the Pencil design file (`app-rn/japanese-vocabulary.pen`) using Pencil MCP tools (batch_design) and let Pencil reflect the UI change to code. The .pen file changes must be included in the PR commit.

5. Commit, push, and create PR:
```
cd ../japanese-vocabulary-fix-issue-ISSUE_NUMBER
git add -A
git commit -m "description of changes"
git push -u origin fix/issue-ISSUE_NUMBER
gh pr create --title "Fix #ISSUE_NUMBER: title" --body "Fixes #ISSUE_NUMBER

## Summary
- ...

## Test plan
- ..."
```

6. Comment the PR URL on the issue.

7. Return to repo and update label:
```
cd /home/eastshine/IdeaProjects/japanese-vocabulary
gh issue edit ISSUE_NUMBER --remove-label "status:implementing" --add-label "status:pr-created"
```
