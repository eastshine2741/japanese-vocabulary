import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
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
import { trackReviewExit } from '../services/analytics';
import { useStreakStore } from '../stores/streakStore';

type Props = NativeStackScreenProps<RootStackParamList, 'SongReview'>;

/** 곡 진입 복습 — 홈과 같은 카드 스택에 크롬만 오버레이로 바뀐 스택 화면. */
export default function SongReviewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { source } = route.params;

  const stack = useStudyStack({ mode: 'source', source });
  const { isComplete, session, status } = stack;
  // 홈 스택을 거치지 않고 곡 상세에서 바로 들어와도 첫 rating 완료 배너가 뜨도록 연속 학습 통계를 확보한다.
  useEffect(() => { useStreakStore.getState().ensureLoaded(); }, []);

  // 몇 장째에서, 뒷면을 본 채로 나갔는지 남긴다 — 언마운트 시점 값이 필요해 ref 로 따라간다.
  // 앱을 끄면 언마운트가 오지 않으니 백그라운드로 갈 때도 남긴다(how=background). 돌아와 이어서
  // 하면 같은 열림에 여러 건이 생기므로 분석은 열림마다 마지막 건을 본다.
  const exitStateRef = useRef({ reviewed: 0, revealed: false, completed: false, status });
  exitStateRef.current = { reviewed: session.reviewedCount, revealed: stack.revealed, completed: isComplete, status };
  useEffect(() => {
    const openedAt = Date.now();
    const songId = source.songId;
    const log = (how: 'leave' | 'background') => {
      if (songId == null) return;
      trackReviewExit({
        song_id: songId,
        how,
        ...exitStateRef.current,
        dwell_sec: Math.round((Date.now() - openedAt) / 1000),
      });
    };
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background') log('background');
    });
    return () => {
      sub.remove();
      log('leave');
    };
    // 화면 한 번 열림당 한 번 등록한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const editWord = useEditWordFromStack(stack.refreshCurrentCard);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  // 탭 안(Main)까지 내려가면 바텀탭·다른 탭 화면이 같이 뜬다 — 검색탭 UI만 새 스택으로 띄운다.
  const goSearch = useCallback(() => navigation.navigate('SearchStack'), [navigation]);
  // 예문은 지금 복습 중인 곡과 다른 곡에서 왔을 수 있다 — 뒤로 가기 대신 그 곡 상세로 이동한다.
  const openExampleSource = useCallback((songId: number) => {
    navigation.navigate('SongDetail', { songId, origin: 'SongReview' });
  }, [navigation]);

  // 세션 시작 시점에 due 카드가 없었는데 도중에 새로 due 된 카드를 리뷰하면 queueTotal 이 0으로 남는다 —
  // 그때는 진행한 개수로 카운터를 대체한다.
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
