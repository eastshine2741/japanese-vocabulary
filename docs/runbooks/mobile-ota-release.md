# Mobile OTA Release

목표: iOS EAS build는 네이티브 런타임이 바뀔 때만 쓰고, JS-only 변경은 `eas update`로 검증/배포한다.

## Channels

| Channel | 용도 |
|---|---|
| `development` | Android dev APK OTA 확인 |
| `production` | 정식 바이너리/사용자 OTA 배포 |

## Rules

- `eas build --platform ios ...`는 iOS EAS build 한도를 쓴다.
- Android CD는 로컬 Gradle 빌드라 EAS Build 한도를 쓰지 않는다.
- `eas update --channel ...`는 EAS Build 한도를 쓰지 않는다.
- 새 native runtime을 출시하기 전에는 해당 runtime의 production JS OTA를 먼저 배포한다.
- 정식 바이너리를 새로 만들면 `production` OTA를 iOS/Android에서 다시 확인한다.

## GitHub Actions OTA deploy

JS OTA 전용 태그를 push하면 **Deploy EAS Update** 워크플로가 자동 실행된다. 네이티브
릴리스 태그(`v1.2.3`)는 Android/iOS 빌드만 실행하고 OTA를 배포하지 않는다. 업데이트
메시지는 JS 태그와 태그가 가리키는 커밋의 전체 SHA이며, 각 업데이트 뒤 해당 `dist/`
산출물의 Sentry 소스맵도 업로드한다.

| 태그 | OTA 채널 |
|---|---|
| `js-v1.0.0-update.1.dev` | `development` |
| `js-v1.0.0-update.1.prod` | `production` |

JS 태그의 `X.X.X`는 대상 네이티브 runtime 버전이고, `update.N`은 그 runtime 위에 올리는
JS OTA revision이다. 마지막 suffix는 배포 환경이며 `dev`는 `development`, `prod`는
`production` 채널로 배포한다. 예를 들어 `js-v1.2.1-update.3.prod`는 native runtime
`1.2.1`에서만 실행되는 세 번째 production OTA다. native `v1.2.1-rc.1`/`v1.2.1` 빌드는
Android CD가 같은 runtime을 자동으로 내장하고, prod 설정 빌드는 둘 다 `production` 채널을
본다. 설정 화면의 `JS <id>`는 EAS가 생성한 update UUID이지 이 태그 버전은 아니다.

`runtimeVersion` 계약이 바뀐 시점 이전의 fingerprint 기반 바이너리는 새 OTA를 받을 수
없다. 이 규칙을 처음 도입할 때는 새 native build를 설치해야 한다. **iOS EAS build는 현재
수동이다** — 태그로 트리거되던 CD - iOS 워크플로는 제거했고, 아래 명령을 직접 돌린다.
빌드 전에 `native-build.json`을 반드시 먼저 생성한다. 이 파일이 없으면 EAS 원격 config
평가가 로컬 shell env를 보지 못해 `runtimeVersion`이 기본값 `1.0.0`으로 돌아가고,
"Runtime version mismatch"로 빌드가 깨진다.

`native-build.json`은 릴리스마다 새로 생성되는 임시 파일이라 git이 무시하지만, EAS cloud
build는 워킹 디렉토리를 tarball로 말아 올리면서 ignore된 파일을 뺀다. 그래서 `app-rn/.easignore`
가 업로드 필터를 대신 맡아 이 파일만 통과시킨다. **`.easignore`가 있으면 EAS는 `.gitignore`를
아예 보지 않으므로**, `.gitignore`에 규칙을 추가할 때 app-rn 하위에 걸리는 것이면 `.easignore`
에도 같이 넣어야 한다. 안 그러면 `.env`나 keystore가 원격 빌드로 업로드된다.

iOS는 태그를 push해도 아무것도 트리거되지 않는다. RC(`v1.2.1-rc.1`)는 EAS build 한도를
아끼려고 아예 만들지 않고, 정식(`v1.2.1`)만 아래처럼 손으로 굽고 App Store Connect에
제출한다.

```bash
cd app-rn
node scripts/write-native-build-config.js 1.2.1 1002001999 1.2.1
BUILD_ENV=prod EAS_UPDATE_CHANNEL=production eas build --profile production --platform ios
```

남은 워크플로(Deploy EAS Update, CD - Android)가 쓰는 GitHub Actions secrets:

- `EXPO_TOKEN`
- `SENTRY_ORG`, `SENTRY_PROJECT_APP`
- `DISCORD_WEBHOOK_URL`

iOS EAS cloud build는 로컬 `.env`나 ignore된 plist를 원격 빌드에 그대로 가져가지 않는다. EAS project의 `production` environment에 최소 아래 값을 둔다.
`GOOGLE_SERVICES_PLIST`는 file type env var로 등록한다.

- `EXPO_PUBLIC_BACKEND_URL`
- `EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_SENTRY_ENVIRONMENT`
- `GOOGLE_SERVICES_PLIST`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## Manual fallback

1. Android dev OTA 확인

```bash
cd app-rn
BUILD_ENV=dev EAS_UPDATE_CHANNEL=development NATIVE_RUNTIME_VERSION=1.2.1 \
  eas update --channel development --message "dev ota smoke"
```

2. Production OTA 확인

```bash
git tag js-v1.0.0-update.1.prod
git push origin js-v1.0.0-update.1.prod

# GitHub Actions가 production OTA와 Sentry 소스맵 업로드를 자동 수행
```

3. 문제 없으면 심사 제출. 이후 JS-only hotfix는 새 JS 태그로 production OTA 배포

```bash
git tag js-v1.0.0-update.2.prod
git push origin js-v1.0.0-update.2.prod

# GitHub Actions가 production OTA와 Sentry 소스맵 업로드를 자동 수행
```

## Check

- 앱 완전 종료 후 재시작.
- 설정 화면 하단의 `JS <id>`가 `내장`이 아니면 OTA bundle이 실행 중이다.
- prod OTA는 `BUILD_ENV=prod EAS_UPDATE_CHANNEL=production`을 명시한다.
- OTA 후 Sentry 소스맵 업로드.
