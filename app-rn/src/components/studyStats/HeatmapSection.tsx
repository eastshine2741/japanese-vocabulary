import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

export default React.memo(function HeatmapSection() {
  const { heatmap, profile, loadHeatmap, loadProfile } = useStudyStatsStore(
    useShallow((s) => ({
      heatmap: s.heatmap,
      profile: s.profile,
      loadHeatmap: s.loadHeatmap,
      loadProfile: s.loadProfile,
    })),
  );

  useEffect(() => {
    if (heatmap.status === 'idle' || heatmap.staleAt > 0) {
      loadHeatmap(heatmap.staleAt > 0);
    }
    if (profile.status === 'idle' || profile.staleAt > 0) {
      loadProfile(profile.staleAt > 0);
    }
  }, [heatmap.status, heatmap.staleAt, profile.status, profile.staleAt, loadHeatmap, loadProfile]);

  const cells = useMemo(() => {
    return computeGrid(heatmap.data?.days ?? []);
  }, [heatmap.data]);

  const visibleMax = useMemo(() => {
    if (!heatmap.data) return 0;
    return heatmap.data.days.reduce((acc, d) => (d.reviewCount > acc ? d.reviewCount : acc), 0);
  }, [heatmap.data]);

  const totalDays = profile.data?.totalStudyDays ?? 0;
  const freezeCount = profile.data?.freezeCount ?? 0;
  const freezeMax = profile.data?.freezeMax ?? 2;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>학습 기록</Text>
        <View style={styles.right}>
          <Ionicons name="snow" size={11} color={Colors.primary} />
          <Text style={styles.freezeText}>{freezeCount}/{freezeMax}</Text>
          <Text style={styles.dotSep}>·</Text>
          <Text style={styles.totalText}>총 {totalDays}일</Text>
        </View>
      </View>

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
                return <Cell key={c} cell={cell} max={visibleMax} />;
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>적음</Text>
        {Colors.heatmapIntensities.map((color, i) => (
          <View key={i} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <Text style={styles.legendText}>많음</Text>
      </View>
    </View>
  );
});

type CellState =
  | { kind: 'empty' }
  | { kind: 'day'; day: HeatmapDay };

function Cell({ cell, max }: { cell: CellState; max: number }) {
  if (cell.kind === 'empty') {
    return <View style={[styles.cell, { backgroundColor: Colors.heatmapIntensities[0] }]} />;
  }
  if (cell.day.freezeUsed && cell.day.reviewCount === 0) {
    return (
      <View style={[styles.cell, styles.cellFreeze]}>
        <Ionicons name="snow" size={10} color={Colors.primary} />
      </View>
    );
  }
  const level = computeLevel(cell.day.reviewCount, max);
  return (
    <View style={[styles.cell, { backgroundColor: Colors.heatmapIntensities[level] }]} />
  );
}

function computeLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const pct = count / max;
  if (pct >= 1.0) return 4;
  if (pct >= 0.75) return 3;
  if (pct >= 0.5) return 2;
  return 1;
}

/**
 * Lays out `days` (chronological, oldest→today) into a 16×7 column-major grid
 * where row 0 = Monday … row 6 = Sunday. Anchors the LAST cell to today's
 * weekday, walking backward to place earlier days.
 */
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  freezeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  dotSep: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  totalText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
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
    backgroundColor: '#E8F0F9',
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
