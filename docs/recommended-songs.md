# Recommended Songs

홈 추천곡은 운영자가 admin 에서 이미 DB 에 있는 곡을 검색해 하나의 전역 목록에 직접 넣고 순서를 정한다.
주차·발행 상태·후보·가사/분석 검사·개수 제한은 없다.

## Table

`recommended_song` (V38): `song_id` (FK `songs`, UNIQUE), `order_index`, `created_at`, `updated_at`.
목록 순서는 `order_index ASC, id ASC`.

## Admin API

- `GET /admin/api/recommendations` — `[{id, songId, title, artist, artworkUrl, orderIndex, createdAt}]`
- `POST /admin/api/recommendations` `{songId}` — 목록 끝에 추가, `201`. 없는 곡 `404`, 이미 추천된 곡 `409 SONG_ALREADY_RECOMMENDED`
- `DELETE /admin/api/recommendations/{id}` — `204`, 없으면 `404`
- `PUT /admin/api/recommendations/order` `{ids}` — 현재 목록 전체를 정확히 한 번씩 담아야 한다(아니면 `400`). `order_index` 를 0..n-1 로 다시 쓰고 전체 목록을 돌려준다.

곡 검색은 기존 `GET /admin/api/songs?q=` 를 쓴다.

## User API

`GET /api/songs/recommendations` → `[{id, songId, title, artist, artworkUrl}]`, 위 순서 그대로.
최근 들은 곡을 기록하지 않는다. 탭하면 앱이 `GET /api/songs/{id}` 로 열면서 기록된다.

## Rollout

V38 은 테이블을 추가만 한다. 이전 버전 pod 는 `ddl-auto: validate` 로 구 테이블을 검증하므로
`song_recommendation`, `song_recommendation_candidate` 는 남겨 두었다. 이 릴리스가 전부 배포된 뒤
다음 릴리스의 migration 에서 두 테이블을 지운다. `song_analysis_work.trigger_source` 의
`RECOMMENDATION` 값은 기존 행이 쓰고 있어 enum 에 남긴다.
