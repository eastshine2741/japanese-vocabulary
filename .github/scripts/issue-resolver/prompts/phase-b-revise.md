## Phase B: Revise Plan Based on Feedback

You are processing a single issue with label `status:feedback`. Your job is to read all comments, understand the feedback, re-analyze the codebase, and post a revised plan.

### Steps

1. Read ALL comments to understand the full conversation and latest feedback:
```
gh issue view ISSUE_NUMBER --json title,body,comments
```

2. Re-analyze the codebase based on the feedback.

3. Post a revised plan as a new comment (mark it as v2, v3, etc.) with a `### Feedback addressed` section explaining what changed.

4. Update labels:
```
gh issue edit ISSUE_NUMBER --remove-label "status:feedback" --add-label "status:plan-ready"
```
