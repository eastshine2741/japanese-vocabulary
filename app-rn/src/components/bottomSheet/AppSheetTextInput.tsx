import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

/**
 * 시트 안의 입력창. 포커스를 시트에 알려 키보드가 올라올 때 시트가 같이 올라온다.
 * 평범한 `TextInput` 을 쓰면 키보드가 입력창을 덮는다.
 * 시트에 `android_keyboardInputMode="adjustResize"` 를 주면 안 된다: edge-to-edge 라 창이 줄지 않아 시트가 안 올라온다.
 * 시트가 키보드 위에 다 안 들어갈 수 있으면 본문을 `AppBottomSheetView fitAboveKeyboard` 로 감쌀 것.
 */
export const AppSheetTextInput = BottomSheetTextInput;
