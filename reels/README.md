# Kotonoha Reels Prototype

Remotion 기반의 9:16 숏폼 홍보 영상 시안입니다. 현재 기본값은 프로덕션 DB의 `songs.id=1` / `Lemon` 가사 분석 스냅샷을 `src/data/lemon.ts`에 둔 예시이며, 실제 렌더에서는 릴스에 넣을 lyric line 배열을 props로 입력하는 구조입니다.

## Commands

```bash
npm install
npm run dev
npm run check
npm run render:lemon
npm run still:lemon
```

외부 입력으로 렌더할 때는 Remotion의 `--props`에 `PromoReelData` JSON 파일을 넘깁니다.

```bash
npx remotion render PromoReel out/custom-promo.mp4 --props=./path/to/props.json
```

렌더 결과:

- `out/lemon-promo.mp4` — VLC/소셜 업로드 호환성을 위해 `yuv420p`, H.264 High level 4.1, AAC로 후처리한 파일
- `out/lemon-promo-raw.mp4` — Remotion 1차 산출물
- `out/lemon-cover-frame.png`

## Asset contract

`public/` 아래에 아래 파일이 필요합니다.

- `lemon-chorus.mp4` — 후렴 30초 분량의 세로 리프레이밍 소스
- `lemon-cover.jpg` — 곡 커버 이미지
- `kotonoha-icon.png` — 앱 아이콘 / 엔드카드 로고

저작권이 있는 MV, 음원, 가사는 공개 홍보물로 업로드하기 전에 마스터·퍼블리싱·동기화·플랫폼 사용 권리 확인이 필요합니다. 이 프로토타입은 렌더링 파이프라인과 화면 구성을 검증하기 위한 내부 시안입니다.

## Data shape

Remotion 컴포지션은 `PromoReelData` 하나를 받습니다. `lyricLines`가 실제 릴스에 노출될 가사 입력입니다. 사용자가 직접 고른 줄이나 자동화가 생성한 줄을 이 배열로 넘기면 됩니다.

- `song`: 제목, 아티스트, 발매연도, 커버, MV asset 이름
- `headline`: 가사를 요약하는 한국어 헤드라인
- `instagramHandle`: MV 영역에 노출할 계정명
- `catchphrase`: 엔드카드 카피
- `lyricLines`: 프레임 기준 싱크, 일본어 원문, 한국어 번역, 토큰, N5/N4 단어

앱 프론트와 같은 원칙으로 일본어 토큰을 색상 처리합니다.

- 명사 `#5BA9FF`
- 동사 `#3FE0A1`
- 형용사 `#FFB347`
- な형용사 `#FF8FB3`
- 부사 `#C49BFF`
- 조사/대명사/연체사/보조동사/기호는 흰색

자동화 단계에서는 DB에서 `raw_content`, `analyzed_content`를 읽어 사용자가 선택한 줄만 `lyricLines`로 조립하고, Gemini 등으로 `headline`을 만든 뒤, 권리 확인된 클립/음원만 `public/` 또는 원격 asset으로 연결하면 됩니다.
