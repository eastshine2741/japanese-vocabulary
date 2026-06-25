# Admin API Instructions

## Scope

Applies to `backend/admin-api/`.

## Rules

- Keep admin API separate from public user API behavior.
- Admin v1 is inspection-oriented: songs, lyrics, song analysis works, and users.
- Do not add generic raw table editors.
- Future mutations must be entity-specific workflows that call domain methods/services and preserve invariants.
- Do not depend on music integration modules unless a specific admin workflow explicitly needs provider access.
- Keep Redis/WebFlux/external music clients out of admin-api runtime classpath.
- Admin repositories and projections may be application-local when they represent admin screens.
- Password-only auth is intentional for this internal surface unless requirements change.

## Reference

- Admin service details: `../../docs/admin-service.md`
