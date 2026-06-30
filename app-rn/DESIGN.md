# Design System Rules: Soft Bento + Carbon Frost

All new design work must follow these rules.

## Structure (Soft Bento Identity)
- The design is a set of discrete tiles, never a continuous flow.
- Tile/card corner radius: rounded.2xl (16) — required
- Nested elements inside tiles: rounded.xl (12)
- Small labels, actions, status indicators: rounded.full
- Small interactive elements inside nested content: rounded.lg (8)
- Never use rounded.none. Every corner is softened.

## Separation Rules
- Tiles are separated only by gap space revealing surface.primary
- No border strokes between tiles — ever
- No dividers or rules inside tiles
- Whitespace is the sole structural separator

## Elevation
- Tiles themselves cast no shadow (distinguished by fill color alone)
- shadow.sm applies only to nested elements inside tiles

## Layout
- Bento grid: two columns of tiles at varying heights, side by side, never sharing edges
- Weight anchored to the leading column — primary message tile always leads
- Single-column full-width text zones break rhythm between grid clusters
- All tiles float inward from container edge with consistent outer margin — nothing bleeds to the boundary
- Generous internal padding. One or two content types per tile only.

## Typographic Hierarchy
- Three distinct scale levels
- Primary headings ~4-5x body text size
- Data figures ~3x their caption labels
- One element clearly dominant per container
- Hierarchy is steep within containers, moderate across containers
- headings: Funnel Sans (natural line-height for multi-line titles)
- body: Inter
- captions: Inter
- data: Geist Mono (for large display figures)

## Color Usage
- All colors must reference variable tokens — never hardcode hex/rgb
- surface.primary: the ground, visible in gaps between tiles
- surface.secondary: the dominant tile surface
- surface.inverse: one tile per cluster only — the sole tonal break on the page
- accent.primary: at most 3-4 times per view — primary action, status indicators, data viz only
- foreground.muted: tertiary marks and caption labels

## Decoration
- Simplified UI representations (schematic interface depictions) allowed inside tiles — both decoration and demonstration
- A small data visualization (e.g., sparkline) may appear in one nested element
- No photography, no gradients, no abstract illustration
- A graduated-scale text list (varying item sizes to create a typographic arc) is the single allowed expressive typographic decoration

## Component Rules
- Recurring patterns (buttons, cards, badges, inputs) must be defined as reusable: true components
- Instantiate via type: "ref" with descendants overrides
- Never hand-build the same pattern multiple times
