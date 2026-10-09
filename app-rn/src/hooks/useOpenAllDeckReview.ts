import { useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { deckApi } from '../api/deckApi';
import { sourceFromDeckDetail } from '../components/studyStack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { StudyEntryTrigger } from '../services/analytics';

/** 전체 단어장 복습을 연다. 덱 조회가 실패하면 fallback 으로 대신한다. */
export function useOpenAllDeckReview(trigger: StudyEntryTrigger, fallback: () => void) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const openingRef = useRef(false);

  return useCallback(async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    try {
      const deck = await deckApi.getAllDeckDetail();
      navigation.navigate('SongReview', { trigger, source: sourceFromDeckDetail(deck) });
    } catch {
      fallback();
    } finally {
      openingRef.current = false;
    }
  }, [fallback, navigation, trigger]);
}
