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

## Multi-worktree Builds

- Use `DEPLOY_NS=<branch-or-issue>` to install multiple branch builds on one device.
- If the namespace/package changes, run `npx expo prebuild --clean`.
- `android/` is generated and gitignored.

## Reference

- k3s/frontend environment notes: `../docs/runbooks/k3s-deploy.md`
