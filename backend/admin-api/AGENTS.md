# Admin API Instructions

## Scope

Applies to `backend/admin-api/`.

## Rules

- Keep admin API separate from public user API behavior.
- Admin v1 is inspection-oriented: songs, lyrics, song analysis works, and users. Operator actions are workflow-specific: song reanalysis, recommendation list edits, manual push.
- Do not add generic raw table editors.
- Future mutations must be entity-specific workflows that call domain methods/services and preserve invariants.
- Do not depend on music integration modules unless a specific admin workflow explicitly needs provider access.
- Keep WebFlux/external music clients out of admin-api runtime classpath.
- Redis is on the runtime classpath only transitively (`domains:notification`, needed for operator
  manual push). admin-api itself must not call Redis; its health check stays disabled.
- Admin repositories and projections may be application-local when they represent admin screens.
- Password-only auth is intentional for this internal surface unless requirements change.

## Reference

- Admin service details: `../../docs/admin-service.md`
