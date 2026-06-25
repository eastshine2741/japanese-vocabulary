# Admin Service

## Scope

Admin v1 is an internal inspection surface for `song`, `lyric`, and `user`.

- Read-only list/detail pages only.
- No create/update/delete endpoints.
- No generic table editor or raw field editor.
- Future write paths must be entity-specific, invariant-preserving workflows with audit logging.

Architecture direction:

- Domain modules should expose entity/model/enum plus domain methods/services that enforce invariants.
- Application modules (`api`, `admin-api`, `batch`) own their own read/write workflows and page/search/projection repositories.
- `SongRepository` and `LyricRepository` stay externally visible for this pass; repository-wide internalization is out of scope.
- External music clients should live outside domain core in function-specific integration modules (`integrations:song-search`, `integrations:lyric-search`, `integrations:mv-search`), with direct class usage rather than a hexagonal port layer unless complexity later justifies it.
- Integration Kotlin packages should also stay outside the domain package tree: `songsearch`, `lyricsearch`, and `mvsearch`, not `song.client`.
- Active domain/integration modules provide Spring wiring through `AutoConfiguration.imports` and `com.japanese.autoconfigure.*` classes. AutoConfiguration component-scans the module-owned `com.japanese.vocabulary.<module>` package and registers JPA entities/repositories explicitly. Application bootstraps should not carry sibling module `@EntityScan` or repository scan knowledge, and broad root component scan should not be used as a backup wiring path.
- Integration clients should use `RestClient` where behavior can stay equivalent. Applications avoid unused clients by depending only on the integration modules they need; the depended module's AutoConfiguration exposes its client beans.
- Product/read-model cache belongs to the application module that owns the behavior. For this pass, song search cache belongs to `api` and artist-channel cache belongs to `batch`.
- Admin mutations must call domain methods/services; raw field updates stay out of scope.

## Backend

Module: `backend/admin-api`

The module reads shared song/lyric/user tables, but it does not use Redis or music integration modules. Its runtime classpath should stay free of Redis/WebFlux/music-provider clients. Domain entity/repository scan comes from the depended domain modules' AutoConfiguration; admin-api only registers its own admin repositories.

Marker classes are not required for module component scanning. This project uses package strings because module package names are part of the documented module boundary; JPA scan remains type-based through entity/repository classes.

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
