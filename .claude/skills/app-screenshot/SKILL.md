---
name: app-screenshot
description: app-rn 프론트엔드 작업 결과를 expo web + Playwright 로 띄워 폰 너비 스크린샷을 찍는다. 기본은 preview 빌드에 바꾼 컴포넌트를 케이스별 props 로 늘어놓아 한 장에 담는다(로그인·dev 데이터 불필요). "스크린샷 보여줘", "화면 찍어줘", "UI 확인", "어떻게 보이는지" 요청 시 사용.
---

# App Screenshot

목적은 이번 작업이 바꾼 디자인을 보여 주는 것이다. dev 계정에 그 상태가 있는지 찾거나 API 응답을 꾸미지 않고, 바꾼 컴포넌트를 케이스별로 직접 그려 찍는다. 결과는 PNG 경로로 넘기고(유저는 내가 Read 로 본 이미지를 못 본다), 유저가 열어 달라면 `xdg-open`.

## 1. 케이스 파일

`app-rn/src/preview/<작업>.local.tsx` 에 `PreviewCase[]` 를 default export 한다. `*.local.tsx` 는 gitignore 라 커밋되지 않는다.

```tsx
import type { PreviewCase } from './PreviewApp';

const cases: PreviewCase[] = [
  { name: '진행 중', render: () => <Banner state="progress" ... /> },
  { name: '받기', render: () => <Banner state="claim" ... /> },
];
export default cases;
```

- 이번 변경이 갈라지는 상태(빈 값·긴 글·등급·활성/비활성 등)를 빠짐없이 한 케이스씩 넣는다. 이름은 화면에 그대로 찍힌다.
- props 만 받는 컴포넌트를 그린다. 내부 컴포넌트면 export 를 더한다. store·navigation 에 기대는 상위 화면은 그리지 않는다.
- 카드 아트·곡 같은 그럴듯한 값은 `components/rewardCards/dummyRewardCards.ts` 같은 기존 더미를 쓴다.
- 이전 작업의 `*.local.tsx` 가 남아 있으면 지운다. 전부 한 화면에 그려진다.

## 2. preview 서버

`EXPO_PUBLIC_PREVIEW` 는 번들에 박히므로 앱 모드로 떠 있는 서버는 못 쓴다. 빈 포트로 따로 띄우고 끝나면 끈다. 여러 워크트리가 동시에 찍으니 포트를 고정하지 않는다.

```bash
PORT=$(for p in $(seq 8090 8199); do ss -ltn | grep -q ":$p " || { echo $p; break; }; done)
EXPO_PUBLIC_PREVIEW=1 BROWSER=none npx expo start --web --port $PORT < /dev/null > <scratchpad>/expo.log 2>&1   # run_in_background
```

- 준비는 로그의 `Waiting on http://localhost:<PORT>` 로 판단한다.
- `CI=1` 을 붙이지 않는다. Metro 가 파일 감시를 끄고 옛 번들을 계속 준다.
- 끌 때 `pkill -f "expo start ..."` 는 그 명령을 돌리는 셸까지 죽인다. `ss -ltnp | grep :<PORT>` 로 pid 를 찾아 kill 한다. 다른 워크트리 서버는 건드리지 않는다.

## 3. 찍기

`browser_run_code_unsafe` 로 케이스 전체를 한 장에 담는다.

```js
async (page) => {
  // RN ScrollView 는 안에서 스크롤돼 fullPage 가 안 먹는다. 높게 띄우고 마지막 케이스까지 자른다.
  await page.setViewportSize({ width: 390, height: 3000 });
  await page.goto('http://localhost:<PORT>');
  await page.waitForSelector('[id^="case-"]', { timeout: 120000 });
  await page.waitForTimeout(3000);
  const bottom = await page.evaluate(() => Math.max(...[...document.querySelectorAll('[id^="case-"]')].map(e => e.getBoundingClientRect().bottom)));
  await page.screenshot({ path: '<worktree>/.playwright-mcp/<작업>.png', clip: { x: 0, y: 0, width: 390, height: Math.ceil(bottom) + 16 }, scale: 'device' });
}
```

- Playwright MCP 는 `--isolated --headless` 로 등록돼 있어야 세션마다 창 없이 따로 뜬다. 창이 뜨거나 `Browser is already in use` 가 나면 `claude mcp get playwright` 로 확인하고, 설정을 바꾼 뒤엔 `/mcp` 재연결이 필요하다고 유저에게 알린다.
- 저장 경로는 워크트리 안이어야 한다(MCP 가 그 밖은 막는다).
- 코드를 고친 뒤엔 `page.reload()` 만 하면 된다.
- 애니메이션은 짧은 간격으로 여러 장 찍어 md5 로 프레임이 바뀌는지 본다.

## 화면 흐름을 봐야 할 때만: 실제 앱

화면 사이 이동·스크롤 위치·실데이터 배치가 작업 내용일 때만 앱 모드로 띄운다. `EXPO_PUBLIC_PREVIEW` 대신 `EXPO_PUBLIC_FIREBASE_DISABLED=1` 로 서버를 띄우고(없으면 `No Firebase App '[DEFAULT]'` 하얀 화면), dev 유저 토큰을 localStorage 에 넣는다.

```bash
.claude/skills/app-screenshot/mint-dev-jwt.sh <userId> <name>   # localStorage: jwt_token, user_name, username
```

- 쓰기 요청(서명, 리뷰, 저장)을 일으키는 버튼은 누르지 않는다. dev 서버에 실제로 기록된다.
