# App RN Instructions

## Scope

Applies to `app-rn/`.

## Rules

- Use Zustand selectors; do not call stores as broad `useStore()` subscriptions.
- Use `useShallow` or specific selectors for composed state.
- Use `React.memo` for list items and repeated render components.
- Use `useCallback` for handlers passed to children.
- Avoid inline callbacks inside `renderItem`; pass stable props and call handlers inside children.
- Use `useMemo` for expensive render-path calculations.
- Keep `StyleSheet.create()` co-located with components.
- 바텀시트는 `components/bottomSheet` 의 `AppBottomSheet`/`AppBottomSheetView`/`AppSheet*ScrollView` 를 쓴다. `@gorhom/bottom-sheet` 직접 import 는 그 디렉토리 안에서만. 중첩 스크롤 함정은 `../docs/runbooks/bottom-sheet-nested-scroll.md`.

## OTA (EAS Update)

JS-only 변경은 `eas update`로 배포한다. 네이티브 변경은 새 빌드가 필요하다.

채널: `development`(Android dev), `production-rc`(RC), `production`(정식). 절차는 `../docs/runbooks/mobile-ota-release.md`.

```bash
BUILD_ENV=prod EAS_UPDATE_CHANNEL=production \
  eas update --channel production --message "..."   # dist/ 를 만들고 업로드
SENTRY_AUTH_TOKEN=... SENTRY_ORG=eastshine SENTRY_PROJECT=kotonoha-app-prod \
  npx --package=@sentry/react-native sentry-expo-upload-sourcemaps dist
```

- 소스맵은 OTA 에서 자동 업로드되지 않는다. `eas update` 직후 위 명령을 직접 돌린다. `@sentry/expo-upload-sourcemaps` 패키지는 SDK 8.9.0+ 전용이라 현재 7.x 에서는 SDK 번들 bin 을 쓴다.
- `metro.config.js` 의 `getSentryExpoConfig` 가 번들/소스맵에 Debug ID 를 심는다. 지우면 업로드해도 매칭이 안 된다.
- `eas update` 는 `eas.json` build profile 의 `env` 를 자동으로 쓰지 않는다. prod OTA 는 `BUILD_ENV=prod EAS_UPDATE_CHANNEL=production` 을 명시한다.
- **새 빌드가 필요한 경우**: native dependency/plugin/patches/icon/splash/bundleIdentifier 변경.
- 업데이트는 백그라운드로 받고 다음 콜드스타트에 적용된다.

## Multi-worktree Builds

- Use `DEPLOY_NS=<branch-or-issue>` to install multiple branch builds on one device.
- If the namespace/package changes, run `npx expo prebuild --clean`.
- `android/` is generated and gitignored.

## Reference

- k3s/frontend environment notes: `../docs/runbooks/k3s-deploy.md`
