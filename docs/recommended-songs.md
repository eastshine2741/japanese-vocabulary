# Recommended Songs

Recommended songs v1 exposes recent popular songs on the user home screen after review and personal recent songs.

Scope is intentionally narrow:

- Apple Music Japan RSS `most-played` songs only
- no personalization
- no metrics
- no blacklist
- admin trigger UI/API only for approved-candidate processing and missing-song analysis requests
- no UI visual-design decisions beyond a basic carousel section

## Data source

`batch` calls Apple Music RSS through `integrations:apple-music-rss` from the Spring Batch job
`appleMusicRecommendationCollectJob`:

```text
https://rss.marketingtools.apple.com/api/v2/jp/music/most-played/100/songs.json
```

The job derives `week_start_date` from the run timestamp as the Monday start date in Japan timezone unless
`weekStartDate` is supplied as a job parameter.

Manual one-off execution:

```bash
cd backend
./gradlew :batch:bootRun --args='--spring.batch.job.enabled=true --spring.batch.job.name=appleMusicRecommendationCollectJob weekStartDate=2026-06-22'
```

`spring.batch.job.enabled` stays `false` by default so the long-running batch application does not run all
Spring Batch jobs on normal startup. `:batch:bootRun` is still a long-running batch application process, so
for one-off testing, confirm the job completion log and stop the process manually.

## Tables

`song_recommendation_candidate` stores collected candidates before expensive analysis. It keeps only Apple source metadata and operator status; analysis work and final song/lyric results live in `song_analysis_work` and `song_recommendation`.

Important statuses:

- `PENDING`: collected, not reviewed
- `APPROVED`: operator decided it is eligible for analysis
- `REJECTED`: operator rejected it

`song_recommendation` stores home-exposable recommendation entries after analysis has completed.

Important statuses:

- `PENDING`: analyzed and ready for final operator ordering/publish decision
- `PUBLISHED`: eligible for home API exposure, subject to read-time safety gates

## Flow

1. Weekly `appleMusicRecommendationCollectJob` upserts up to 100 Apple RSS rows into `song_recommendation_candidate`.
2. Existing candidates keep operator status; source rank/metadata can be refreshed.
3. Operator reviews candidates in admin-web and updates status through `PATCH /admin/api/recommendations/candidates/{id}/status`.
4. Operator clicks `Process approved` in admin-web, which calls `POST /admin/api/recommendations/prepare-approved`.
5. Admin API finds `APPROVED` candidates without a recommendation and exact-matches `songs.artist + songs.title`.
6. If any candidate is missing a song or active analyzed lyric, the API returns `422 Unprocessable Entity` with one result item per candidate, including discovered `songId`/`lyricId` when present and `null` when absent. No recommendations are created in this case.
7. Admin-web can request analysis for the missing candidate ids through `POST /admin/api/recommendations/request-analysis`, which calls `SongAnalysisWorkService.createOrReuse()` with `trigger_source=RECOMMENDATION`.
8. The generic song-analysis worker performs lyric lookup, YouTube lookup, song/lyric creation, and lyric analysis. It does not import recommendation classes.
9. After analysis completes, the operator clicks `Process approved` again. When every approved candidate has a matching active analyzed lyric, Admin API creates `PENDING` `song_recommendation` rows.
10. Operator orders and publishes recommendations in admin-web through `PATCH /admin/api/recommendations/{id}`.
11. User API returns recommendations from the latest published week only.

## Home API safety gate

`GET /api/songs/recommendations` returns a compact list:

- `id`
- `songId`
- `title`
- `artist`
- `artworkUrl`
- `weekStartDate`

The API:

- reads the latest `week_start_date` that has `PUBLISHED` recommendation rows
- orders by `order_index ASC, created_at ASC`
- filters out missing song/lyric rows
- filters out lyrics whose `analyzed_content` is null
- does not record recent listens

The app tap path calls the existing `GET /api/songs/{id}` through `usePlayerStore.loadById(songId)`, so tapping a recommendation records recent listen before opening `SongDetail`.

## Retry notes

If analysis failed or has not completed, leave the candidate as `APPROVED`, request analysis for the missing candidate again, and rerun `Process approved` after the song analysis worker has produced an active analyzed lyric.

Bad publishes are blocked by both the admin publish API and the home API safety gate when lyrics are missing analyzed content.

## Admin operation API

- `GET /admin/api/recommendations/candidates`
- `PATCH /admin/api/recommendations/candidates/{candidateId}/status`
- `GET /admin/api/recommendations`
- `PATCH /admin/api/recommendations/{recommendationId}`
- `POST /admin/api/recommendations/prepare-approved`
- `POST /admin/api/recommendations/request-analysis`

All endpoints are authenticated admin-only operations. Admin list and operation endpoints use an internal 100-row cap, matching the Apple RSS v1 source size.
