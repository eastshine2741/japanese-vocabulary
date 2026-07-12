---
name: pencil-capsule-distributor
description: Create minimal frontend implementation capsules from Pencil MCP designs and distribute scoped UI work to subagents. Use when a master agent must read Pencil frames/prompts, product intent, and repo context, then split frontend implementation across screen/component subagents without replacing Pencil as the source of truth.
---

# Pencil Capsule Distributor

Use this as the master-agent workflow for turning Pencil design context into small implementation packets for frontend subagents.

## Ground Rules

- Treat Pencil frames and their prompts as the UI/interaction source of truth.
- If Pencil MCP connection or frame read fails, stop immediately. Do not retry, do not use screenshots from memory, and do not create capsules from assumptions; report the failure to the user.
- Treat the capsule as an index and handoff packet, not a rewritten design spec.
- Keep the capsule minimal. Do not duplicate colors, typography, padding, or frame details that the implementer can read directly from Pencil.
- Capture only the information needed to route work: scope, source frames, state mapping, interaction mapping, data/code entry points, and conflicts.
- If Pencil context is missing for an interaction, record an explicit open question or assumption instead of inventing UX.
- If Product Intent and Pencil disagree, note the conflict. Use Product Intent for product flow; use Pencil for visual and interaction details unless the user decides otherwise.

## Workflow

1. Read the relevant Product Intent or user request.
2. Inspect local frontend structure enough to identify likely screen/component targets and existing patterns.
3. Use Pencil MCP to inspect the relevant page/frame tree and frame prompts. If this call fails, stop immediately and report the Pencil MCP failure without additional attempts. Prefer the smallest frame set that covers all states.
4. Identify implementation units that can be assigned independently: screen shell, repeated row/card, bottom sheet/modal, player/control area, navigation integration, or state/data integration.
5. Write one capsule per implementation unit.
6. Hand each subagent only its capsule, relevant Product Intent excerpt, code paths it may touch, and Pencil frame ids it must inspect directly.

## Capsule Format

Use this format. Remove sections that do not apply; do not add QA sections.

```markdown
# Frontend Implementation Capsule: <unit name>

## Task
- Target:
- Goal:
- Expected output:

## Scope
### In scope
- ...

### Out of scope
- ...

## Pencil Sources
- File/session:
- Page:
- Primary frame:
- Parent frame:
- State/component frames:
  - default:
  - loading:
  - empty:
  - error:
  - selected:
  - expanded/collapsed:

## Frame Usage Rules
- <frame> is the source for <state/condition>.
- <frame> is reached after <interaction>.
- The subagent must inspect these Pencil frames directly before coding.
- If this capsule conflicts with Pencil, follow Pencil and report the conflict.

## Component Mapping
| Pencil frame/node | Code target | Responsibility |
|---|---|---|
| ... | ... | ... |

## State Mapping
| UI state | Pencil frame | Trigger/source |
|---|---|---|
| ... | ... | ... |

## Interaction Mapping
| User action | From state/frame | To state/frame | Code behavior |
|---|---|---|---|
| ... | ... | ... | ... |

## Data Inputs
- Props:
- Store/API fields:
- Nullable/empty cases:
- Temporary mock data, if needed:

## Existing Code Links
- Reuse:
- Follow patterns from:
- May touch:
- Do not touch:

## Open Questions / Conflicts
- ...
```

## Subagent Handoff

Send each implementation subagent a concise prompt:

```text
Use the pencil-frontend-implementer skill.
Implement only this capsule's scope.
Pencil frames/prompts are the source of truth; the capsule is an index.
Inspect every referenced Pencil frame directly before coding.
Follow existing frontend patterns and report any Pencil/capsule/product conflicts.

<capsule markdown>
```

## Stop Conditions

Stop capsule creation and ask the user only when:

- The target Pencil page/frame cannot be identified.
- Pencil MCP connection or frame read fails.
- Required state frames are absent and the missing behavior materially changes implementation.
- Product Intent and Pencil conflict on core user flow.
- Work cannot be split without overlapping edits to the same component ownership boundary.
