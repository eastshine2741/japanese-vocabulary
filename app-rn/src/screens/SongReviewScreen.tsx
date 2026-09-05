import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  createSongQueueOrderer,
  StackReviewOverlay,
  STACK_REVIEW_CHROME_HEIGHT,
  StudyStack,
  useStudyStack,
} from '../components/studyStack';
import { useSongDetailStore } from '../stores/songDetailStore';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SongReview'>;

/** 곡 진입 복습 — 홈과 같은 카드 스택에 크롬만 오버레이로 바뀐 스택 화면. */
export default function SongReviewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { source, focusJapanese } = route.params;
  const songId = source.songId;

  // 큐 순서 재료는 바로 아래 SongDetail 이 이미 들고 있다. 없으면 서버 순서를 그대로 쓴다.
  const songWords = useSongDetailStore(
    s => (songId != null && s.data?.song.id === songId ? s.data.words.words : null),
  );
  const orderCards = useMemo(
    () => createSongQueueOrderer(songWords, focusJapanese),
    [focusJapanese, songWords],
  );

  const stack = useStudyStack({ mode: 'source', source, orderCards });
  const { isComplete, session, status } = stack;

  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const goSearch = useCallback(() => navigation.navigate('Main', { screen: 'Search' }), [navigation]);

  // 큐를 다 보면 cards 가 비어 카운터가 0 이 된다 — 복습을 끝낸 개수로 마지막 값을 유지한다.
  const counterTotal = session.queueTotal > 0 ? session.queueTotal : session.reviewedCount;
  const counterPosition = session.queueTotal > 0 ? session.position : session.reviewedCount;

  const overlay = (
    <StackReviewOverlay
      position={counterPosition}
      queueTotal={counterTotal}
      queueProgress={session.queueProgress}
      showProgress={status === 'ready' && !isComplete}
      onBack={goBack}
    />
  );

  return (
    <View style={styles.screen}>
      <StudyStack
        stack={stack}
        onOpenSource={goBack}
        onSearch={goSearch}
        overlay={overlay}
        contentInsetTop={insets.top + STACK_REVIEW_CHROME_HEIGHT}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#14181C',
  },
});
