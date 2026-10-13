# Kotonoha Reels Prototype

Remotion 기반의 9:16 숏폼 홍보 영상 템플릿입니다. 어드민 렌더에서는 DB의 song/lyric selection을 서버가 `PromoReelData` props로 조립해서 넘깁니다.

`src/data/samplePreview.ts`는 Remotion Studio와 로컬 sample render용 fixture입니다. 어드민 렌더 경로에서는 이 파일을 읽지 않습니다.

## Commands

```bash
npm install
npm run dev
npm run check
npm run render:sample
npm run still:sample
npm run smoke:fixture
```

어드민 입력으로 렌더할 때는 `render:request`가 request JSON을 받아 `source.localPath`(admin-api 에 어드민이 올려 둔 MV mp4)를 임시 asset으로 복사하고 Remotion props를 주입합니다. 스크립트는 아무것도 다운로드하지 않습니다.

```bash
npm run render:request -- --input /tmp/render-input.json --output /tmp/reel.mp4
```

## 어드민 미리보기

`admin-web` 이 `src/PromoReel.tsx` 를 `@remotion/player` 로 그대로 틀어 mp4 인코딩 없이 미리보기를 보여줍니다. 그래서:

- `admin-web/package.json` 의 `remotion` / `@remotion/player` 버전은 이 패키지의 `remotion` 과 **정확히 같아야** 합니다 (Remotion 은 패키지 간 버전 불일치를 거부).
- `PromoReel.tsx` 는 `remotion` 과 `react` 외의 의존성을 추가하면 안 됩니다. `../../app-rn/src/utils/readingConverter` 처럼 import 가 없는 순수 TS 파일만 가져오세요.
- 릴스 폰트는 에스코어 드림(`src/fonts/SCDream{4..8}.woff2`, weight 400~800)이다. `src/fonts/scoreDream.ts` 가 `FontFace` 로 등록하고 `delayRender` 로 로드를 기다린다 — Remotion 번들러와 Vite 둘 다 `.woff2` import 를 URL 로 내보내서 렌더와 어드민 미리보기가 같은 파일을 쓴다. 에스코어 드림에 없는 일본어는 뒤의 Noto CJK 로 떨어지고, 엔드카드의 앱 목업(`styles.phone`)만 실제 앱과 같은 Noto 스택을 유지한다.
- `song.mvAsset` / `song.artworkAsset` 은 `public/` 파일명 또는 URL(`http…`, `/…`) 둘 다 받습니다. 렌더는 파일명, 미리보기는 admin-api 스트리밍 URL 을 넘깁니다.
- MV 는 맨 위 헤드라인 띠(`HEADLINE_BAND_HEIGHT` 580px) 아래에만 보인다. 기본 자리는 띠 아래부터 `MV_AREA_BOTTOM`(1560)까지로, 그 아래 인스타 프로필·캡션 자리는 비워 둔다. 어드민이 `mvFrame` 으로 키우거나 옮기면 캔버스 끝까지 보인다. `mvFrame`(`{scale, x, y, crop?}`, 없으면 그 영역 cover)이 있으면 MV 를 `crop`(각 변 비율, CSS `object-view-box` — Chromium 전용)만큼 잘라낸 뒤 폭 `1080 × scale` 로 줄이거나 키워 영역 가운데에서 `x/y` px 옮기고, 빈 곳은 검게 남는다. `mvKeyframes`(`[{startFrame, mvFrame}]`, `mvFrame` null 은 cover)가 있으면 각 키프레임 프레임부터 그 배치로 전환 없이 바뀐다 — `mvFrame` 은 첫 키프레임 전까지의 배치다. GPU 합성(`scripts/lib/gpu-composite.mjs`)은 배치가 같은 구간마다 MV 를 따로 열어 이어 붙인다. 띠 높이나 영역 바닥을 바꾸면 `admin-web` `reelEditor.ts` 의 `MV_AREA_HEIGHT` 도 같이 바꾼다.
- props 는 어드민 에디터가 브라우저에서 만들고(`admin-web/src/pages/reels-factory/reelEditor.ts`) 렌더 요청에 그대로 실립니다. 첫 줄 `startFrame` 이 0 보다 크면 그 앞은 가사 없이 MV 만 흐릅니다.
- 가사 화면은 그 줄의 원문(작게, 반투명 흰색)을 **전부** 펼친 뒤 한국어 번역(크게, 흰색, `skewX(-8deg)` 로 기울임 — 에스코어 드림엔 이탤릭이 없다)을 붙인다. 어드민이 그 줄에 강조 단어(최대 1개)를 짚었으면 원문의 그 토큰을 품사색으로 칠하고 바로 위에 뜻을 같은 색으로 얹는다 — 단어를 따로 목록으로 빼지 않아 문장을 읽는 시선 안에서 읽힌다. 단어는 어드민이 짚은 줄에만 뜨고, 새 줄은 단어 없이 시작한다. 행은 폭(760)이 넘칠 때만 접힌다 — 원문 공백은 행을 끊지 않고 칸 사이 여백(`SPACE_GAP`)으로만 남는다. 그래서 `lyricScale` 을 낮추면 접히는 자리가 실제로 바뀐다. 줄 전체의 한글 독음은 가사 화면에서 빠졌고(엔드카드 목업에만 남는다), 토큰마다 붙던 품사 바도 없다 — 뜻은 강조 단어 위에만 얹힌다. 그래서 화면에 뜻을 내는 건 `vocabulary` 이고 `tokens[].koreanText` 는 엔드카드 목업에만 쓰인다.

sample 렌더 결과:

- `out/sample-preview.mp4` — VLC/소셜 업로드 호환성을 위해 `yuv420p`, H.264 High level 4.1, AAC로 후처리한 파일
- `out/sample-preview-raw.mp4` — Remotion 1차 산출물
- `out/sample-preview-frame.png`

## Asset contract

sample preview fixture는 `public/` 아래의 예시 asset을 사용합니다.

- `lemon-chorus.mp4` — 후렴 30초 분량의 세로 리프레이밍 소스
- `lemon-cover.jpg` — 곡 커버 이미지

저작권이 있는 MV, 음원, 가사는 공개 홍보물로 업로드하기 전에 마스터·퍼블리싱·동기화·플랫폼 사용 권리 확인이 필요합니다. 이 프로토타입은 렌더링 파이프라인과 화면 구성을 검증하기 위한 내부 시안입니다.

## Data shape

Remotion 컴포지션은 `PromoReelData` 하나를 받습니다. `lyricLines`가 실제 릴스에 노출될 가사 입력입니다. 사용자가 직접 고른 줄이나 자동화가 생성한 줄을 이 배열로 넘기면 됩니다.

- `song`: 제목, 아티스트, 발매연도, 커버, MV asset 이름
- `headline`: 화면 맨 위 띠에 찍히는 헤드라인. 어드민이 직접 쓴다 — 줄바꿈이 줄을 나누고 `<b>…</b>` 로 감싼 구간에만 형광 초록 배경(`#1FF2A4`)이 깔린다
- `headlineFontSize`: 헤드라인 글자 크기(px, 기본 76, 어드민이 48~110 으로 정한다). 엔드카드 헤드라인은 고정 문구라 늘 기본 크기다
- `headlineOffsetY`: 계정명·헤드라인을 기본 자리에서 위아래로 옮기는 px(+ 가 아래, 기본 0, 어드민이 −300~300 으로 정한다). 글자만 옮기고 띠 높이는 그대로다
- `instagramHandle`: 헤드라인 띠의 헤드라인 바로 위, 엔드카드 오른쪽 위에 찍히는 계정명
- `catchphrase`: 엔드카드 카피
- `sourceStartFrame`: 원본 MV/음원을 어느 프레임부터 재생할지
- `mvFrame` / `mvKeyframes`: MV 배치와 그 배치를 바꾸는 키프레임(위 어드민 미리보기 항목 참고)
- `lyricScale`: 가사 원문 글자 배율(기본 1, 어드민이 0.6~1.4 로 정한다). 자동 축소 위에 곱해진다
- `lyricOffsetY`: 가사 블록 전체를 기본 자리에서 위아래로 옮기는 px(+ 가 아래, 기본 0, 어드민이 −600~300 으로 정한다)
- `lyricsEndFrame`: 마지막 줄이 끝나는 프레임. 여기서부터 엔드카드(210f, 7초)가 붙고, 컴포지션 길이는 `calculateMetadata` 가 `lyricsEndFrame + 210` 으로 정한다
- `totalLineCount`: 곡 전체 줄 수. 엔드카드 앱 목업의 이해도 `0 / N줄` 표시용
- `lyricLines`: 프레임 기준 싱크(`startFrame`), 곡 안 줄 번호(`lineNumber`), 일본어 원문, 한국어 번역, 토큰, N5/N4 단어

인스타 플레이리스트 릴스 형식을 따른다. 맨 위 0–580 은 검정 단색 띠로, 계정명과 헤드라인이 300 아래에 앉는다 — 피드 미리보기(4:5, 위아래 285 잘림)와 프로필 그리드(3:4, 240 잘림) 썸네일 안에 헤드라인이 남아야 하기 때문이다. 헤드라인이 길면 띠가 아래로 늘어나 MV 윗부분을 덮는다. 곡 표기(`SongLabel`)는 썸네일에서 잘려도 되는 정보라 띠 맨 위(152–232, 인스타 상단 UI 바로 아래)에 둔다 — 왼쪽 정렬, 초록 막대 옆에 곡명·아티스트 두 줄. MV 위 가운데 아래쪽에 가사와 강조 단어, 1576 에 프로필 큐가 온다. 띠 위 헤드라인은 외곽선이 없다. 띠 아래에는 가리는 판이 없으므로 글자는 1~2px 의 얇은 검은 외곽선(`outline`)과 오른쪽 아래로 떨어지는 단단한 그림자로 띄운다 — 두껍게 하면 글자가 뭉개져 스티커처럼 보인다. `outline` 인자는 바깥 두께고 CSS `-webkit-text-stroke` 가 가운데 정렬이라 두 배를 주고 `paint-order` 로 획을 글자 뒤에 깐다.

줄 전환은 `startFrame` 을 그대로 따른다 — 현재 프레임에 시작해 있는 마지막 줄이 화면에 보인다. 균등 분할이 아니다.

강조 단어는 가사 원문의 그 토큰과 위에 얹은 뜻을 품사색(`spotlightColors`, 앱 품사색을 MV 위에서 보이게 밝힌 것 — 명사·동사·형용사·な형용사·부사, 그 밖은 명사색)으로 칠한다. 색은 원문에서 짚은 토큰의 품사를 따른다. 나머지 원문 글자는 반투명 흰색(`softInk`)이다.

`vocabulary` 는 기본형만 들고 오므로, 원문에서 어느 토큰을 짚을지 되돌린다 — 줄 앞에서부터 아직 안 쓰인 토큰에 기본형이 같은 것을 하나씩 맞춘다. 한 줄에 같은 기본형이 두 번 나오면 앞의 것이 짚인다.

가사 원문이 세 행을 넘기면 `TOKEN_SCALES` 로 한 단계씩(1 → 0.86 → 0.74 → 0.64) 줄인다 — `Content` 영역(1200–1516)에서 번역이 먹는 높이를 뺀 나머지(뜻 한 줄 포함)가 예산이고, 넘치면 위로 자란다. 어드민이 정한 `lyricScale` 은 이 자동 단계 위에 곱해지므로, 키워도 긴 줄은 한 단계 더 접혀 화면 안에 남는다. 배율을 낮추면 한 행에 더 많은 칸이 들어가 개행 위치를 어드민이 직접 잡을 수 있다. 번역과 단어 뜻은 `wordBreak: keep-all` 이라 어절 경계에서만 접힌다 — 안 그러면 한글이 글자 단위로 쪼개진다.

강조 단어의 뜻은 분석 결과가 기본이고, 어드민이 `admin-web` 인스펙터에서 고쳐 쓴 값이 실려 온다.

엔드카드는 바로 아래 가사 화면(마지막 줄에서 멈춘 그림)을 `backdrop-filter` 로 블러해 배경으로 쓴다. 스토어 큐 아래는 night 단색 블록이 아니라 그라데이션(`bottomScrim`)이라 화면 아래에 검은 띠가 생기지 않는다. 헤드라인(`전체 단어는` / `코토노하 앱에서`)은 브랜드 CTA 라 어드민 입력이 아니라 `PromoReel.tsx` 의 `END_CARD_HEADLINE` 에 고정이고, 표기 규칙(`<b>`)은 상단 헤드라인과 같다.

엔드카드의 폰 목업은 실제 앱 화면을 코드로 다시 그린 것이다 — `SongDetailScreen` 홈 탭(이해도·완곡까지 3단계, 곡을 처음 연 사람 기준이라 0%·첫 단계 펼침) → MV 바를 핸들로 `CurrentPlayingWordsSheet` 가사 다이얼이 올라옴 → 포커스 줄의 단어 탭 → `SongReviewScreen` 앞면 → 뜻 확인 pill 이 rating 넷으로 갈라짐 → rating 홀드 pill(`N일 뒤에 다시 만나요`) → 다음 단어. 다이얼 포커스는 두 번째 줄부터 누를 단어가 있는 첫 줄이고, 복습 큐는 그 줄부터의 내용어 토큰이다. 앱 UI 가 바뀌면 `PromoReel.tsx` 의 목업도 같이 고친다. 화면 전환은 하드컷이고, 움직임은 앱의 애니메이션 길이를 30fps 로 옮긴 것이다.

어드민 자동화 단계에서는 DB에서 `raw_content`, `analyzed_content`를 읽어 사용자가 선택한 줄만 `lyricLines`로 조립합니다. 헤드라인은 서버가 기본 문구만 내려주고 어드민이 에디터에서 고쳐 쓰며, 어드민이 올린 MV mp4 를 source 로 렌더해 direct MP4 download로 반환합니다.
