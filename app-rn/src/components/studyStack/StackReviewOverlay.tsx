import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** statusBar 아래 크롬 높이 — appBar 52 + sessionProgress 14. */
export const STACK_REVIEW_CHROME_HEIGHT = 66;

export interface StackReviewOverlayProps {
  /** useStudyStack().session.position */
  position: number;
  /** useStudyStack().session.queueTotal */
  queueTotal: number;
  /** useStudyStack().session.queueProgress */
  queueProgress: number;
  /** 완주 카드에서는 진행 바를 그리지 않는다. */
  showProgress: boolean;
  /** 없으면 뒤로가기 버튼을 그리지 않고 카운터를 앱바 끝으로 보낸다(홈처럼 돌아갈 곳이 없는 화면). */
  onBack?: () => void;
}

/** 곡 진입 복습 크롬 — 흰 앱바 없이 카드 위에 얹는다. */
export const StackReviewOverlay = React.memo(function StackReviewOverlay({
  position,
  queueTotal,
  queueProgress,
  showProgress,
  onBack,
}: StackReviewOverlayProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={{ height: insets.top }} pointerEvents="none" />
      <View style={[styles.appBar, !onBack && styles.appBarEnd]} pointerEvents="box-none">
        {onBack && (
          <Pressable style={styles.backButton} onPress={onBack} hitSlop={8}>
            <Feather name="chevron-left" size={24} color="#FFFFFF" />
          </Pressable>
        )}
        {queueTotal > 0 && (
          <View style={styles.counterPill} pointerEvents="none">
            <Text style={styles.counterText}>{position} / {queueTotal}</Text>
          </View>
        )}
      </View>
      {showProgress && (
        <View style={styles.progressWrap} pointerEvents="none">
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(1, Math.max(0, queueProgress)) * 100}%` }]} />
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  appBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  appBarEnd: {
    justifyContent: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  counterPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  counterText: {
    color: 'rgba(255,255,255,0.90)',
    fontSize: 13,
    fontWeight: '600',
  },
  progressWrap: {
    height: 14,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#52B788',
  },
});
