# 서비스 소개 랜딩 (landing-web)

`https://kotonoha.eastshine.dev/` 의 소개 페이지. 앱 기능은 없고 소개와 스토어 링크만 있다.

- 빌드 단계 없는 정적 HTML/CSS/JS(`landing-web/public/`)를 nginx 가 서빙한다. 크롤러가 JS 없이 본문을 다 읽게 하려는 선택이다.
- prod 라우팅: `k8s/prod/admin/ingress.yaml` 의 `landing` IngressRoute 가 같은 호스트의 나머지 경로를 priority 1 로 받는다. `/admin`, `/c/`, `/share-assets/`, 앱 링크 검증 파일은 더 높은 priority 라 그대로다. http 는 acme-challenge 를 빼고 https 로 넘긴다.
- dev: `http://localhost/<ns>/landing/`.
- `/get` 은 nginx 가 UA 로 App Store / Google Play 로 넘긴다(데스크톱은 `#download`). 다운로드 섹션 QR 코드가 이 주소다.
- 기능 설명의 기준은 앱 코드(`app-rn/`)와 `docs/` 다.
- 화면 속 곡·가사는 창작 예시다. 실제 가사나 실제처럼 보이는 식별자(노래방 번호 등)를 넣지 않는다.
- 색·서체·움직임의 이유는 `landing-web/DESIGN.md`.

## 로컬 확인

```bash
python3 -m http.server -d landing-web/public 8000   # http://localhost:8000
```

`/get` 리다이렉트와 404 페이지는 nginx 에서만 동작한다: `docker build -t landing-web landing-web && docker run --rm -p 8000:80 landing-web`.

## 에셋 다시 만들기

- OG 이미지: `cd landing-web && rsvg-convert -w 1200 -h 630 og/og.svg -o public/assets/og.png`
- QR: `qrencode -t SVG -m 1 -l M --rle -o landing-web/public/assets/qr.svg https://kotonoha.eastshine.dev/get`
- 아이콘은 `app-rn/assets/icon.png` 를 `magick` 으로 줄인 것.

CSS/JS 를 고치면 `index.html` 의 `?v=` 를 올린다(1시간 캐시). 본문을 고치면 `sitemap.xml` 의 `lastmod` 도 바꾼다.

## 검색 노출 (배포 후 한 번)

- Google Search Console 과 네이버 서치어드바이저에 `https://kotonoha.eastshine.dev/` 를 등록하고 `sitemap.xml` 을 제출한다. 소유 확인은 DNS TXT 레코드가 깔끔하다(Cloudflare DNS 는 `infra/terraform` 이 관리).
- FAQ 는 화면의 `<details>` 와 `FAQPage` JSON-LD 가 같은 문장이어야 한다. 하나를 고치면 둘 다 고친다.
