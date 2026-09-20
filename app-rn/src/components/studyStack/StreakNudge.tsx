import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

export const STREAK_NUDGE_TEXT = '아직 오늘의 학습을 하지 않았어요';

/** 꼬리가 칩 중앙을 가리키도록 말풍선 오른쪽 끝에서 띄우는 거리. */
const TAIL_RIGHT_OFFSET = 32;
const TAIL_WIDTH = 14;
const TAIL_HEIGHT = 7;

/** B-1 말풍선 — 헤더 칩 아래에 붙어 오늘 아직임을 말한다. 사용자가 닫을 수 없다. */
export const StreakNudge = React.memo(function StreakNudge() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.tail} />
      <View style={styles.bubble}>
        <Text style={styles.text}>{STREAK_NUDGE_TEXT}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-end',
  },
  tail: {
    width: 0,
    height: 0,
    marginRight: TAIL_RIGHT_OFFSET,
    borderLeftWidth: TAIL_WIDTH / 2,
    borderRightWidth: TAIL_WIDTH / 2,
    borderBottomWidth: TAIL_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Colors.streakFlame,
  },
  bubble: {
    backgroundColor: Colors.streakFlame,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  text: {
    ...Typography.bodySemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
