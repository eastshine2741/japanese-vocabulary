import { FlatList, ScrollView } from 'react-native-gesture-handler';
import { BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';

/**
 * 시트 안의 스크롤은 세로 드래그를 두고 시트와 경쟁한다. 어느 쪽이 이길지 고르도록 이름을 나눠 둔다.
 *
 * - `Owned*`: 이 스크롤이 드래그를 소유한다. 목록 위에서는 시트가 움직이지 않고, 시트에 등록되지 않아 되감기 문제도 없다.
 * - `Handoff*`: 목록이 맨 위에 닿으면 시트가 이어받아 접힌다. 함정 두 가지 —
 *   (1) 시트가 최상단 스냅포인트에 정확히 있을 때만 스크롤이 풀리고, 벗어나면 gorhom 이 목록을 맨 위로 되감는다.
 *   (2) 시트는 스크롤을 하나만 기억한다. 본문에 목록이 여럿(예: 페이저 안의 카드마다)이면 시트가 드래그를 훔치므로 `Owned*` 를 쓸 것.
 *
 * 자세한 근거: `docs/runbooks/bottom-sheet-nested-scroll.md`
 */
export const AppSheetOwnedScrollView = ScrollView;
export const AppSheetOwnedFlatList = FlatList;
export const AppSheetHandoffScrollView = BottomSheetScrollView;
export const AppSheetHandoffFlatList = BottomSheetFlatList;
