# Mobile Release (Native + OTA)

목표: 네이티브 변경이 main 에 들어가 있어도, 출시된 바이너리 위로 JS OTA 를 계속 낼 수 있게 한다.

## Branches

| 브랜치 | 역할 |
|---|---|
| `main` | 개발 줄기. 기능 PR 은 전부 여기로 merge commit 머지 |
| `release/X.Y.Z` | 네이티브 버전 X.Y.Z 의 rc·정식 바이너리와 그 runtime 위 OTA 를 책임진다 |

- 네이티브 출시를 시작할 때 main 에서 `release/X.Y.Z` 를 딴다.
- 수정은 release 브랜치에 바로 커밋하고, OTA·정식 태그를 찍은 뒤 release 를 main 으로 머지한다.
- main 의 변경을 OTA 로 내려면 release 브랜치에서 `git merge main` 한다. PR 은 쓰지 않는다.
- 다음 네이티브 버전이 두 스토어에 출시되면 이전 release 브랜치는 지운다.

## Tags (모두 사람이 찍는다)

| 태그 | 찍는 곳 | 실행되는 것 |
|---|---|---|
| `vX.Y.Z-rc.N` | `release/X.Y.Z` | Android APK(dev/prod)+AAB → GitHub prerelease, AAB → Play 내부 테스트 트랙 |
| `vX.Y.Z` | `release/X.Y.Z` | Android AAB → Play 프로덕션(심사 자동 제출), iOS EAS build → TestFlight → 심사 제출 |
| `js-vX.Y.Z-update.N.prod` | `release/X.Y.Z` | production 채널 OTA + Sentry 소스맵 |
| `js-vX.Y.Z-update.N.dev` | 어디든 | development 채널 OTA (dev APK 확인용) |

`js-v` 태그의 `X.Y.Z` 는 대상 네이티브 runtime, `update.N` 은 그 runtime 위 OTA revision 이다.
설정 화면 하단에 `update.N` 으로 표시된다. iOS rc 는 EAS 빌드 한도를 아끼려고 만들지 않는다.

## OTA 가드

`js-v*` 태그 워크플로(Deploy EAS Update)는 배포 전에 아래를 확인하고, 하나라도 어기면 실패한다.

1. prod 는 `vX.Y.Z` 정식 태그가 있어야 한다. 바이너리보다 먼저 올린 OTA 는 내장 번들보다 오래돼 적용되지 않는다.
   dev 는 정식 태그가 없으면 최신 `vX.Y.Z-rc.*` 를 기준으로 삼는다.
2. prod 태그 커밋이 `release/X.Y.Z` 에 있어야 한다.
3. `npm run typecheck` — 업그레이드된 네이티브 라이브러리의 새 API 를 구버전에 쓰는 것을 대부분 잡는다.
4. 네이티브 fingerprint 가 기준 태그와 같아야 한다.

서버 변경에 기대는 OTA 는 main 에서 서버를 먼저 배포한 뒤 낸다 (워크플로가 확인하지 않는다).

## Native compat (fingerprint)

OTA 가드 4번은 `.github/scripts/native-compat/check.sh <base-ref> [head-ref]` 가 맡는다. 두 커밋의
`@expo/fingerprint`(네이티브 모듈 목록·버전, Expo config, config plugin, patches)를 깨끗한 worktree 에서
비교한다. 설정은 `app-rn/fingerprint.config.js` 이고, version·runtimeVersion·`eas.json` 등은 제외한다.

- 실패하면 워크플로 로그에 바뀐 입력이 찍힌다. 머지를 되돌리고 원하는 PR 만 cherry-pick 한다.
- 네이티브 의존을 추가하는 PR 에는 그 기능만 넣는다. 다른 수정이 섞이면 cherry-pick 으로 떼어낼 수 없다.
- 네이티브 모듈 제거나 config plugin 주석 수정도 fingerprint 를 바꾼다 (보수적으로 막힌다).

## Flow

```bash
# 네이티브 출시 시작
git switch -c release/1.2.5 main && git push -u origin release/1.2.5
git tag v1.2.5-rc.1 && git push origin v1.2.5-rc.1
# rc 수정은 release/1.2.5 에 커밋 → v1.2.5-rc.2 ...
git tag v1.2.5 && git push origin v1.2.5          # 스토어 심사 제출까지 자동
git switch main && git merge release/1.2.5

# 출시 후 OTA
git switch release/1.2.5 && git merge main && git push
git tag js-v1.2.5-update.1.prod && git push origin js-v1.2.5-update.1.prod
git switch main && git merge release/1.2.5

# OTA 가드가 fingerprint 로 실패하면: 태그와 머지를 되돌리고 필요한 PR 만 가져온다
git push --delete origin js-v1.2.5-update.1.prod && git tag -d js-v1.2.5-update.1.prod
git switch release/1.2.5 && git reset --hard <머지 전 커밋> && git push --force
git cherry-pick -m 1 <PR 의 merge commit>      # 이후 다시 태그
```

iOS 심사는 통과해도 자동 출시하지 않는다 (`automatic_release: false`). App Store Connect 에서 출시를 누른다.
iOS "이번 버전의 새로운 기능"은 `vX.Y.Z` 가 annotated 태그면 그 메시지, 아니면 기본 문구다
(`git tag -a v1.2.5 -m "..."`). Play 프로덕션은 관리형 게시를 켜 두면 심사 후 출시 시점을 직접 정한다.

## Secrets

GitHub Actions:

- `EXPO_TOKEN`, `SENTRY_*`, `DISCORD_WEBHOOK_URL`, Android keystore·`GOOGLE_SERVICES_JSON_BASE64` (기존)
- `PLAY_SERVICE_ACCOUNT_JSON`: Play Console 에 릴리스 권한을 준 서비스 계정 키 JSON
- `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`: App Store Connect API 키 (App Manager 이상)

iOS EAS cloud build 는 로컬 `.env` 나 ignore 된 plist 를 가져가지 않는다. EAS project 의 `production`
environment 에 아래 값을 둔다. `GOOGLE_SERVICES_PLIST` 는 file type env var 다.

- `EXPO_PUBLIC_BACKEND_URL`, `EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_ENVIRONMENT`
- `GOOGLE_SERVICES_PLIST`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`

## native-build.json 과 .easignore

EAS 원격 config 평가는 로컬 shell env 를 보지 못하므로, iOS 빌드 전에 `native-build.json` 을 만든다
(CD - iOS 가 한다). 없으면 `runtimeVersion` 이 기본값 `1.0.0` 으로 떨어져 "Runtime version mismatch" 로 깨진다.

이 파일은 git 이 무시하지만 EAS 업로드에는 들어가야 해서, 저장소 루트 `.easignore` 가 업로드 필터를 맡는다.

- **`.easignore` 는 저장소 루트에만 둘 수 있다.** `app-rn/` 에 두면 조용히 무시된다.
- **`.easignore` 가 있으면 모든 `.gitignore` 가 무시된다.** `.gitignore` 에 규칙을 추가하면 `.easignore` 에도
  넣는다. 안 그러면 `.env` 나 keystore 가 원격 빌드로 올라간다.

```bash
cd app-rn
eas build:inspect -p ios -s archive -o /tmp/eas-archive   # 빌드 한도를 쓰지 않는다
ls /tmp/eas-archive/app-rn/native-build.json              # 있어야 한다
```

## Manual fallback

```bash
cd app-rn
# OTA
BUILD_ENV=prod EAS_UPDATE_CHANNEL=production NATIVE_RUNTIME_VERSION=1.2.5 \
  EXPO_PUBLIC_OTA_UPDATE_NUMBER=1 eas update --channel production --message "manual"
npx sentry-expo-upload-sourcemaps dist

# iOS 빌드·제출
node scripts/write-native-build-config.js 1.2.5 1 1.2.5
BUILD_ENV=prod EAS_UPDATE_CHANNEL=production eas build --profile production --platform ios --auto-submit
```

## Check

- 앱 완전 종료 후 재시작. 설정 화면 하단은 `비활성`, `내장`, `update.N` 만 표시한다.
- 정식 바이너리를 새로 만들면 `production` OTA 를 iOS/Android 에서 다시 확인한다.
