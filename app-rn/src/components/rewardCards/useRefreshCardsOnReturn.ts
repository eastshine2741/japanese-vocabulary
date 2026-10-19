import { useCallback, useEffect, useRef } from 'react';
import { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useRewardCardStore } from '../../stores/rewardCardStore';

/** 위에 올린 화면(복습 등)에서 돌아오면 낡음이 바뀌었을 수 있어 카드를 다시 받는다. 돌려받은 함수는 다음 한 번의 복귀를 건너뛴다. 남의 카드는 enabled 를 끈다. */
export function useRefreshCardsOnReturn(navigation: NavigationProp<ParamListBase>, enabled = true) {
  const leftRef = useRef(false);
  const skipRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const offBlur = navigation.addListener('blur', () => {
      leftRef.current = true;
    });
    const offFocus = navigation.addListener('focus', () => {
      if (!leftRef.current) return;
      leftRef.current = false;
      if (skipRef.current) {
        skipRef.current = false;
        return;
      }
      const { source, serverStatus, loadServerCards } = useRewardCardStore.getState();
      if (source === 'server' && serverStatus !== 'loading') loadServerCards();
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation, enabled]);
  return useCallback(() => {
    skipRef.current = true;
  }, []);
}
