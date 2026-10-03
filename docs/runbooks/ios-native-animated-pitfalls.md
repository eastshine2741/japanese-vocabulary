# iOS native Animated 함정 (Fabric)

`Animated` 를 `useNativeDriver: true` 로 쓸 때 iOS(New Architecture)에서만 깨지는 패턴 두 가지.
Android 와 dev 번들에선 멀쩡하고 **iOS prod(Release) 번들**에서만 보이는 경우가 많다 — 원인이
JS 명령과 Fabric 마운트의 도착 순서라서, 빠른 번들일수록 잘 드러난다.

## 배경: RN 0.83 iOS 동작

1. **native 가 한 번 쓴 prop 은 React 가 더는 못 바꾼다.** native Animated 가
   `synchronouslyUpdateViewOnUIThread` 로 view 의 `opacity`/`transform` 을 쓰면 그 키가
   `propKeysManagedByAnimated_DO_NOT_USE_THIS_IS_BROKEN` 에 등록되고, 이후 React 커밋의 같은 키
   변경은 무시된다 (`RCTMountingManager.mm`, `RCTViewComponentView.mm`). view 가 재활용될 때까지 유지된다.
2. **`setValue` / `.start()` 는 마운트를 기다리지 않는다.** 이 두 명령은 즉시 flush 되고, 새로 연결된
   노드도 그때 값을 view 로 민다 (`RCTNativeAnimatedTurboModule.mm` `queueFlushedOperationBlock`).
   view 가 아직 마운트 전이면 값이 조용히 버려지고 다시 보내지 않는다. 반대로 마운트 직후
   아무 애니메이션이나 한 프레임 돌면 연결된 모든 노드가 값을 밀어 1번 상태가 된다.

## 규칙

- **같은 view 의 prop 을 Animated 값 ↔ 고정값으로 바꾸지 않는다.**
  `style={[animatedStyle, hidden && { opacity: 0 }]}` 처럼 조건부로 덮으면, 한 번이라도 native 가
  opacity 를 쓴 뒤엔 `opacity: 0` 이 무시된다. 조건부 숨김은 Animated 가 건드리지 않는 부모 `View` 에 건다.
- **재사용하는 `Animated.Value` 를 `setValue(0)` 으로 리셋하지 않는다.** effect 는 렌더 뒤에 돌아서
  새 내용의 첫 렌더가 직전 값으로 커밋되고, 뒤따른 `setValue` 는 마운트 전 view 에 떨어질 수 있다.
  리셋이 필요한 주기마다 새 인스턴스를 만든다 (`useState`/`useMemo` 로 교체).
- 확인은 iOS Release 빌드로 한다. dev 에서 괜찮다는 건 근거가 안 된다.

## 사례: 1.2.4 홈 플래시카드 (`app-rn/src/components/studyStack/`)

- 앞면에 rating 버튼이 '뜻 확인하기' pill 과 겹쳐 보임 — `WordLayer` 의 `splitProgress` 를 `useRef` 로
  재사용하고 `setValue(0)` 으로 되돌렸다. 새 카드 첫 렌더에서 rating 버튼 opacity 가 직전 값 1 로 커밋됐다.
  → `revealProgress` 가 바뀔 때마다 새 `Animated.Value` 로 교체.
- 뒤집을 때 일본어 단어가 둘로 보임 — `WordFront` 앞면 headword 가 `hideHeadword` 에 따라 opacity 를
  Animated 값 ↔ `0` 으로 오갔다. 마운트 직후 `holdProgress` timing 이 opacity 1 을 밀어 넣은 뒤로
  `opacity: 0` 이 무시돼, 공유 headword 와 앞면 headword 가 같이 보였다.
  → 숨김 opacity 를 부모 `View` 로 이동.
