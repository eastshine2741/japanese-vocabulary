import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { useStudyStatsStore } from '../../stores/studyStatsStore';
import { Colors } from '../../theme/theme';
import { HeatmapDay } from '../../types/studyStats';

const CELL = 14;
const GAP = 3;
const ROWS = 7;
const COLS = 16; // matches Pencil heatmap design (16 weeks)
const ROW_LABEL_WIDTH = 18;
const ROW_LABEL_GAP = 6;
const ROW_LABELS: Record<number, string> = { 1: '월', 3: '수', 5: '금' };
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

interface HeatmapSectionProps {
  /** 연속·최장 기록과 날짜별 수치는 연속 학습 상세가 보여준다. */
  onPressMore: () => void;
}

/** 내 학습 기록. */
export default React.memo(function HeatmapSection({ onPressMore }: HeatmapSectionProps) {
  const { heatmap, loadHeatmap } = useStudyStatsStore(
    useShallow((s) => ({
      heatmap: s.heatmap,
      loadHeatmap: s.loadHeatmap,
    })),
  );

  useFocusEffect(
    useCallback(() => {
      if (heatmap.status === 'idle' || heatmap.staleAt > 0) {
        loadHeatmap(heatmap.staleAt > 0);
      }
    }, [heatmap.status, heatmap.staleAt, loadHeatmap]),
  );

  return <HeatmapView days={heatmap.data?.days} onPressMore={onPressMore} />;
});

interface HeatmapViewProps {
  days: HeatmapDay[] | undefined;
  /** 없으면 제목만 그리고 상세로 넘어가지 않는다. */
  onPressMore?: () => void;
}

export const HeatmapView = React.memo(function HeatmapView({ days, onPressMore }: HeatmapViewProps) {
  const cells = useMemo(() => computeGrid(days ?? []), [days]);

  const visibleMax = useMemo(() => {
    if (!days) return 0;
    return days.reduce((acc, d) => (d.reviewCount > acc ? d.reviewCount : acc), 0);
  }, [days]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const handleSelect = useCallback((date: string) => {
    setSelectedDate((prev) => (prev === date ? null : date));
  }, []);

  const selectedDay = useMemo(() => {
    if (!selectedDate || !days) return null;
    return days.find((d) => d.date === selectedDate) ?? null;
  }, [selectedDate, days]);

  return (
    <View style={styles.section}>
      {onPressMore ? (
        <Pressable
          style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
          onPress={onPressMore}
          hitSlop={8}
        >
          <Text style={styles.title}>학습 기록</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      ) : (
        <Text style={styles.title}>학습 기록</Text>
      )}

      <View style={styles.body}>
        <View style={styles.grid}>
          <View style={styles.labelCol}>
            {Array.from({ length: ROWS }).map((_, r) => (
              <View key={r} style={styles.labelCell}>
                <Text style={styles.labelText}>{ROW_LABELS[r] ?? ''}</Text>
              </View>
            ))}
          </View>
          <View>
            {Array.from({ length: ROWS }).map((_, r) => (
              <View key={r} style={styles.gridRow}>
                {Array.from({ length: COLS }).map((_, c) => {
                  const cell = cells[c * ROWS + r];
                  const date = cell.kind === 'day' ? cell.day.date : null;
                  return (
                    <Cell
                      key={c}
                      cell={cell}
                      max={visibleMax}
                      selected={!!date && date === selectedDate}
                      onSelect={handleSelect}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
        <View style={styles.footer}>
          <View style={styles.selection}>
            {selectedDay ? (
              <>
                <Text style={styles.selCount}>
                  {selectedDay.freezeUsed && selectedDay.reviewCount === 0
                    ? '프리즈'
                    : `${selectedDay.reviewCount}회`}
                </Text>
                <Text style={styles.selDate}>{formatKoreanDate(selectedDay.date)}</Text>
              </>
            ) : null}
          </View>
          <View style={styles.legend}>
            <Text style={styles.legendText}>적음</Text>
            {Colors.heatmapIntensities.map((color, i) => (
              <View key={i} style={[styles.legendCell, { backgroundColor: color }]} />
            ))}
            <Text style={styles.legendText}>많음</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

type CellState =
  | { kind: 'empty' }
  | { kind: 'day'; day: HeatmapDay };

const Cell = React.memo(function Cell({
  cell,
  max,
  selected,
  onSelect,
}: {
  cell: CellState;
  max: number;
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  if (cell.kind === 'empty') {
    return <View style={[styles.cell, { backgroundColor: Colors.heatmapIntensities[0] }]} />;
  }
  const date = cell.day.date;
  const handlePress = () => onSelect(date);
  const ringStyle = selected ? styles.cellSelected : null;
  if (cell.day.freezeUsed && cell.day.reviewCount === 0) {
    return (
      <Pressable onPress={handlePress} style={[styles.cell, styles.cellFreeze, ringStyle]}>
        <Ionicons name="snow" size={10} color={Colors.freezeStroke} />
      </Pressable>
    );
  }
  const level = computeLevel(cell.day.reviewCount, max);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.cell, { backgroundColor: Colors.heatmapIntensities[level] }, ringStyle]}
    />
  );
});

function formatKoreanDate(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KO[d.getDay()]})`;
}

function computeLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const pct = count / max;
  if (pct >= 1.0) return 4;
  if (pct >= 0.75) return 3;
  if (pct >= 0.5) return 2;
  return 1;
}

/** Column-major 16×7 grid, row 0 = Monday. The last day is anchored to its weekday and earlier days fill backward. */
function computeGrid(days: HeatmapDay[]): CellState[] {
  const grid: CellState[] = Array.from({ length: COLS * ROWS }, () => ({ kind: 'empty' }));
  if (days.length === 0) return grid;

  const lastDate = parseISODate(days[days.length - 1].date);
  const lastRow = mondayBasedRow(lastDate);
  const lastIndex = (COLS - 1) * ROWS + lastRow;

  for (let i = days.length - 1; i >= 0; i--) {
    const idx = lastIndex - (days.length - 1 - i);
    if (idx < 0) break;
    grid[idx] = { kind: 'day', day: days[i] };
  }
  return grid;
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function mondayBasedRow(date: Date): number {
  // JS getDay(): 0=Sun..6=Sat. We want Mon=0..Sun=6.
  const js = date.getDay();
  return (js + 6) % 7;
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  header: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  headerPressed: { opacity: 0.5 },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  body: {
    alignSelf: 'flex-start',
    gap: 4,
  },
  grid: {
    flexDirection: 'row',
    gap: ROW_LABEL_GAP,
  },
  labelCol: {
    width: ROW_LABEL_WIDTH,
    gap: GAP,
  },
  labelCell: {
    height: CELL,
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },
  cellFreeze: {
    backgroundColor: Colors.freezeFill,
    borderWidth: 1,
    borderColor: Colors.freezeStroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: {
    borderWidth: 1.5,
    borderColor: Colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: ROW_LABEL_WIDTH + ROW_LABEL_GAP,
  },
  selection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selCount: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  selDate: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  legendText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
