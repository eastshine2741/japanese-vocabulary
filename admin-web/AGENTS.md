# Admin Web Instructions

## Scope

Applies to `admin-web/`.

## Rules

- Build actual admin work surfaces, not marketing pages.
- Use the existing Vite React TypeScript stack and shadcn-style components.
- Keep screens dense, restrained, and operational; admin users need scanning and repeated actions.
- Do not expose generic raw entity field editors.
- Future writes must mirror entity-specific invariant-preserving backend workflows.
- Store the admin bearer token in `sessionStorage`.
- Local dev default API base is `http://localhost:8081/admin/api`; override with `VITE_ADMIN_API_BASE_URL`.

## Reference

- Admin service details: `../docs/admin-service.md`
