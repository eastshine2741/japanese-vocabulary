## Phase A: Analyze and Plan

You are processing a single issue with label `status:new`. Your job is to analyze the issue body, investigate the codebase, and post a structured implementation plan.

### Steps

1. Read the issue body to understand the problem/request:
```
gh issue view ISSUE_NUMBER --json title,body,comments
```

2. Analyze the codebase with Grep, Read, Glob to find relevant files and root causes.

3. If the issue is UI-related, inspect the relevant screen in the .pen file using the Pencil CLI:
   ```bash
   # List all top-level screens
   echo 'batch_get({ patterns: [{ type: "frame" }], readDepth: 0, searchDepth: 1 })
   exit()' | pencil interactive -i app-rn/japanese-vocabulary.pen -o /dev/null

   # Read details of a matched screen
   echo 'batch_get({ nodeIds: ["<matched node id>"], readDepth: 2 })
   exit()' | pencil interactive -i app-rn/japanese-vocabulary.pen -o /dev/null
   ```
   Do NOT read the entire document.

4. Post a structured implementation plan as an issue comment:

```
## Implementation Plan

### Analysis
- (root cause or feature requirements)

### Files to modify
- `path/to/file.ts:LINE` — what to change

### Changes
1. (numbered steps)

### Impact
- (what else might be affected)

### UI Draft (if design changes are needed)
(ASCII art mockup of the proposed UI change)
```

5. Update labels:
```
gh issue edit ISSUE_NUMBER --remove-label "status:new" --add-label "status:plan-ready"
```
