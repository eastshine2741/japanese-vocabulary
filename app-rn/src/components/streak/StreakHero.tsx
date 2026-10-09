import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { FlameMark, GLOW_FALLOFF, IceMark } from './FlameMark';
import { FrozenPalette, StreakPalette } from './palette';
import { StreakMode } from './streakCalendar';

const ICON_SIZE = 124;

const CHIP_TEXT: Record<StreakMode, string> = {
  done: '오늘 복습 완료',
  pending: '오늘 복습이 남았어요',
  frozen: '어제는 프리즈로 지켰어요',
};

interface Props {
  streak: number;
  mode: StreakMode;
}

/**
 * 크림(또는 프리즈 상태의 파랑) 히어로 밴드. 왼쪽 상태 칩 + 큰 숫자, 오른쪽 불꽃/눈송이의
 * 비대칭 배치가 이 화면의 첫인상이다.
 */
export const StreakHero = React.memo(function StreakHero({ streak, mode }: Props) {
  const frozen = mode === 'frozen';
  const bg = frozen ? FrozenPalette.heroBg : StreakPalette.heroBg;
  const glow = frozen ? FrozenPalette.heroGlow : StreakPalette.heroGlow;

  return (
    <View style={[styles.band, { backgroundColor: bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            {/* 밴드보다 크게 잡아 감쇠 꼬리가 화면 밖에서 끝나게 둔다. */}
            <RadialGradient id="streakHeroGlow" cx="82%" cy="30%" rx="62%" ry="95%">
              {GLOW_FALLOFF.map(([at, a]) => (
                <Stop key={at} offset={at} stopColor={glow} stopOpacity={(frozen ? 0.42 : 0.46) * a} />
              ))}
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#streakHeroGlow)" />
        </Svg>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <StatusChip mode={mode} />
          <View style={styles.numBlock}>
            <Text style={[styles.num, { color: frozen ? FrozenPalette.heroNum : StreakPalette.heroNum }]}>
              {streak}
            </Text>
            <Text
              style={[styles.numLabel, { color: frozen ? FrozenPalette.heroNumLabel : StreakPalette.heroNumLabel }]}
            >
              일 연속 학습
            </Text>
          </View>
        </View>
        <HeroIcon mode={mode} />
      </View>
    </View>
  );
});

function StatusChip({ mode }: { mode: StreakMode }) {
  const frozen = mode === 'frozen';
  const border = frozen
    ? FrozenPalette.chipBorder
    : mode === 'done'
      ? StreakPalette.chipBorder
      : Colors.border;
  const tint = frozen
    ? FrozenPalette.chipText
    : mode === 'done'
      ? StreakPalette.chipText
      : Colors.textSecondary;
  const iconColor = frozen
    ? FrozenPalette.chipIcon
    : mode === 'done'
      ? StreakPalette.chipIcon
      : Colors.textSecondary;
  const icon = frozen ? 'snow' : mode === 'done' ? 'checkmark-circle' : 'time-outline';

  return (
    <View style={[styles.chip, { borderColor: border }]}>
      <Ionicons name={icon} size={15} color={iconColor} />
      <Text style={[styles.chipText, { color: tint }]}>{CHIP_TEXT[mode]}</Text>
    </View>
  );
}

function HeroIcon({ mode }: { mode: StreakMode }) {
  if (mode === 'frozen') {
    return <IceMark size={ICON_SIZE} color={FrozenPalette.heroIcon} />;
  }
  if (mode === 'pending') {
    // 기록은 살아 있지만 오늘은 아직 — 숫자는 주황 그대로 두고 불꽃만 식혀 멈춰 세운다.
    return <FlameMark size={ICON_SIZE} colors={StreakPalette.heroFlameDim} animated={false} />;
  }
  return <FlameMark size={ICON_SIZE} ember={StreakPalette.heroEmber} />;
}

const styles = StyleSheet.create({
  band: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  row: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  col: {
    gap: 10,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    ...Typography.bodyBold,
    fontSize: 12,
  },
  numBlock: {
    gap: 2,
  },
  num: {
    ...Typography.headingExtraBold,
    fontSize: 80,
    lineHeight: 80,
    letterSpacing: -3,
  },
  numLabel: {
    ...Typography.headingExtraBold,
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: -0.4,
  },
});
