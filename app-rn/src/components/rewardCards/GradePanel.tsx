import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SHOWROOM } from './cardTheme';
import type { CardGoal } from './types';

export interface GradeTab {
  key: string;
  label: string;
  /** 얻은 칸을 칠하는 등급 색. */
  frame: readonly string[];
  /** 등급 위 글씨 색. */
  ink: string;
}

interface Props {
  tabs: readonly GradeTab[];
  /** 내 카드의 등급. 이보다 위 칸은 아직 얻지 않은 견본이다. */
  owned: number;
  selected: number;
  /** 얻지 않은 등급(칸 자리)마다의 진행. 다음 칸은 이만큼 채운다. */
  goals: Partial<Record<number, CardGoal>>;
  condition: (rung: number) => string;
  onSelect: (index: number) => void;
}

/** 등급 칩 줄과 선택한 칩의 조건 한 줄. 다음 등급까지의 진행은 그 칩을 채워 보이고, 얻지 않은 칩을 고르면 그 등급의 진행이 숫자로 보인다. */
function GradePanel({ tabs, owned, selected, goals, condition, onSelect }: Props) {
  const nextGoal = goals[owned + 1];
  const ratio = nextGoal != null ? Math.min(1, nextGoal.current / Math.max(1, nextGoal.total)) : 0;
  const progress = selected > owned ? goals[selected] : undefined;

  return (
    <View style={styles.panel}>
      <View style={styles.chips}>
        {tabs.map((tab, i) => (
          <GradeChip
            key={tab.key}
            tab={tab}
            index={i}
            selected={i === selected}
            reached={i <= owned}
            fill={i === owned + 1 ? ratio : 0}
            onSelect={onSelect}
          />
        ))}
      </View>
      <View style={styles.goal}>
        <Text style={styles.goalText} numberOfLines={2}>
          {condition(selected)}
        </Text>
        {progress != null && (
          <Text style={styles.value}>
            {progress.current}
            <Text style={styles.total}> / {progress.total}</Text>
          </Text>
        )}
        {selected <= owned && <Feather name="check" size={15} color={SHOWROOM.fg} />}
      </View>
    </View>
  );
}

interface ChipProps {
  tab: GradeTab;
  index: number;
  selected: boolean;
  reached: boolean;
  fill: number;
  onSelect: (index: number) => void;
}

const GradeChip = React.memo(function GradeChip({ tab, index, selected, reached, fill, onSelect }: ChipProps) {
  const handlePress = useCallback(() => onSelect(index), [index, onSelect]);
  const colors = tab.frame as [string, string, ...string[]];
  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8 }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
    >
      {reached ? (
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : (
        fill > 0 && (
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.partial, { width: `${fill * 100}%` }]}
          />
        )
      )}
      <Text
        style={[styles.label, reached ? { color: tab.ink } : styles.labelAhead]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {tab.label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, borderRadius: 14, backgroundColor: SHOWROOM.glass, gap: 10 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF1F',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chipSelected: { borderColor: SHOWROOM.fg },
  chipPressed: { opacity: 0.7 },
  partial: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.45 },
  label: { fontSize: 11, fontWeight: '700' },
  labelAhead: { color: '#FFFFFF73' },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 20, paddingHorizontal: 2 },
  goalText: { flex: 1, color: SHOWROOM.fg, fontSize: 13, fontWeight: '600' },
  value: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  total: { color: SHOWROOM.fgDim, fontSize: 12, fontWeight: '500' },
});

export default React.memo(GradePanel);
