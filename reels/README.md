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
- props 는 어드민 에디터가 브라우저에서 만들고(`admin-web/src/pages/reels-factory/reelEditor.ts`) 렌더 요청에 그대로 실립니다. 첫 줄 `startFrame` 이 0 보다 크면 그 앞은 가사 없이 MV 만 흐르고, `vocabulary` 가 빈 줄은 단어 블록을 그리지 않습니다.

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
- `headline`: 가사를 요약하는 한국어 헤드라인
- `instagramHandle`: MV 영역에 노출할 계정명
- `catchphrase`: 엔드카드 카피
- `sourceStartFrame`: 원본 MV/음원을 어느 프레임부터 재생할지
- `lyricsEndFrame`: 마지막 줄이 끝나는 프레임. 여기서부터 엔드카드(210f, 7초)가 붙고, 컴포지션 길이는 `calculateMetadata` 가 `lyricsEndFrame + 210` 으로 정한다
- `totalLineCount`: 곡 전체 줄 수. 엔드카드 앱 목업의 `n/전체` 표시용
- `lyricLines`: 프레임 기준 싱크(`startFrame`), 곡 안 줄 번호(`lineNumber`), 일본어 원문, 한국어 번역, 토큰, N5/N4 단어

줄 전환은 `startFrame` 을 그대로 따른다 — 현재 프레임에 시작해 있는 마지막 줄이 화면에 보인다. 균등 분할이 아니다.

가사 줄에서는 강조 단어(`vocabulary`)만 품사색을 갖고 나머지 토큰은 흰색이다(pen `Reel v2` 프레임).

- 명사 `#5BA9FF`
- 동사 `#3FE0A1`
- 형용사 `#FFB347`
- な형용사 `#FF8FB3`
- 부사 `#C49BFF`

엔드카드의 폰 목업은 실제 앱 화면(`SongDetailScreen` → `CurrentPlayingWordsSheet` → 단어 탭 → `SongReviewScreen` 앞면/뒷면/rating/스와이프)을 코드로 다시 그린 것이다. 앱 UI 가 바뀌면 `PromoReel.tsx` 의 목업도 같이 고친다. 전환은 자막처럼 하드컷이고 움직임은 시트 상승과 카드 스와이프 둘뿐이다(스프링·페이드 없음).

어드민 자동화 단계에서는 DB에서 `raw_content`, `analyzed_content`를 읽어 사용자가 선택한 줄만 `lyricLines`로 조립합니다. 현재 MVP는 analyzed lyric 기반 deterministic headline을 사용하고, 어드민이 올린 MV mp4 를 source 로 렌더해 direct MP4 download로 반환합니다.
