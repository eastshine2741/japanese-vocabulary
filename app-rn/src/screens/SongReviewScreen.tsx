import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  StackReviewOverlay,
  STACK_REVIEW_CHROME_HEIGHT,
  StudyStack,
  useEditWordFromStack,
  useStudyStack,
} from '../components/studyStack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useStreakStore } from '../stores/streakStore';

type Props = NativeStackScreenProps<RootStackParamList, 'SongReview'>;

/** 곡 진입 복습 — 홈과 같은 카드 스택에 크롬만 오버레이로 바뀐 스택 화면. */
export default function SongReviewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { source } = route.params;

  const stack = useStudyStack({ mode: 'source', source });
  const { isComplete, session, status } = stack;
  // 홈을 거치지 않고 들어와도 첫 rating 완료 배너가 뜨도록 연속 학습 통계를 확보한다.
  useEffect(() => { useStreakStore.getState().ensureLoaded(); }, []);
  const editWord = useEditWordFromStack(stack.refreshCurrentCard);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  // 탭 안(Main)까지 내려가면 바텀탭·다른 탭 화면이 같이 뜬다 — 검색탭 UI만 새 스택으로 띄운다.
  const goSearch = useCallback(() => navigation.navigate('SearchStack'), [navigation]);
  // 예문은 지금 복습 중인 곡과 다른 곡에서 왔을 수 있다 — 뒤로 가기 대신 그 곡 상세로 이동한다.
  const openExampleSource = useCallback((songId: number) => {
    navigation.navigate('SongDetail', { songId, origin: 'SongReview' });
  }, [navigation]);

  // 시작 시 due 가 없었다가 도중에 due 된 카드를 리뷰하면 queueTotal 이 0 이라 진행 개수로 대체한다.
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
        onOpenExampleSource={openExampleSource}
        onEditWord={editWord}
        onSearch={goSearch}
        overlay={overlay}
        contentInsetTop={insets.top + STACK_REVIEW_CHROME_HEIGHT}
        contentInsetBottom={insets.bottom}
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
