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

## Flow

1. Android dev OTA 확인

```bash
cd app-rn
BUILD_ENV=dev EAS_UPDATE_CHANNEL=development \
  eas update --channel development --message "dev ota smoke"
```

2. Prod RC OTA 확인

```bash
git tag v1.2.3-rc.1
git push origin v1.2.3-rc.1

cd app-rn
BUILD_ENV=prod EAS_UPDATE_CHANNEL=production-rc \
  eas update --channel production-rc --message "1.2.3 rc ota smoke"
```

3. 정식 production OTA 확인

```bash
git tag v1.2.3
git push origin v1.2.3

cd app-rn
eas build --profile production --platform ios

BUILD_ENV=prod EAS_UPDATE_CHANNEL=production \
  eas update --channel production --message "1.2.3 production ota smoke"
```

4. 문제 없으면 심사 제출. 이후 JS-only hotfix는 `production`에 OTA 배포

```bash
cd app-rn
BUILD_ENV=prod EAS_UPDATE_CHANNEL=production \
  eas update --channel production --message "hotfix ..."
```

## Check

- 앱 완전 종료 후 재시작.
- 설정 화면 하단의 `JS <id>`가 `내장`이 아니면 OTA bundle이 실행 중이다.
- prod OTA는 `BUILD_ENV=prod EAS_UPDATE_CHANNEL=<channel>`을 명시한다.
- OTA 후 Sentry 소스맵 업로드.
