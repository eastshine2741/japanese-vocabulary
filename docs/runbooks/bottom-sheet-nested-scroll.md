# Bottom Sheet Nested Scroll

바텀시트(`@gorhom/bottom-sheet` v5) 안에 스크롤을 넣을 때 반복해서 밟는 함정과, `app-rn/src/components/bottomSheet` 의 공통 컴포넌트가 그 중 무엇을 대신 처리하는지.

## 쓸 컴포넌트

| 필요한 것 | 쓸 것 |
| --- | --- |
| 시트 본문 | `AppBottomSheetView` — 안에 스크롤/페이저가 있으면 `fill` |
| 목록이 드래그를 소유(목록 위에서 시트 안 움직임) | `AppSheetOwnedScrollView` / `AppSheetOwnedFlatList` |
| 목록이 맨 위에 닿으면 시트가 접힘 | `AppSheetHandoffScrollView` / `AppSheetHandoffFlatList` |

gorhom 을 직접 import 하는 곳은 `src/components/bottomSheet/` 뿐이다.

## 함정 1 — 본문 높이가 내용만큼 늘어난다 (`fill`)

`BottomSheetView` 는 넘긴 스타일 **뒤에** 자기 스타일을 덮어쓴다:

```js
// components/bottomSheetView/styles.ts
container: { position: 'absolute', left: 0, top: 0, right: 0 }
```

`bottom` 이 없으니 높이가 내용 기준으로 잡히고 `flex: 1` 은 죽는다. 그러면 안쪽 스크롤도 "내용이 다 들어간다"고 판단해 **스크롤이 생기지 않고**, 넘친 부분은 시트 밖에서 잘린다. 잘려 보이는데 스크롤이 안 되면 이 증상이다.

`AppBottomSheetView fill` 이 `bottom: 0` 을 넣어 시트 본문 높이에 묶는다. 부모(`BottomSheetContent`)는 높이가 확정돼 있으므로 이걸로 충분하다.

**`enableDynamicSizing` 시트에는 `fill` 을 쓰지 말 것** — 시트 높이를 본문 높이에서 재야 하는데 본문을 시트 높이에 묶으면 성립하지 않는다.

## 함정 2 — over-drag 여유 패딩이 마지막 줄을 가린다

`BottomSheetContent` 는 본문에 여유 패딩을 붙인다:

```js
paddingBottom = Math.sqrt(highestSnapPoint + containerHeight) * overDragResistanceFactor  // 기본 2.5
height = contentHeightMax + paddingBottom
```

720dp 급 화면에서 약 70dp. absolute 자식은 padding box 전체에 걸치므로 그만큼 본문이 시트 밖으로 내려앉아 마지막 줄이 가려진다. 게다가 이 값은 `animatedPosition` 에서 파생돼 **드래그 중 매 프레임 본문 높이가 다시 계산**된다(드래그가 무거워지는 원인).

`AppBottomSheet` 는 `enableOverDrag={false}` 인 시트에 `overDragResistanceFactor={0}` 을 기본으로 넣는다. over-drag 를 쓰는 시트라면 이 패딩은 그대로 남으니, 스크롤이 꽉 차는 본문에는 over-drag 를 끄는 편이 낫다.

## 함정 3 — 세로 드래그의 주인 (`Owned` vs `Handoff`)

시트의 본문 pan 과 안쪽 스크롤은 같은 세로 드래그를 두고 경쟁한다. 어느 쪽이 이길지는 UX 결정이라 기본값으로 숨길 수 없다.

- **`Owned`** = react-native-gesture-handler 의 스크롤. `disallowInterruption: true` 로 감싸져 있어서, 네이티브 스크롤이 활성화되면 시트 pan 이 그 드래그를 가로채지 못한다. 시트에 등록되지 않으니 아래 되감기도 없다. 그 대신 목록에서 시트를 접을 수 없다.
- **`Handoff`** = gorhom 의 스크롤. 드래그 시작 시점의 스크롤 위치를 기준으로 시트를 붙잡아 두고, 목록이 맨 위에 닿으면 시트가 이어받는다. 두 조건이 붙는다:
  1. 시트가 **최상단 스냅포인트에 정확히 있을 때만** 스크롤이 풀린다. 벗어나면 `useScrollEventsHandlersDefault` 가 `scrollTo(ref, 0, 0)` 으로 목록을 맨 위로 되감는다.
  2. 시트는 스크롤을 하나만 기억한다. 스크롤이 마운트될 때마다 `useScrollableSetter` 가 기준값을 0 으로 덮으므로, **본문에 목록이 여러 개면**(페이저 안의 카드마다 하나 등) 엉뚱한 기준값을 읽어 시트가 드래그를 훔친다. 이 경우는 `Owned` 를 쓴다.

## 함정 4 — 가로 스크롤을 시트가 훔친다

본문에 페이저 같은 가로 스크롤이 있으면 시트 pan 이 가로 스와이프까지 잡아서 페이지가 넘어가지 않는다. `AppBottomSheet` 에 `hasHorizontalContent` 를 켜면 `activeOffsetY`/`failOffsetX` 로 세로 의도가 분명할 때만 시트가 잡는다.

`NativeViewGestureHandler disallowInterruption` 으로 가로 스크롤을 감싸는 방식은 쓰지 말 것 — 그 핸들러가 활성화되면 **자식 스크롤이 활성화되지 못한다**.

## 참고 구현

`app-rn/src/components/songDetail/CurrentPlayingWordsSheet.tsx` — 네 함정 전부에 해당한다(가로 페이저 + 페이지마다 세로 목록, over-drag off, fill 본문).
