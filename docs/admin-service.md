# Admin Service

## Scope

Admin v1 is an internal inspection surface for `song`, `lyric`, and `user`, plus one workflow-specific Reels Factory action.

- Read-mostly list/detail pages plus narrow invariant-preserving operations.
- No generic create/update/delete endpoints.
- No generic table editor or raw field editor.
- Future write paths must be entity-specific, invariant-preserving workflows with audit logging.
- Exception: Reels Factory exposes a transient `POST /admin/api/reels-factory/render` workflow. It does not mutate database state, create render history, store generated files, or upload to social platforms.

Architecture direction:

- Domain modules should expose entity/model/enum plus domain methods/services that enforce invariants.
- Application modules (`api`, `admin-api`, `batch`) own their own read/write workflows and page/search/projection repositories.
- `SongRepository` and `LyricRepository` stay externally visible for this pass; repository-wide internalization is out of scope.
- External music clients should live outside domain core in function-specific integration modules (`integrations:song-search`, `integrations:lyric-search`, `integrations:mv-search`), with direct class usage rather than a hexagonal port layer unless complexity later justifies it.
- Integration Kotlin packages should also stay outside the domain package tree: `songsearch`, `lyricsearch`, and `mvsearch`, not `song.client`.
- Active domain/integration modules provide Spring wiring through `AutoConfiguration.imports` and `com.japanese.autoconfigure.*` classes. AutoConfiguration component-scans the module-owned `com.japanese.vocabulary.<module>` package and registers JPA entities/repositories explicitly. Application bootstraps should not carry sibling module `@EntityScan` or repository scan knowledge, and broad root component scan should not be used as a backup wiring path.
- Integration clients should use `RestClient` where behavior can stay equivalent. Applications avoid unused clients by depending only on the integration modules they need; the depended module's AutoConfiguration exposes its client beans.
- Product/read-model cache belongs to the application module that owns the behavior. For this pass, song search cache belongs to `api` and artist-channel cache belongs to `batch`.
- Admin mutations must call domain methods/services; raw field updates stay out of scope. Current mutation: song reanalysis creates or reuses a `song_analysis_work` and never edits song/lyric fields directly.

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
- `POST /admin/api/songs/{songId}/reanalysis`
- `GET /admin/api/lyrics`
- `GET /admin/api/lyrics/{lyricId}`
- `GET /admin/api/recommendations/weeks`
- `GET /admin/api/recommendations/candidates`
- `PATCH /admin/api/recommendations/candidates/{candidateId}/status`
- `GET /admin/api/recommendations`
- `PATCH /admin/api/recommendations/{recommendationId}`
- `POST /admin/api/recommendations/prepare-approved`
- `POST /admin/api/recommendations/request-analysis`
- `GET /admin/api/users`
- `GET /admin/api/users/{userId}`
- `GET /admin/api/reels-factory/songs`
- `GET /admin/api/reels-factory/songs/{songId}`
- `POST /admin/api/reels-factory/songs/{songId}/source` (multipart `file`)
- `GET /admin/api/reels-factory/songs/{songId}/source`
- `GET /admin/api/reels-factory/songs/{songId}/mv?token=...` (media token only; no admin bearer)
- `POST /admin/api/reels-factory/render`

Reels Factory:

- `admin-web` is a small NLE-style editor: toolbar (song picker, acknowledgement, render) / line bin · monitor · inspector / timeline. The edit state (clip in/out, per-line start time, per-line words) lives only in the browser; nothing is persisted.
- The admin picks an analyzed song and at least 4 analyzed lyric lines. Lines always play in song order. Timing is not taken from the DB at render time: `SYNCED` timestamps only seed the editor, and `PLAIN` lyrics (no timestamps) are laid out 3s apart and then marked by hand. So wrong or missing timestamps do not matter.
- Timing tools: drag the clip range on the MV overview, drag line blocks or the end handle on the reel timeline, type `m:ss.t` in the inspector, or use the playhead: `Space` play/pause, `M` stamp the selected line's start at the playhead and move to the next line, `I`/`O` set clip start/end, `←`/`→` nudge one frame (`Shift` one second). The monitor has a Source tab (raw MV `<video>`, for finding the section) and a Reel tab (`PromoReel` in `@remotion/player`); both share one playhead in MV time.
- Words: each line's `recommendedVocabulary` (N5/N4 content words) is the default selection; the inspector lets the admin toggle any content-word token with a Korean meaning, up to `maxVocabularyPerLine` (2, the PromoReel word block layout). Particles, auxiliaries and symbols cannot be picked.
- `GET /songs/{songId}` returns `lyricType`, `fps`, `minLineCount`, `maxLyricsSpanMs`, `maxVocabularyPerLine` and every raw line with its analysis; a line is `selectable` when it is analyzed (missing timing no longer blocks it).
- The MV is not fetched by the server. The admin downloads the MV mp4 themselves (the monitor's empty state links to `song.youtubeUrl`) and uploads it with `POST /songs/{songId}/source` (multipart `file`, up to `ADMIN_REELS_SOURCE_MAX_UPLOAD`, default 1GB). The server checks the `ftyp` signature, stores it in the source cache (`AdminReelsSourceCache`), transcodes a preview copy (below) and returns `mvPath`; the response waits for the transcode (422 `source_transcode_failed` if ffmpeg cannot read the file or exceeds `ADMIN_REELS_PREVIEW_TIMEOUT`). `GET /songs/{songId}/source` returns the same `mvPath` (with a fresh media token) when a previous upload is still cached, or 404 — the editor calls it when a song is picked so a reload does not force a re-upload. yt-dlp was removed: the prod egress IP (Hetzner) is flagged by YouTube as a bot regardless of player client, so server-side extraction is not an option there.
- `POST /render` takes `{ songId, data: PromoReelData, acknowledgeSourceRightsAndPlatformRisk }` (the flag is still validated server-side; `admin-web` always sends `true` and shows no checkbox) — the same Remotion props the browser preview used, built by `admin-web/src/pages/reels-factory/reelEditor.ts` (`buildPromoData`). The server checks the song is eligible (analyzed lyrics), that a source mp4 is cached for the song (400 otherwise), and the timeline (≥ 4 lines, song order, strictly increasing `startFrame`, `lyricsEndFrame` after the last line and ≤ 60s, ≤ 2 words per line with text and meaning), blanks `song.mvAsset`, and renders. Preview and MP4 therefore share exactly one data path; the reel font (S-Core Dream) is bundled as woff2 from `reels/src/fonts/` so it is identical in both, while Japanese fallback fonts (browser Noto Sans KR/JP vs container Noto Sans CJK) and colour space (final MP4 is yuv420p/bt709) can differ slightly.
- Preview copy: YouTube MVs are usually open-GOP H.264 (most sync samples are non-IDR I-frames). Seeking to such a keyframe leaves following B-frames referencing frames before it, and Chrome's software decoder (`AV_EF_EXPLODE`) fails with `PIPELINE_ERROR_DECODE` — the Remotion `<Video>` in the Reel tab seeks on every line change, so some lines simply broke. `FfmpegAdminReelsPreviewTranscoder` therefore re-encodes each upload to `song-{id}-preview.mp4` (libx264 superfast, crf 25, IDR every 30 frames, ≤ 720p, audio copied so timestamps match) and `/mv` streams only that copy. Render still uses the untouched original. `cached()` requires both files.
- MV streaming: `<video>` cannot send an `Authorization` header, so the source response embeds a 30-minute media token scoped to `reels-mv` + `songId` in `mvPath`. The `/mv` endpoint is `permitAll` in `SecurityConfig` and validates that token itself; it only serves files already in the cache. Media tokens are rejected by the normal admin bearer filter.
- Source cache: `ADMIN_REELS_SOURCE_DIRECTORY` (default `${java.io.tmpdir}/kotonoha-reels-sources`), `song-{id}.mp4` + `song-{id}-preview.mp4` per song, LRU-trimmed to `ADMIN_REELS_SOURCE_MAX_FILES` songs (default 4). Render passes the cached file to the render script as `source.localPath`; the script never downloads anything.
- The server invokes the repo-local Remotion package through `AdminReelsRenderService` and returns an MP4 attachment directly.
- No DB entity, migration, Object Storage object, or job history is created.
- Normal tests use a fake renderer, a fake preview transcoder, and the real file cache on a temp directory. The subprocess renderer requires Node, npm dependencies under `/opt/reels`, and `ffmpeg`.
- Uploaded MVs are copyrighted material. This workflow is admin-only and is not legal advice.

Auth:

- Login accepts only `{ "password": "..." }`.
- Token is admin-only and signed with `ADMIN_TOKEN_SECRET`, not public `JWT_SECRET`.
- Admin API is stateless.

Environment:

- `ADMIN_PASSWORD`
- `ADMIN_PASSWORD_SHA256`
- `ADMIN_TOKEN_SECRET`
- `ADMIN_TOKEN_TTL_MINUTES`
- `ADMIN_REELS_RENDERER_WORKING_DIRECTORY` (default in container: `/opt/reels`)
- `ADMIN_REELS_RENDERER_TIMEOUT` (Spring duration; default: `8m`)
- `ADMIN_REELS_SOURCE_DIRECTORY` (default: `${java.io.tmpdir}/kotonoha-reels-sources`)
- `ADMIN_REELS_SOURCE_MAX_FILES` (default: `4`)
- `ADMIN_REELS_SOURCE_MAX_UPLOAD` (Spring data size; default: `1GB`)
- `ADMIN_REELS_PREVIEW_FFMPEG` (default: `ffmpeg`), `ADMIN_REELS_PREVIEW_THREADS` (default: `4`), `ADMIN_REELS_PREVIEW_TIMEOUT` (Spring duration; default: `5m`)
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

Song detail exposes a reanalysis action. If a `PENDING` or `RUNNING` analysis work already blocks the song, the trigger is disabled and the active work is linked. Recent work history links to work and lyric details and shows the work-produced MV URL from `song_analysis_work.youtube_url` when present. The UI does not implement rollback or active-result selection.

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

## Prod (Hetzner k3s)

```bash
DEPLOY_ENV=prod ./deploy.sh
```

URL:

```text
https://kotonoha.eastshine.dev/admin        # admin-web
https://kotonoha.eastshine.dev/admin/api    # admin-api
```

admin-web 과 admin-api 가 한 호스트를 path 로 나눠 쓴다. 같은 origin 이라 CORS 설정이 없고 인증서도 한 장(`admin-tls`)이다. 사용자 API 는 그대로 `api.kotonoha.eastshine.dev` 를 쓴다.

Prod resources:

- `k8s/prod/admin-api/*` — configmap, secret template, deployment, service, servicemonitor
- `k8s/prod/admin-web/*` — deployment, service
- `k8s/prod/admin/*` — `admin-tls` Certificate + Traefik Middleware/IngressRoute

라우팅은 표준 Ingress 가 아니라 Traefik `IngressRoute` 다. 두 백엔드가 같은 호스트를 path 로 나눠 쓰는데 `stripPrefix` 는 admin-web 쪽에만 걸려야 한다. Ingress 에서 미들웨어는 `metadata.annotations` 로 지정하고 그 값은 Ingress 오브젝트 전체에 적용되므로, 한 Ingress 안의 path 마다 다른 미들웨어를 줄 수 없다 — admin-api 까지 prefix 가 벗겨지면 컨트롤러 매핑과 어긋나 전부 404 다. `IngressRoute` 는 `middlewares` 가 route 항목 안에 있어 path 별로 갈린다. 라우팅 리소스가 IngressRoute 라 cert-manager ingress-shim 이 붙지 않으므로 `Certificate` 를 명시적으로 선언한다.

- `/admin/api/*` → admin-api:8081. prefix 를 유지한다 (컨트롤러 매핑이 `/admin/api/**`).
- `/admin/*` → admin-web:80. `/admin` 을 벗겨 nginx root 로 넘긴다.
- `http://` 로 들어온 `/admin` 은 `https://` 로 308 리다이렉트한다. `/.well-known/acme-challenge/*` 는 매칭하지 않으므로 cert-manager http01 solver 와 겹치지 않는다.

Prod 이미지:

- `ghcr.io/<GHCR_USERNAME>/kotonoha-admin-api:<sha>`
- `ghcr.io/<GHCR_USERNAME>/kotonoha-admin-web:<sha>` — asset base 와 router basename 을 `/admin` 으로 굽는다

Prod 인증:

- `.env.prod` 에 `ADMIN_PASSWORD_SHA256` (소문자 hex 64자) 와 `ADMIN_TOKEN_SECRET` (최소 32자) 이 필수다. 둘 중 하나라도 없거나 형식이 틀리면 `deploy.sh` 가 배포 전에 멈춘다.
- prod secret 에는 평문 `ADMIN_PASSWORD` 를 넣지 않는다. `AdminPasswordVerifier` 는 `password-sha256` 이 있으면 그것만 본다.
- 어드민은 인터넷에 공개되고 이 비밀번호 하나로만 막힌다. rate limit 이나 IP 제한은 없다. 비밀번호를 길게 잡고, 노출 시 `.env.prod` 해시를 교체해 재배포한다.

DNS:

- `kotonoha.eastshine.dev` A 레코드가 Hetzner LB IP (= `api.kotonoha.eastshine.dev` 와 같은 IP) 를 가리켜야 한다. 레코드가 없으면 ACME http01 challenge 가 실패하고 인증서가 발급되지 않는다.
- 발급 확인: `kubectl get certificate -n kotonoha admin-tls`

Prod 모니터링:

- admin-api actuator 는 `health,info,prometheus` 를 노출하고 `k8s/prod/admin-api/servicemonitor.yaml` 이 `/actuator/prometheus` 를 30초 간격으로 긁는다.
- probe 는 api/batch 와 같은 `/actuator/health/{liveness,readiness}` 를 쓴다.
