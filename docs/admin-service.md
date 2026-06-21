# Admin Service

## Scope

Admin v1 is an internal inspection surface for `song`, `lyric`, and `user`.

- Read-only list/detail pages only.
- No create/update/delete endpoints.
- No generic table editor or raw field editor.
- Future write paths must be entity-specific, invariant-preserving workflows with audit logging.

## Backend

Module: `backend/admin-api`

The module reads shared song/lyric/user tables, but it does not use Redis. Redis auto-configuration and health checks are disabled for this bootstrap so local k3s probes do not depend on cache infrastructure.

Run:

```bash
cd backend
./gradlew :admin-api:test
ADMIN_PASSWORD=admin \
ADMIN_TOKEN_SECRET=dev-admin-token-secret-must-be-at-least-32-bytes \
./gradlew :admin-api:bootRun
```

Routes:

- `POST /admin/api/auth/login`
- `GET /admin/api/songs`
- `GET /admin/api/songs/{songId}`
- `GET /admin/api/songs/{songId}/lyric`
- `GET /admin/api/lyrics`
- `GET /admin/api/lyrics/{lyricId}`
- `GET /admin/api/users`
- `GET /admin/api/users/{userId}`

Auth:

- Login accepts only `{ "password": "..." }`.
- Token is admin-only and signed with `ADMIN_TOKEN_SECRET`, not public `JWT_SECRET`.
- Admin API is stateless.

Environment:

- `ADMIN_PASSWORD`
- `ADMIN_PASSWORD_SHA256`
- `ADMIN_TOKEN_SECRET`
- `ADMIN_TOKEN_TTL_MINUTES`
- `MYSQL_URL`, `MYSQL_USER`, `MYSQL_PASSWORD`

`ADMIN_PASSWORD` has no application default. `deploy.sh` supplies a dev-only fallback for local k3s, but direct `bootRun` must set either `ADMIN_PASSWORD` or `ADMIN_PASSWORD_SHA256`.

## Frontend

Module: `admin-web`

Run:

```bash
cd admin-web
npm install
npm run dev
npm test
npm run build
```

Local default API URL is `http://localhost:8081/admin/api`. Override with:

```bash
VITE_ADMIN_API_BASE_URL=http://localhost:8081/admin/api npm run dev
```

The browser token is stored in `sessionStorage`.

## Local k3s

Dev deployment is wired into the existing script:

```bash
./deploy.sh <namespace>
```

Dev images added:

- `japanese-vocabulary-admin-api:<sha>`
- `japanese-vocabulary-admin-web:<sha>`

Dev resources added:

- `k8s/dev/admin-api/*`
- `k8s/dev/admin-web/*`

Ingress URL:

```text
http://localhost/<namespace>/admin
```

Admin API port-forward for direct API checks:

```bash
kubectl port-forward -n <namespace> svc/admin-api 8081:8081
```

The deployed admin-web image is built with `/<namespace>/admin` as its asset base and router basename, so browser access should use the ingress URL above.
