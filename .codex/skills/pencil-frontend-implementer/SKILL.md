---
name: pencil-frontend-implementer
description: Implement frontend UI from a frontend implementation capsule and referenced Pencil MCP frames. Use when a subagent must code a screen or component by reading the capsule as an index, inspecting Pencil frames/prompts directly, following existing frontend patterns, and avoiding invented UX.
---

# Pencil Frontend Implementer

Use this as the implementation workflow for a frontend subagent that receives a capsule from the master agent.

## Ground Rules

- Do not implement from the capsule alone.
- Treat Pencil frames and frame prompts as the visual and interaction source of truth.
- If Pencil MCP connection or referenced frame read fails, stop immediately. Do not retry, do not infer from the capsule alone, and do not edit code; report the failure to the user.
- Treat the capsule as a routing index: scope, frame ids, state mapping, interaction mapping, code targets.
- Implement only the capsule's scope. Do not redesign adjacent UI or add unrequested UX.
- If capsule and Pencil disagree, follow Pencil for UI details and report the discrepancy.
- If Pencil lacks behavior that the capsule requires, implement the capsule behavior and report that the Pencil context is incomplete.
- Follow repo-local instructions, existing component patterns, state management conventions, navigation structure, and styling conventions.

## Workflow

1. Read the capsule completely.
2. Read repository instructions that apply to the target frontend area.
3. Use Pencil MCP to inspect every referenced frame and relevant frame prompt. If this fails, stop immediately and report the Pencil MCP failure without additional attempts.
4. Inspect the referenced existing code paths before editing.
5. Build a small implementation plan from the capsule mappings:
   - component/file targets
   - UI states
   - user actions and state transitions
   - data inputs
6. Implement only the mapped UI and behavior.
7. Run the smallest relevant checks available for the touched frontend area.
8. Report changed files, implemented capsule scope, checks run, and any Pencil/capsule conflicts.

## Implementation Rules

### Scope

- Keep edits inside the capsule's `May touch` paths unless a dependency forces a small adjacent change.
- Do not modify shared components broadly unless the capsule explicitly assigns that responsibility.
- Do not add product behavior that is absent from both Pencil and the capsule.

### Pencil Reading

- Inspect the primary frame for overall layout.
- Inspect each state frame before coding conditional rendering.
- Inspect parent and child frames when alignment, overlay, safe area, or z-order depends on surrounding UI.
- Use frame prompts for interaction intent. Use node geometry/styles for exact visual implementation.

### State Mapping

Map each capsule state to code explicitly:

- loading/empty/error states
- selected/expanded/collapsed states
- disabled/saving/saved states
- derived visual states from playback, navigation, or store data

Avoid hidden local state when an existing store/navigation/query state already represents the same condition.

### Interaction Mapping

For each mapped user action:

- connect it to the existing event handler pattern
- update the exact state needed to reach the target Pencil frame
- preserve parent-screen side effects named by the capsule
- avoid changing unrelated gestures or navigation behavior

If a gesture needs a library already used in the repo, reuse it. Do not introduce a new gesture/animation library unless the existing stack cannot implement the required behavior.

### Data Inputs

- Use real props/store/API shapes when available.
- Use temporary mock data only when the capsule explicitly allows it or the backend is not ready.
- Handle nullable, empty, and long-content cases named by the capsule.
- Do not change API contracts unless the task explicitly includes API work.

## Conflict Handling

Record conflicts in the final report using this shape:

```text
Conflict:
- Source A:
- Source B:
- Decision:
- Follow-up needed:
```

Ask the user only when the conflict blocks implementation or would force a product/design decision. Otherwise make the narrowest reversible choice and continue.

## Final Report

Keep the final report short:

- files changed
- capsule scope implemented
- checks run
- unresolved conflicts or assumptions
