import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';

export interface HomeChromeProps {
  streak: number;
  /** useStudyStack().session.progress */
  progress: number;
  onSearch: () => void;
}

/** 홈 전용 크롬 — 공용 스택 밖에서 형제로 배치한다. */
export const HomeChrome = React.memo(function HomeChrome({ streak, progress, onSearch }: HomeChromeProps) {
  return (
    <View style={styles.chrome}>
      <View style={styles.appBar}>
        <Text style={styles.wordmark}>Kotonoha</Text>
        <View style={styles.appBarRight}>
          <View style={styles.streakRow}>
            <Feather name="zap" size={15} color={Colors.streakFlame} />
            <Text style={styles.streakText}>{streak}일</Text>
          </View>
          <Pressable onPress={onSearch} hitSlop={8} style={styles.iconButton}>
            <Feather name="search" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(0.04, progress) * 100}%` }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  chrome: {
    backgroundColor: Colors.background,
  },
  appBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  wordmark: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0,
    color: Colors.textPrimary,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  iconButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#D2D2D2',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});
