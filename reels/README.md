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
- `mvFrame`(`{scale, x, y, crop?}`, 없으면 cover)이 있으면 MV 를 `crop`(각 변 비율, CSS `object-view-box` — Chromium 전용)만큼 잘라낸 뒤 폭 `1080 × scale` 로 줄이거나 키워 가운데에서 `x/y` px 옮기고, 빈 곳엔 같은 MV 를 같은 `sourceStartFrame` 부터 블러해서 깐다. 릴스 전체에 고정된 값이다.
- props 는 어드민 에디터가 브라우저에서 만들고(`admin-web/src/pages/reels-factory/reelEditor.ts`) 렌더 요청에 그대로 실립니다. 첫 줄 `startFrame` 이 0 보다 크면 그 앞은 가사 없이 MV 만 흐릅니다.
- 가사 화면은 그 줄의 토큰을 **전부** 펼친다. 한 토큰이 원문 · 품사 바 · 뜻 한 칸이고, 행은 폭(760)이 넘칠 때만 접힌다 — 원문 공백은 행을 끊지 않고 칸 사이 여백(`SPACE_GAP`)으로만 남는다. 그래서 `lyricScale` 을 낮추면 접히는 자리가 실제로 바뀐다. 독음은 칸마다 얹지 않고 줄 아래에 한 줄로만 붙는다. 그래서 `tokens[].koreanText` 가 화면을 채우고 `tokens[].reading` 은 줄 독음을 만든다 — 조사·조동사·기호는 뜻 칸을 비우고 원문만 내보낸다(분석 결과에 룰 기반 뜻이 있어도 쓰지 않는다). `vocabulary` 는 이제 가사 화면이 아니라 엔드카드 목업(핵심 단어 · 단어 수)에만 쓰인다.

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
- `headline`: 화면 맨 위 띠에 찍히는 헤드라인. 어드민이 직접 쓴다 — 줄바꿈이 줄을 나누고 `<b>…</b>` 로 감싼 구간에만 초록 배경(`#A5EBC7`)이 깔린다
- `headlineFontSize`: 헤드라인 글자 크기(px, 기본 76, 어드민이 48~110 으로 정한다). 엔드카드 헤드라인은 고정 문구라 늘 기본 크기다
- `instagramHandle`: 헤드라인 띠와 엔드카드 오른쪽 위에 찍히는 계정명
- `catchphrase`: 엔드카드 카피
- `sourceStartFrame`: 원본 MV/음원을 어느 프레임부터 재생할지
- `lyricScale`: 가사 원문 글자 배율(기본 1, 어드민이 0.6~1.4 로 정한다). 자동 축소 위에 곱해진다
- `lyricsEndFrame`: 마지막 줄이 끝나는 프레임. 여기서부터 엔드카드(210f, 7초)가 붙고, 컴포지션 길이는 `calculateMetadata` 가 `lyricsEndFrame + 210` 으로 정한다
- `totalLineCount`: 곡 전체 줄 수. 엔드카드 앱 목업의 `n/전체` 표시용
- `lyricLines`: 프레임 기준 싱크(`startFrame`), 곡 안 줄 번호(`lineNumber`), 일본어 원문, 한국어 번역, 토큰, N5/N4 단어

MV 는 캔버스를 그대로 채우고 그 위에 글자만 얹는다 — 띠도 스크림도 없다. 캔버스 바탕이 `#111012` 라 MV 를 줄이거나 옮겨 생긴 자리는 알아서 검게 남는다. 맨 위에 곡 표기·워터마크·헤드라인, 가운데에 가사, 1576 에 프로필 큐가 온다. 가리는 판이 없으므로 글자는 저마다 블러 0 의 단단한 그림자(2–5px)로 띄우고, 가사 원문 토큰에는 검은 외곽선까지 더한다.

줄 전환은 `startFrame` 을 그대로 따른다 — 현재 프레임에 시작해 있는 마지막 줄이 화면에 보인다. 균등 분할이 아니다.

가사 토큰 아래 품사 바는 뜻이 있는 칸에만 그린다. 내용어 다섯 품사는 아래 색을 쓰고, 뜻은 있지만 Spotlight 색이 없는 품사(대명사·표현 등)는 중립 밑줄(`#FAFAF659`)이다. 조사·조동사·기호는 뜻도 밑줄도 없고 원문 글자만 한 단계 흐리다. 색은 앱의 파스텔 Spotlight 대신 pen `Reel v2` 가 쓴 진한 값이다 — MV 위에서 7px 바가 묻히면 안 된다. な형용사·부사는 pen 에 샘플이 없어 앱 색을 같은 채도로 올려 맞췄다.

- 명사 `#1F7AFF`
- 동사 `#00C56B`
- 형용사 `#FF8A00`
- な형용사 `#FF5C9E`
- 부사 `#A86BFF`

토큰 스택이 `Content` 영역(1010–1516)보다 높아지면 `TOKEN_SCALES` 로 한 단계씩(1 → 0.86 → 0.74 → 0.64) 줄인다. 어드민이 정한 `lyricScale` 은 이 자동 단계 위에 곱해지므로, 키워도 긴 줄은 한 단계 더 접혀 화면 안에 남는다. 배율을 낮추면 한 행에 더 많은 칸이 들어가 개행 위치를 어드민이 직접 잡을 수 있다. 줄 아래에는 그 줄 전체의 한글 독음(`convertLineReading`)이 번역보다 흐린 타이포로 먼저 오고 그 아래 번역이 붙는다. 둘 다 `wordBreak: keep-all` 이라 어절 경계에서만 접힌다 — 안 그러면 한글이 글자 단위로 쪼개진다.

뜻 칸을 갖는 토큰의 뜻은 분석 결과가 기본이고, 어드민이 `admin-web` 인스펙터에서 칸마다 고쳐 쓴 값이 `tokens[].koreanText` 로 실려 온다.

엔드카드는 바로 아래 가사 화면(마지막 줄에서 멈춘 그림)을 `backdrop-filter` 로 블러해 배경으로 쓴다. 스토어 큐 아래는 night 단색 블록이 아니라 그라데이션(`bottomScrim`)이라 화면 아래에 검은 띠가 생기지 않는다. 헤드라인(`전체 단어는` / `코토노하 앱에서`)은 브랜드 CTA 라 어드민 입력이 아니라 `PromoReel.tsx` 의 `END_CARD_HEADLINE` 에 고정이고, 표기 규칙(`<b>`)은 상단 헤드라인과 같다.

엔드카드의 폰 목업은 실제 앱 화면(`SongDetailScreen` → `CurrentPlayingWordsSheet` → 단어 탭 → `SongReviewScreen` 앞면/뒷면/rating/스와이프)을 코드로 다시 그린 것이다. 앱 UI 가 바뀌면 `PromoReel.tsx` 의 목업도 같이 고친다. 전환은 자막처럼 하드컷이고 움직임은 시트 상승과 카드 스와이프 둘뿐이다(스프링·페이드 없음).

어드민 자동화 단계에서는 DB에서 `raw_content`, `analyzed_content`를 읽어 사용자가 선택한 줄만 `lyricLines`로 조립합니다. 헤드라인은 서버가 기본 문구만 내려주고 어드민이 에디터에서 고쳐 쓰며, 어드민이 올린 MV mp4 를 source 로 렌더해 direct MP4 download로 반환합니다.
