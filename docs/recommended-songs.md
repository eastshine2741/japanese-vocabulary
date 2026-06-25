# Recommended Songs

Recommended songs v1 exposes recent popular songs on the user home screen after review and personal recent songs.

Scope is intentionally narrow:

- Apple Music Japan RSS `most-played` songs only
- no personalization
- no metrics
- no blacklist
- no admin mutation UI/API in this pass
- no UI visual-design decisions beyond a basic carousel section

## Data source

`batch` calls Apple Music RSS through `integrations:apple-music-rss`:

```text
https://rss.marketingtools.apple.com/api/v2/jp/music/most-played/100/songs.json
```

The collector derives `week_start_date` from the collector run timestamp as the Monday start date in Japan timezone.

## Tables

`song_recommendation_candidate` stores collected candidates before expensive analysis. It keeps Apple source metadata, operator status, and links to `song_analysis_work`, `songs`, and `lyrics` once they exist.

Important statuses:

- `PENDING`: collected, not reviewed
- `APPROVED`: operator decided it is eligible for analysis
- `REJECTED`: operator rejected it

`song_recommendation` stores home-exposable recommendation entries after analysis has completed.

Important statuses:

- `PENDING`: analyzed and ready for final operator ordering/publish decision
- `PUBLISHED`: eligible for home API exposure, subject to read-time safety gates

## Flow

1. Weekly collector upserts up to 100 Apple RSS rows into `song_recommendation_candidate`.
2. Existing candidates keep operator status; source rank/metadata can be refreshed.
3. Operator directly edits DB rows from `PENDING` to `APPROVED` or `REJECTED`.
4. Batch dispatcher finds `APPROVED` candidates without `song_analysis_work_id`.
5. Dispatcher calls `SongAnalysisWorkService.createOrReuse()` with `trigger_source=RECOMMENDATION`.
6. The generic song-analysis worker performs lyric lookup, YouTube lookup, song/lyric creation, and lyric analysis. It does not import recommendation classes.
7. Batch reconciler finds approved candidates with completed work.
8. Reconciler creates one `PENDING` `song_recommendation` only when:
   - work status is `COMPLETED`
   - work has `song_id`, `lyric_id`, and `player_ready_at`
   - linked lyric has non-null `analyzed_content`
9. Operator directly edits `song_recommendation.order_index` and sets selected rows to `PUBLISHED`.
10. User API returns recommendations from the latest published week only.

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

The app tap path calls the existing `GET /api/songs/{id}` through `usePlayerStore.loadById(songId)`, so tapping a recommendation records recent listen through the existing player path.

## Direct DB operation notes

For v1, operator edits are direct DB edits.

If an approved candidate is linked to failed work and should be retried, clear:

- `song_recommendation_candidate.song_analysis_work_id`
- `song_recommendation_candidate.song_id`
- `song_recommendation_candidate.lyric_id`

Then leave the candidate as `APPROVED`; the dispatcher will create or reuse analysis work again.

Bad direct DB publishes are still blocked by the home API safety gate when lyrics are missing analyzed content.
