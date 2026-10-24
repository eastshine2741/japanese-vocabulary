# 가사 줄 시각을 MV 에 맞추기

lrclib 의 SYNCED 시각은 앨범 음원 기준이다. 곡 상세가 트는 MV 는 인트로가 길거나 중간에 장면이 끼어
몇 초에서 십몇 초까지 어긋나고(ライラック +7.4s, 強風オールバック 는 86초부터 +14s), PLAIN 가사는 시각이
아예 없다. 그래서 줄 시각을 (가사, MV) 조합마다 따로 계산해 `lyric_mv_sync` 에 둔다.

## 왜 로컬 PC 가 계산하나

- 서버는 MV 오디오를 받을 수 없다. YouTube 가 Hetzner egress IP 를 봇으로 막는다(`docs/admin-service.md` 릴스 MV 와 같은 이유).
- 계산이 무겁다. 2코어 CPU 에서 Demucs 230초·최대 2.8GB, Whisper medium 237초·최대 3.7GB 를 실측했다. prod 노드(cx23, 4GB)에는 못 올린다. GPU(GTX 1660 Super)로는 곡당 2분 남짓이다.

PC 가 꺼져 있으면 행이 PENDING 으로 남고, 켜지면 `lyric-sync-agent/` 실행기가 admin-api 로 하나씩 점유해 처리한다.
곡 분석(`song_analysis_work`)의 stage 로 넣지 않은 이유는 그쪽이 5분 예산과 10분 타임아웃을 전제로 하기 때문이다.
곡은 분석이 끝나면 바로 열리고, 시각은 나중에 바뀐다.

## 원장 규칙

- 행은 곡 분석 완료(새 active 가사)와 제보 승인(MV 변경) 때 같은 트랜잭션에서 생긴다. 기존 곡은 V52 가, 그 사이 빠진 조합(배포 중 옛 pod 가 끝낸 분석 등)은 batch `lyric-mv-sync-enqueue`(매일 04:30 KST)가 넣는다.
- 앱은 곡의 지금 `youtube_url` 과 video id 가 같은 COMPLETED 행만 쓴다. MV 가 바뀌면 옛 행은 그냥 안 쓰인다. 결과가 있으면 PLAIN 가사도 `lyricType=SYNCED` 로 내려야 앱이 자동 싱크를 켠다.
- 점유는 30분 기한(`lease_until`)이고 점유마다 `attempt` 가 오른다. 결과는 점유한 attempt 로만 쓸 수 있어, 기한이 지나 다시 점유된 뒤 늦게 온 결과는 409 로 거절된다.
- 점유할 때 곡의 active 가사나 MV 가 이미 바뀐 행은 처리하지 않고 FAILED(`superseded`)로 넘긴다.
- 실행기 쪽 사정(다운로드 차단, GPU 오류)으로 실패하면 1시간 뒤 다시 점유되고, 5번째 점유에서도 실패하면 FAILED 다. 바로 다시 점유하면 같은 오류로 대기열 전체가 FAILED 가 된다.
- 곡 자체 문제(MV 에서 가사를 못 찾음)는 바로 FAILED 다. 같은 조합이 다시 들어오면(MV 가 A→B→A) FAILED 행이 PENDING 으로 돌아간다.
- 시각은 줄 순서대로 늘어나야 받는다. 앱은 지금 시각보다 늦은 첫 줄에서 멈춰 현재 줄을 정해서, 거꾸로 가면 하이라이트가 엉뚱한 줄에 선다.
- 실행기의 판정(`confidence.verdict`)과 무관하게 결과를 바로 쓴다(제품 결정). 판정은 틀린 곡을 찾을 때 본다.
- 실행기 토큰(`ADMIN_LYRIC_SYNC_AGENT_TOKEN`)은 `/admin/api/lyric-sync-agent/**` 만 열고, admin 로그인 토큰은 그 경로를 못 쓴다.

## 계산 방식과 바꾸면 깨지는 것

MV 오디오 → Demucs 보컬 분리 → Whisper large-v3 → 가사 줄 위치 찾기 → 시각. SYNCED 는 lrclib 시각을 구간별로 밀고(OFFSET),
PLAIN 은 찾은 줄 사이를 글자 수로 보간한다(ALIGNED). PoC 에서 lrclib 이 맞는 SYNCED 8곡 460줄로 잰 1번 정렬 오차는
중앙값 0.21초, 1초 이내 90% 였다.

- **보컬 분리를 빼지 않는다.** 원곡 믹스에서는 Whisper 가 줄 대부분을 못 듣는다.
- **줄 단위 매칭이 아니라 곡 전체 글자 단위 DP 다.** lrclib 은 Whisper segment 보다 줄을 잘게 나눠서, 줄을 segment 에 붙이는 방식(lyric-align)은 중간부터 밀려 怪獣の花唄 에서 오차가 10초까지 갔다.
- **빈 구간은 가사를 prompt 로 다시 받아쓴다.** Whisper 는 노래에서 절 하나를 통째로 건너뛰거나 「ご視聴ありがとうございました」로 1분을 채운다. VAD 나 직전 문맥 조건을 끄는 것만으로는 오히려 나빠졌다.
- **줄 첫머리 글자가 침묵을 건너 점프하면 침묵 뒤 소리 시작으로 옮긴다.** Whisper 는 공백 뒤 첫 단어를 앞 줄 끝에 붙여 찍는다(Lemon 「あの日の…」가 4초 일찍).
- **OFFSET 은 밀기만 하고 기울기(속도 차이)는 맞추지 않는다.** 熱異常 에서 빠른 반복 구간의 ASR 쏠림을 속도 차이로 읽어 곡 끝에서 1초씩 틀렸다.
- 합성음 보컬이 빠른 곡(熱異常)은 Whisper 가 거의 못 들어 ALIGNED 결과 대부분이 보간이다.
