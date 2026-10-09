import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

/**
 * 시트 안의 입력창. 포커스를 시트에 알려 키보드가 올라올 때 시트가 같이 올라온다.
 * 평범한 `TextInput` 을 쓰면 키보드가 입력창을 덮는다.
 * 시트에 `android_keyboardInputMode="adjustResize"` 를 주면 안 된다: edge-to-edge 라 창이 줄지 않아 시트가 안 올라온다.
 */
export const AppSheetTextInput = BottomSheetTextInput;
