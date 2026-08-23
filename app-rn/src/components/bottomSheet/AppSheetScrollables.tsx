import { FlatList, ScrollView } from 'react-native-gesture-handler';
import { BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';

/**
 * 시트 안의 스크롤은 세로 드래그를 두고 시트와 경쟁한다. 어느 쪽이 이길지는 UX 결정이라
 * 기본값으로 숨길 수 없다. 그래서 고르는 순간 배선이 따라오게 이름을 나눠 둔다.
 *
 * - `Owned*`: 이 스크롤이 드래그를 소유한다. 목록 위에서는 시트가 움직이지 않는다.
 *   react-native-gesture-handler 의 스크롤은 `disallowInterruption` 으로 감싸져 있어서,
 *   네이티브 스크롤이 활성화되면 시트의 본문 pan 이 그 드래그를 가로채지 못한다.
 *   시트에 등록되지 않으니 아래의 되감기 문제도 없다.
 *
 * - `Handoff*`: 목록이 맨 위에 닿으면 시트가 이어받아 접힌다. gorhom 이 드래그 시작
 *   시점의 스크롤 위치를 기준으로 조율한다. 두 가지 함정이 붙어 있다 —
 *   (1) 시트가 **최상단 스냅포인트에 정확히 있을 때만** 스크롤이 풀린다. 벗어나면
 *       gorhom 이 목록을 맨 위로 되감는다(`scrollTo(ref, 0, 0)`).
 *   (2) 시트는 스크롤을 하나만 기억한다. 새 스크롤이 마운트될 때마다 기준값이 0 으로
 *       덮이므로, 시트 본문에 목록이 여러 개(예: 페이저 안의 카드마다 하나)면
 *       엉뚱한 기준값을 읽고 시트가 드래그를 훔친다. 그 경우엔 `Owned*` 를 쓸 것.
 *
 * 자세한 근거: `docs/runbooks/bottom-sheet-nested-scroll.md`
 */
export const AppSheetOwnedScrollView = ScrollView;
export const AppSheetOwnedFlatList = FlatList;
export const AppSheetHandoffScrollView = BottomSheetScrollView;
export const AppSheetHandoffFlatList = BottomSheetFlatList;
