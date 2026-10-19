# Feature flag

배포와 분리해 기능을 원하는 시각에 켜고 끈다. `domains:featureflag` 이 소유하고 api·worker·batch·admin-api 가 모두 싣는다.

## 사용

```kotlin
if (featureFlags.isOn("new-home")) { ... }
```

- 켜짐은 `start_at <= now < end_at` 이다. `start_at` 이 없으면 꺼져 있고 `end_at` 이 없으면 끝이 없다.
- DB 에 없는 키, 첫 조회 실패는 꺼짐으로 본다. 코드를 먼저 내보내고 플래그 행은 나중에 만들어도 된다.
- 키는 소문자 kebab-case 100자 이하. 코드가 읽는 키는 `FeatureFlagKeys` 에 모은다.

## 반영 시점

- 판정은 호출마다 현재 시각으로 하므로 시작·종료 시각은 정확히 그 순간에 바뀐다. 롤아웃이 필요 없다.
- pod 마다 테이블 전체를 Caffeine 에 들고 30초(`refreshAfterWrite`)마다 다시 읽는다. 관리자 수정은
  수정한 admin-api pod 에선 커밋 직후, 다른 pod 에선 최대 30초 뒤(그 뒤 첫 호출 시) 보인다.
  다시 읽기가 실패하면 직전 값을 계속 쓴다.

## 관리

admin-web `Feature Flags` 화면 (KST 입력). API: `GET /admin/api/feature-flags`,
`PUT /admin/api/feature-flags/{key}` `{startAt, endAt, description}`, `DELETE /admin/api/feature-flags/{key}`.
앱(RN)용 공개 API 는 아직 없다.
