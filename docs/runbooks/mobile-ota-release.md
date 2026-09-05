# Mobile OTA Release

목표: iOS EAS build는 네이티브 런타임이 바뀔 때만 쓰고, JS-only 변경은 `eas update`로 검증/배포한다.

## Channels

| Channel | 용도 |
|---|---|
| `development` | Android dev APK OTA 확인 |
| `production-rc` | prod 설정 RC OTA 확인 |
| `production` | 정식 바이너리/사용자 OTA 배포 |

## Rules

- `eas build --platform ios ...`는 iOS EAS build 한도를 쓴다.
- Android CD는 로컬 Gradle 빌드라 EAS Build 한도를 쓰지 않는다.
- `eas update --channel ...`는 EAS Build 한도를 쓰지 않는다.
- 정식 바이너리를 새로 만들면 `production` OTA를 iOS/Android에서 다시 확인한다.

## GitHub Actions OTA deploy

JS OTA 전용 태그를 push하면 **Deploy EAS Update** 워크플로가 자동 실행된다. 네이티브
릴리스 태그(`v1.2.3`)는 Android/iOS 빌드만 실행하고 OTA를 배포하지 않는다. 업데이트
메시지는 JS 태그와 태그가 가리키는 커밋의 전체 SHA이며, 각 업데이트 뒤 해당 `dist/`
산출물의 Sentry 소스맵도 업로드한다.

| 태그 | OTA 채널 |
|---|---|
| `js-v1.0.0-dev.1` | `development` |
| `js-v1.0.0-rc.1` | `production-rc` |
| `js-v1.0.0` | `production` |

JS 버전은 네이티브 버전과 독립적으로 증가한다. 설정 화면의 `JS <id>`는 EAS가 생성한
update UUID이지 이 태그 버전은 아니다.

필요한 GitHub Actions secrets:

- `EXPO_TOKEN`
- `BACKEND_URL`, `GOOGLE_OAUTH_WEB_CLIENT_ID` (development)
- `PROD_BACKEND_URL`, `PROD_GOOGLE_OAUTH_WEB_CLIENT_ID` (production-rc/production)
- `SENTRY_DSN_APP`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT_APP`

## Manual fallback

1. Android dev OTA 확인

```bash
cd app-rn
BUILD_ENV=dev EAS_UPDATE_CHANNEL=development \
  eas update --channel development --message "dev ota smoke"
```

2. Prod RC OTA 확인

```bash
git tag js-v1.0.0-rc.1
git push origin js-v1.0.0-rc.1

# GitHub Actions가 production-rc OTA와 Sentry 소스맵 업로드를 자동 수행
```

3. 정식 production OTA 확인

```bash
git tag js-v1.0.0
git push origin js-v1.0.0

# GitHub Actions가 production OTA와 Sentry 소스맵 업로드를 자동 수행
```

4. 문제 없으면 심사 제출. 이후 JS-only hotfix는 새 JS 태그로 production OTA 배포

```bash
git tag js-v1.0.1
git push origin js-v1.0.1
```

## Check

- 앱 완전 종료 후 재시작.
- 설정 화면 하단의 `JS <id>`가 `내장`이 아니면 OTA bundle이 실행 중이다.
- prod OTA는 `BUILD_ENV=prod EAS_UPDATE_CHANNEL=<channel>`을 명시한다.
- OTA 후 Sentry 소스맵 업로드.
