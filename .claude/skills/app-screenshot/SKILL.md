---
name: app-screenshot
description: app-rn 프론트엔드 작업 결과를 expo web + Playwright 로 띄워 폰 크기 스크린샷을 찍는다. dev 계정으로 로그인하고, 보여 줄 상태가 dev DB 에 없으면 API 응답만 브라우저에서 가짜로 돌려준다. "스크린샷 보여줘", "화면 찍어줘", "UI 확인", "어떻게 보이는지" 요청 시 사용.
---

# App Screenshot

변경한 화면을 웹으로 띄워 찍는다. 결과는 PNG 경로로 넘긴다(유저는 내가 Read 로 본 이미지를 못 본다).

## 1. 웹 서버

여러 워크트리가 동시에 찍으므로 포트를 고정하지 않는다. 이 워크트리 `app-rn/` 에서 뜬 서버가 있으면 그 포트를 쓰고, 없으면 빈 포트를 골라 백그라운드로 띄운다.

```bash
# 이 워크트리 서버 찾기: 비어 있지 않으면 그 포트를 쓴다
for pid in $(ss -ltnp | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
  [ "$(readlink /proc/$pid/cwd)" = "$PWD" ] && ss -ltnp | grep "pid=$pid," | grep -o ':80[0-9][0-9] ' ; done
# 없으면 빈 포트로 띄운다
PORT=$(for p in $(seq 8090 8199); do ss -ltn | grep -q ":$p " || { echo $p; break; }; done)
EXPO_PUBLIC_FIREBASE_DISABLED=1 BROWSER=none npx expo start --web --port $PORT < /dev/null > <scratchpad>/expo.log 2>&1
```

- `EXPO_PUBLIC_FIREBASE_DISABLED=1` 이 없으면 `No Firebase App '[DEFAULT]'` 로 하얀 화면만 나온다.
- `CI=1` 을 붙이지 않는다. Metro 가 파일 감시를 끄고 옛 번들을 계속 준다.
- 준비는 로그의 `Waiting on http://localhost:<PORT>` 로 판단한다.
- 서버를 끌 때 `pkill -f "expo start ..."` 는 그 명령을 돌리는 셸까지 죽인다. `ss -ltnp | grep :<PORT>` 로 pid 를 찾아 kill 한다. 다른 워크트리의 서버는 끄지 않는다.

## 2. 로그인

웹에선 Google 로그인을 못 한다. dev 유저 토큰을 만들어 localStorage 에 넣는다.

```bash
.claude/skills/app-screenshot/mint-dev-jwt.sh <userId> <name>
```

유저는 dev DB 에서 고른다(`kubectl -n main exec mysql-0 -- sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" japanese_vocabulary -e "..."'`). 보여 줄 화면에 필요한 데이터(덱, 카드 등)가 있는 유저를 고른다.

## 3. 찍기

`browser_run_code_unsafe` 한 번에 상태 준비부터 촬영까지 한다.

```js
async (page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // 필요할 때만: dev DB 에 없는 상태는 응답만 가짜로 준다. DB 는 고치지 않는다.
  await page.route('**/api/reward-cards/pending', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reveals: [] }) }));
  await page.goto('http://localhost:<PORT>');
  await page.evaluate((t) => {
    localStorage.setItem('jwt_token', t);
    localStorage.setItem('user_name', '<name>');
    localStorage.setItem('username', '<name>');
  }, '<token>');
  await page.reload();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '.playwright-mcp/<name>.png' });
}
```

- Playwright MCP 는 `--isolated --headless` 로 등록돼 있어야 세션마다 창 없이 따로 브라우저를 띄운다. `Browser is already in use` 가 나면 등록에서 빠진 것이니 `claude mcp get playwright` 로 확인한다. 브라우저를 닫으면 localStorage 가 사라지니 매번 토큰을 넣는다.
- 저장 경로는 워크트리 안이어야 한다(Playwright MCP 가 그 밖은 막는다). `.playwright-mcp/` 에 둔다.
- 부분만 볼 땐 `clip`, 세밀하게 볼 땐 `scale: 'device'`.
- 애니메이션은 짧은 간격으로 여러 장 찍어 md5 로 프레임이 바뀌는지 본다.
- 코드를 고친 뒤엔 `page.reload()` 만 하면 된다. 반영이 안 되면 번들에 새 식별자가 있는지 확인한다.

## 지킬 것

- 쓰기 요청(서명, 리뷰, 저장)을 일으키는 버튼은 누르지 않는다. dev 서버에 실제로 기록된다.
- 가짜로 준 응답은 결과 보고에 밝힌다.
