# 노래방 일본 신곡

한국 노래방(TJ·금영)에 새로 들어온 일본곡을 매일 모아 보여주고 알린다. 유저에게 전할 것은 "이 곡이
노래방에 올라왔다"는 사실이라, 분석 성공 여부와 무관하게 목록과 푸시에 나간다. 분석이 끝난 곡만
`songId` 가 있어 곡 상세로 들어갈 수 있다.

## 흐름

batch `KaraokeCollectTask` (`--task=karaoke-collect`, CronJob `karaoke-collect`, 매일 18:00 KST):

1. `backfillLinks()` — `song_id` 가 빈 행 중 분석된 곡이 생긴 것을 잇는다.
2. 수집 (`KaraokeListingCollector`) — 원장에 없는 일본곡만 `KaraokeSongService.register`.
   - 행을 먼저 넣고, 분석된 곡이 이미 있으면 바로 잇고, 없으면 `createOrReuse(trigger_source=KARAOKE)`.
     이미 분석된 곡을 다시 돌리면 `COMPLETE` 가 활성 가사를 갈아 끼우므로 요청하지 않는다.
3. 알림 (`KaraokeNewSongNotifier`) — `notified_at` 이 빈 행을 모아 구독자에게 한 건. 보낸 뒤 `notified_at` 을 채운다.

한쪽 노래방이 실패해도 다른 쪽은 넣고 알린 뒤 Job 을 실패로 남긴다.
첫 배포는 `--backfill` 로 한 번 돌린다: TJ 는 지난달 1일부터 전부 넣고, 알림은 보내지 않고 `notified_at` 만 채운다.

## 일본곡 판정 (노래방 자체 분류)

- TJ: `POST /legacy/api/newSongOfMonth` (`searchYm`; 그 달 1일부터 오늘까지)에서 최근 3일 등재·한글 없는 곡만,
  `GET /song/accompaniment_search?nationType=JPN&strType=16&searchTxt={번호}` 결과에 그 번호가 나오면 일본곡.
- 금영: `https://kysing.kr/latest/?s_page=N` 목록에 실린 가사 전문에서 가나가 든 줄 비율이 0.3 이상이면 일본곡
  (실측: 일본곡 0.55~0.67, 그 외 0). 등재일을 주지 않아 수집한 날을 `listed_on` 으로 쓴다.

둘 다 공식 API 가 아니라 브라우저가 부르는 엔드포인트·HTML 이다. 구조가 바뀌면 `integrations:karaoke-listing`
고정 데이터 테스트를 새 응답으로 갈고 파서를 고친다.

## 곡 이름

iTunes(`country=jp`)에서 제목·가수가 모두 맞는 결과가 있으면 그 표기(`trackName`/`artistName`)와 600px 아트,
곡 길이를 쓴다. 없으면 노래방 표기에서 괄호(타이업·피처링)와 일본어 제목 뒤 ` - 로마자` 를 뗀 값을 쓴다
(`KaraokeTitleCleaner`). 금영은 긴 표기를 `..` 로 자르므로 그때는 앞부분만 맞으면 된다.
이 이름 하나가 화면 표시, 분석 요청, song 연결 키를 겸한다. 노래방 원문은 저장하지 않는다.

## 원장과 합치기

`karaoke_song` 은 노래방별 한 행이다(`(vendor, number)` 유니크). TJ 에 오른 곡이 다른 날 금영에도 오르면
행이 둘이고 알림도 두 번 나간다. 같은 날 양쪽에 오른 곡은 알림 문구에서 한 곡으로 센다.

응답에서만 합친다 (정규화한 제목+가수가 같을 때):

- `GET /api/karaoke-songs/daily?month=YYYY-MM` — 같은 `listed_on` 안에서만 합친다. 날짜 최신순.
- `GET /api/karaoke-songs/monthly?month=YYYY-MM` — 그 달 안에서 합치고 가수별로 묶는다.

`KaraokeSongItem = { title, artist, artworkUrl?, tjNumber?, kyNumber?, songId? }`.

## song 연결

분석 도메인은 노래방을 모른다. worker 의 `KaraokeSongLinkListener` 가 `SongAnalysisCompletedEvent` 를
AFTER_COMMIT 에 받아 같은 제목·가수의 빈 행을 잇는다. 놓친 행은 다음 날 1단계가 잇는다.

## 구독

`UserSettingsData.karaokeNewSongNotifications` (기본 false, opt-in). `PUT /api/settings` 는 설정 전체를 덮어쓰므로
클라는 설정을 읽어 온 뒤에만 토글을 저장해야 한다. 푸시 대상은 이 값이 켜진, 탈퇴하지 않은 유저. 알림 중 끌 수 있는 것은 이것 하나다.
푸시: 제목 `🎤 노래방 신곡이 업데이트되었어요!`, 본문 `唱, 夜明けの歌 외 1곡을 확인해보세요`(곡명 2개까지,
조사는 한글 받침·`ん` 만 보고 나머지는 `를`), `data = { type: "karaoke_new_songs", title, body }`.

## 앱

검색 탭 디스커버리의 `노래방 신곡` 섹션이 가장 최근 등재일 3곡을 보여주고, 누르면 `KaraokeNewSongs`
화면(날짜별·월별 탭)이 열린다. 탭은 `react-native-tab-view`(네이티브 `react-native-pager-view`)라 새 네이티브 빌드가 필요하다. 푸시(`type: karaoke_new_songs`)도 같은 화면으로 들어온다.
`songId` 가 없는 줄은 곡 상세로 갈 수 없어 눌리지 않는다.

날짜별 응답이 달 단위라 목록 끝에 닿으면 클라가 이전 달을 당겨 이어 붙인다. 빈 달이 세 번 이어지면 멈춘다.

설정 탭 `알림` 섹션과 앱바의 알림 토글은 `karaokeNewSongNotifications` 하나를 바꾸지만 `PUT /api/settings` 는 설정 전체를 덮어쓰므로,
설정을 읽어 오기 전에는 저장하지 않는다.
