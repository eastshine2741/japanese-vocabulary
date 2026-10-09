# Artist Detail

곡 상세에서 들어가는 아티스트 화면. Pen 프레임 `J9wBR`(A1. Artist Detail).

## 곡 ↔ 아티스트 잇기

`artist` 테이블(V41)은 Apple Music 카탈로그 아티스트 한 명당 한 행이고 `apple_music_id` 가 unique 다.
곡은 `songs.artist_id` 로 잇는다. 카탈로그에 없으면 null 로 남고, 앱은 아티스트 링크를 그리지 않는다.

- **찾는 법** (`AppleMusicClient.findSongArtist`): `"$title $artist"` 로 검색해 제목·아티스트가 **정확히**
  같은 곡을 고르고 `/songs/{id}/artists` 의 첫 아티스트를 쓴다. 우리 곡은 카탈로그 표기를 그대로 들고 있어서,
  느슨하게 맞추면 같은 제목의 다른 가수 곡이 잡힌다. 협업곡(`After the Rain, そらる & まふまふ`)은 첫 아티스트에만 이어진다.
- **언제** — worker `ArtistLinkListener` 가 분석 완료(`SongAnalysisCompletedEvent`, AFTER_COMMIT)에 잇는다. 실패는
  삼킨다. 놓친 곡과 기존 곡은 batch `artist-link` CronJob(매일 05:00 KST)이 `artist_id IS NULL` 인 곡을 전부 다시 찾는다.
  카탈로그에 없는 곡도 매번 다시 찾는다(곡 하나에 검색 한 번).
- 이을 때마다 아티스트의 이름·사진·링크를 최신으로 덮는다(`ON DUPLICATE KEY UPDATE`). 사진은 1200px 로 채운 URL 이다.

## `GET /api/songs/{id}`

`artistId` 가 추가됐다(아직 못 이었으면 null).

## `GET /api/artists/{id}`

```jsonc
{
  "id": 3, "name": "YOASOBI",
  "artworkUrl": "https://…/1200x1200bb.jpg",   // null 가능
  "appleMusicUrl": "https://music.apple.com/jp/artist/yoasobi/1490256993",
  "studyingSongs": [ { "songId": 12, "title": "アイドル", "artworkUrl": "…", "totalLines": 45, "knownLines": 43 } ],
  "popularSongs": [ { "id": "1757557244", "title": "舞台に立って", "thumbnail": "…", "artistName": "YOASOBI", "durationSeconds": 207 } ]
}
```

- `studyingSongs` — 이 아티스트 곡 중 유저가 곡 단어장을 가진 곡. 이해도는 `GET /api/songs/{id}/coverage` 와 같은
  계산이고 `knownLines / totalLines` 높은 순이다.
- `popularSongs` — Apple Music `top-songs` 10곡 중 `studyingSongs` 에 없는 곡. 검색 결과(`SongSearchItemDto`)와
  같은 모양이라 앱은 검색 결과를 누를 때와 같은 흐름(`GET /api/songs?title&artistName` → 204 면 `/analyze`)을 탄다.
  분석 중 표시도 기존 분석 pill 상태로 한다. Redis 에 하루 캐시하고, Apple Music 이 실패하면 빈 목록이다.
- 없는 아티스트면 404 `ARTIST_NOT_FOUND`.
