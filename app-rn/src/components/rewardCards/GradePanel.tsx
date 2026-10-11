import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SHOWROOM } from './cardTheme';

export interface GradeTab {
  key: string;
  label: string;
  /** 지나온 칸을 칠하는 재질 색. */
  frame: readonly string[];
}

interface Props {
  tabs: readonly GradeTab[];
  /** 내 카드의 등급. 이보다 위 칸은 아직 얻지 않은 견본이다. */
  owned: number;
  selected: number;
  /** 다음 등급까지의 진행. 다음 칸을 이만큼 채운다. */
  progress: { current: number; total: number } | null;
  condition: (rung: number) => string;
  onSelect: (index: number) => void;
}

/** 등급 사다리와 조건을 한 덩어리로 보인다. 내 등급을 보면 다음 등급 조건, 다른 칸을 누르면 그 등급 견본과 조건. */
function GradePanel({ tabs, owned, selected, progress, condition, onSelect }: Props) {
  const target = selected === owned ? owned + 1 : selected;
  const top = target >= tabs.length;
  const caption = top
    ? tabs[owned].label
    : selected === owned
      ? `다음 등급 · ${tabs[target].label}`
      : `${tabs[target].label} · ${target < owned ? '얻음' : '견본'}`;
  const showProgress = !top && target === owned + 1 && progress != null;
  const ratio = showProgress ? Math.min(1, progress.current / Math.max(1, progress.total)) : 0;

  return (
    <View style={styles.panel}>
      <Text style={styles.caption}>{caption}</Text>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={2}>
          {top ? '가장 높은 등급' : condition(target)}
        </Text>
        {showProgress && (
          <Text style={styles.value}>
            {progress.current}
            <Text style={styles.total}> / {progress.total}</Text>
          </Text>
        )}
        {!top && target <= owned && <Feather name="check" size={15} color={SHOWROOM.fg} />}
      </View>
      <View style={styles.ladder}>
        {tabs.map((tab, i) => (
          <Rung
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
    </View>
  );
}

interface RungProps {
  tab: GradeTab;
  index: number;
  selected: boolean;
  reached: boolean;
  fill: number;
  onSelect: (index: number) => void;
}

const Rung = React.memo(function Rung({ tab, index, selected, reached, fill, onSelect }: RungProps) {
  const handlePress = useCallback(() => onSelect(index), [index, onSelect]);
  const colors = tab.frame as [string, string, ...string[]];
  return (
    <Pressable onPress={handlePress} hitSlop={{ top: 10, bottom: 6 }} style={styles.rung}>
      <View style={[styles.bar, selected && styles.barSelected]}>
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
      </View>
      <Text
        style={[styles.label, reached ? styles.labelReached : styles.labelAhead, selected && styles.labelSelected]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {tab.label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderRadius: 14, backgroundColor: SHOWROOM.glass, gap: 4 },
  caption: { color: SHOWROOM.fgDim, fontSize: 11, fontWeight: '500' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, minHeight: 20 },
  title: { flex: 1, color: SHOWROOM.fg, fontSize: 13, fontWeight: '600' },
  value: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  total: { color: SHOWROOM.fgDim, fontSize: 12, fontWeight: '500' },
  ladder: { flexDirection: 'row', gap: 4, marginTop: 6 },
  rung: { flex: 1, gap: 4 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#FFFFFF1F' },
  barSelected: { borderWidth: 1, borderColor: SHOWROOM.fg },
  partial: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  label: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  labelReached: { color: SHOWROOM.fgDim },
  labelAhead: { color: '#FFFFFF4D' },
  labelSelected: { color: SHOWROOM.fg, fontWeight: '800' },
});

export default React.memo(GradePanel);
