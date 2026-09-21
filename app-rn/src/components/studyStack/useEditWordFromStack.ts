import { useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { StudyCard } from './types';

/**
 * 뒷면 연필 버튼 → 단어 편집 화면. 편집하고 돌아오면 그 카드의 읽기·뜻만 다시 받는다 —
 * 리뉴얼 전 복습 화면과 같은 흐름. 탭 전환 같은 다른 포커스에는 다시 받지 않는다.
 */
export function useEditWordFromStack(refreshCurrentCard: () => Promise<void>) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const pendingRefreshRef = useRef(false);

  useFocusEffect(useCallback(() => {
    if (!pendingRefreshRef.current) return;
    pendingRefreshRef.current = false;
    refreshCurrentCard();
  }, [refreshCurrentCard]));

  return useCallback((card: StudyCard) => {
    pendingRefreshRef.current = true;
    navigation.navigate('EditWord', {
      mode: 'edit',
      wordId: card.wordId,
      japanese: card.japanese,
      reading: card.reading ?? undefined,
      senses: card.senses,
    });
  }, [navigation]);
}
