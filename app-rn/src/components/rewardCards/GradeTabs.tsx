import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SHOWROOM } from './cardTheme';

export interface GradeTab {
  key: string;
  label: string;
  /** 고른 칸을 칠하는 재질 색. */
  frame: readonly string[];
  chipText: string;
}

interface Props {
  tabs: readonly GradeTab[];
  selected: number;
  /** 내 카드의 등급. 이보다 위 칸은 아직 얻지 않은 견본이다. */
  owned: number;
  onSelect: (index: number) => void;
}

/** 카드 상세에서 같은 카드를 다른 등급으로 돌려 보는 칸. */
function GradeTabs({ tabs, selected, owned, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {tabs.map((tab, i) => (
        <Tab key={tab.key} tab={tab} index={i} selected={i === selected} sample={i > owned} onSelect={onSelect} />
      ))}
    </View>
  );
}

interface TabProps {
  tab: GradeTab;
  index: number;
  selected: boolean;
  sample: boolean;
  onSelect: (index: number) => void;
}

const Tab = React.memo(function Tab({ tab, index, selected, sample, onSelect }: TabProps) {
  const handlePress = useCallback(() => onSelect(index), [index, onSelect]);
  return (
    <Pressable onPress={handlePress} hitSlop={4} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      {selected ? (
        <LinearGradient
          colors={tab.frame as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fill, sample && styles.sampleBorder]}
        >
          <Text style={[styles.label, { color: tab.chipText }]} numberOfLines={1} adjustsFontSizeToFit>
            {tab.label}
          </Text>
        </LinearGradient>
      ) : (
        <View style={[styles.fill, styles.idle, sample && styles.sampleBorder]}>
          <Text style={[styles.label, sample ? styles.sampleText : styles.idleText]} numberOfLines={1} adjustsFontSizeToFit>
            {tab.label}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  tab: { flex: 1 },
  fill: { height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  idle: { backgroundColor: SHOWROOM.glass },
  sampleBorder: { borderWidth: 1, borderStyle: 'dashed', borderColor: SHOWROOM.fgDim },
  label: { fontSize: 11, fontWeight: '700' },
  idleText: { color: SHOWROOM.fg },
  sampleText: { color: SHOWROOM.fgDim },
  pressed: { opacity: 0.8 },
});

export default React.memo(GradeTabs);
