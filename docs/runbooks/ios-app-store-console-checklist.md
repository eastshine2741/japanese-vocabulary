# iOS App Store Console Checklist

이 문서는 iOS App Store 출시를 위해 개발자/운영자가 웹 콘솔에서 직접 처리해야 하는 일을 정리한다.
코드에서 처리할 수 있는 설정과 구현은 별도 작업으로 진행하고, 이 문서는 계정 권한, 발급, 제출처럼 콘솔 접근이 필요한 항목만 다룬다.

## 1. Apple Developer Program

- Apple Developer Program에 가입한다.
- 개인 계정이면 판매자/개발자 이름이 개인명으로 노출된다.
- 법인 계정이면 법인명 노출이 가능하지만 D-U-N-S Number가 필요하다.
- Team ID를 기록해 둔다. 단, 비밀번호, 2FA 코드, private key 파일은 repo에 커밋하지 않는다.

## 2. Apple Developer Identifiers

- App ID / Bundle ID를 만든다.
- 권장 production Bundle ID: `dev.eastshine.kotonoha`
- Capabilities에서 최소 다음 항목을 활성화한다.
  - Sign in with Apple
  - Push Notifications
- iPad를 정식 지원하지 않을 계획이면 앱 설정에서 iPad 지원을 끄는 방향으로 맞춘다.

## 3. Sign in with Apple

- 위 App ID에 Sign in with Apple capability가 켜져 있는지 확인한다.
- App Store Connect의 앱 레코드와 동일한 Bundle ID가 연결되는지 확인한다.
- Apple 로그인은 사용자가 이메일을 숨길 수 있으므로 `privaterelay.appleid.com` 및 `private.icloud.com` 이메일을 정상 이메일처럼 취급한다.
- Apple은 이름/이메일을 최초 승인 시점에만 줄 수 있으므로, 최초 가입 테스트에서 이름/이메일 수신 여부를 확인한다.
- Apple 로그인 계정은 backend의 별도 Apple provider 경로(`provider = "apple"`)로 유지하고, Google 계정과 자동 병합/연결하지 않는다.

## 4. Firebase / Google Console

- Firebase 프로젝트에 iOS 앱을 추가한다.
- iOS Bundle ID는 Apple Developer에 만든 값과 동일하게 입력한다: `dev.eastshine.kotonoha`
- `GoogleService-Info.plist`를 발급한다.
- Google 로그인도 iOS에서 유지할 경우 Google OAuth iOS client가 생성되어 있는지 확인한다.
- backend의 `google.oauth.client-id`가 iOS에서 발급되는 Google ID token의 audience와 맞는지 확인한다.

## 5. APNs / Push Notifications

- Apple Developer에서 APNs Auth Key를 생성한다.
- Key ID, Team ID를 기록한다.
- APNs Auth Key를 Firebase Cloud Messaging 설정에 업로드한다.
- production 빌드에서 실제 iOS 기기로 알림 권한 요청과 token 등록이 되는지 확인한다.

## 6. App Store Connect App Record

- App Store Connect에서 새 앱을 만든다.
- 플랫폼: iOS
- 이름: 출시명 기준으로 입력한다. 예: `Kotonoha`
- 기본 언어를 선택한다.
- Bundle ID: `dev.eastshine.kotonoha`
- SKU는 내부 관리용 문자열로 정한다. 예: `kotonoha-ios`
- 카테고리는 교육 앱 기준으로 선택한다.

## 7. App Information / Metadata

- 앱 설명, 부제, 키워드, 지원 URL, 마케팅 URL을 입력한다.
- 개인정보처리방침 URL을 입력한다.
  - 현재 앱 코드 기준 URL: `https://eastshine2741.github.io/kotonoha-legal/privacy`
- 서비스 이용약관 URL도 메타데이터나 심사 노트에 넣을 수 있게 준비한다.
  - 현재 앱 코드 기준 URL: `https://eastshine2741.github.io/kotonoha-legal/terms`
- 권리자 신고 이메일 또는 신고 절차를 심사 노트에 적을 수 있게 준비한다.

## 8. Privacy Nutrition Label

App Store Connect의 App Privacy 항목을 작성한다. 현재 앱 기준으로 최소 다음 데이터 사용 여부를 점검한다.

- 계정 정보: 이메일, 이름, username
- 사용자 콘텐츠/학습 데이터: 저장 단어, 덱, 플래시카드, 학습 기록
- 검색/사용 기록: 최근 검색어, 최근 학습 곡
- 식별자: push token, provider subject, JWT 관련 서버 식별자
- 진단: Sentry crash/error data를 사용하는 경우 진단 데이터
- 제3자 SDK: Firebase, Google Sign-In, Sentry, YouTube WebView/player 관련 데이터 처리

수집 항목별로 "사용자와 연결됨", "추적에 사용됨", "앱 기능/분석/진단 목적" 여부를 실제 구현 기준으로 답한다.

## 9. Screenshots / Preview

- iPhone 스크린샷을 준비한다.
- iPad 지원을 끄지 않으면 iPad 스크린샷도 준비해야 한다.
- 로그인, 추천/검색, 노래 학습, 단어 저장, 플래시카드 복습 화면을 우선 캡처한다.
- 스크린샷에 저작권 리스크가 큰 풀가사 노출이 과하게 들어가지 않게 한다.

## 10. Build Selection / Compliance

- TestFlight에 올라온 production 빌드를 선택한다.
- Export Compliance 질문에 답한다.
- HTTPS, JWT, OAuth, SecureStore 등 일반적인 암호화 사용이 있으므로 질문을 정확히 읽고 답한다.
- 광고나 인앱 결제를 붙이지 않는 초기 출시라면 해당 항목은 없음으로 맞춘다.

## 11. Review Notes

심사 노트에는 다음을 간단히 적을 준비를 한다.

- 테스트 계정이 필요한 경우 테스트 계정과 사용 방법
- Google 로그인 및 Apple 로그인 둘 다 지원한다는 점
- 계정 삭제 경로: 설정 화면 > 계정 삭제
- 노래/가사/번역은 학습 목적이며 권리자 신고 시 곡 단위로 삭제/비공개 처리할 수 있다는 점
- YouTube 영상은 앱 내 WebView/player로 재생되며 YouTube player UI를 방해하지 않는다는 점

## 12. 최종 제출 전 확인

- 실제 iPhone에서 production 빌드 로그인, 가입, 로그아웃, 계정 삭제를 테스트한다.
- Apple 로그인 최초 가입과 재로그인을 backend의 별도 Apple auth 경로(`/api/auth/apple`, `/api/auth/apple/signup`)에서 각각 테스트한다.
- Google 로그인도 iOS에서 동작하는지 확인한다.
- 푸시 권한 요청, token 등록, 서버 저장을 확인한다.
- 개인정보처리방침/약관/오픈소스 라이선스/권리자 신고 링크가 앱 안에서 열리는지 확인한다.
- App Store Connect의 앱 정보와 앱 내부 표시명이 서로 모순되지 않는지 확인한다.
