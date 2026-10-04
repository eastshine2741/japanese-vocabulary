import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { StreakPalette } from './palette';
import { CalendarCell, CalendarMonth, StreakMode, formatDayLabel } from './streakCalendar';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const CELL_HEIGHT = 46;
const ROW_GAP = 2;
const CHIP = 36;
const RING = 2;
const SIDE_PADDING = 20;

interface Props {
  months: CalendarMonth[];
  mode: StreakMode;
}

/**
 * 학습 달력 — 고정 헤더(달 이동 + 범례 + 요일) 아래에 달 단위로 가로 페이징되는 격자.
 * 칩 색은 그날 복습 카드 수, 셀 배경 띠는 현재 연속 구간이다.
 */
export const StreakCalendar = React.memo(function StreakCalendar({ months, mode }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(Math.max(months.length - 1, 0));
  const [selected, setSelected] = useState<CalendarCell | null>(null);

  const handleSelect = useCallback((cell: CalendarCell) => {
    setSelected((prev) => (prev?.date === cell.date ? null : cell));
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setPageWidth(e.nativeEvent.layout.width);
  }, []);

  // 처음에는 이번 달(마지막 페이지)을 보여준다.
  useEffect(() => {
    if (pageWidth <= 0) return;
    scrollRef.current?.scrollTo({ x: pageWidth * page, animated: false });
    // 페이지 폭이 정해질 때 한 번만 맞춘다 — 이후 이동은 onMomentumScrollEnd 가 따라간다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth]);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
    },
    [pageWidth],
  );

  const goPrev = useCallback(() => {
    if (page <= 0) return;
    const next = page - 1;
    setPage(next);
    scrollRef.current?.scrollTo({ x: pageWidth * next, animated: true });
  }, [page, pageWidth]);

  const goNext = useCallback(() => {
    if (page >= months.length - 1) return;
    const next = page + 1;
    setPage(next);
    scrollRef.current?.scrollTo({ x: pageWidth * next, animated: true });
  }, [page, pageWidth, months.length]);

  const rowCount = months.reduce((acc, m) => Math.max(acc, m.weeks.length), 0);
  const gridHeight = rowCount * CELL_HEIGHT + Math.max(rowCount - 1, 0) * ROW_GAP;

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>학습 달력</Text>
          <View style={styles.monthNav}>
            <NavButton icon="chevron-back" disabled={page <= 0} onPress={goPrev} />
            <Text style={styles.monthLabel}>{months[page]?.label ?? ''}</Text>
            <NavButton icon="chevron-forward" disabled={page >= months.length - 1} onPress={goNext} />
          </View>
        </View>

        <View style={styles.legendRow}>
          {selected?.date ? <DayReadout cell={selected} /> : <View />}
          <View style={styles.legend}>
            <Text style={styles.legendText}>적음</Text>
            {Colors.heatmapIntensities.map((color, i) => (
              <View key={i} style={[styles.legendCell, { backgroundColor: color }]} />
            ))}
            <Text style={styles.legendText}>많음</Text>
          </View>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={styles.weekday}>
              {w}
            </Text>
          ))}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={handleLayout}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.pager}
      >
        {months.map((month) => (
          <View key={month.key} style={[styles.month, { width: pageWidth, height: gridHeight }]}>
            {month.weeks.map((week, i) => (
              <View key={i} style={styles.week}>
                {week.map((cell, j) => (
                  <DayCell
                    key={cell.date ?? `pad-${i}-${j}`}
                    cell={cell}
                    mode={mode}
                    selected={cell.date != null && cell.date === selected?.date}
                    onSelect={handleSelect}
                  />
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

function NavButton({
  icon,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.navBtn, disabled && styles.navBtnDisabled, pressed && !disabled && styles.navBtnPressed]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
    >
      <Ionicons name={icon} size={20} color={Colors.textSecondary} />
    </Pressable>
  );
}

function DayReadout({ cell }: { cell: CalendarCell }) {
  return (
    <Text style={styles.readout}>
      {formatDayLabel(cell.date!)}
      {' · '}
      <Text style={styles.readoutCount}>
        {cell.kind === 'freeze' ? '프리즈' : `${cell.reviewCount}장`}
      </Text>
    </Text>
  );
}

const DayCell = React.memo(function DayCell({
  cell,
  mode,
  selected,
  onSelect,
}: {
  cell: CalendarCell;
  mode: StreakMode;
  selected: boolean;
  onSelect: (cell: CalendarCell) => void;
}) {
  if (cell.kind === 'pad') return <View style={styles.cell} />;

  const band = cell.inRun
    ? [
        styles.band,
        cell.runStart && styles.bandStart,
        cell.runEnd && styles.bandEnd,
      ]
    : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.cell, band, pressed && styles.cellPressed]}
      onPress={() => onSelect(cell)}
      disabled={cell.kind === 'future'}
    >
      <Chip cell={cell} mode={mode} selected={selected} />
    </Pressable>
  );
});

function Chip({ cell, mode, selected }: { cell: CalendarCell; mode: StreakMode; selected: boolean }) {
  const chip = <ChipBody cell={cell} />;
  if (selected) {
    // 선택 링은 오늘 링을 덮는다 — 오늘 칩이 선택돼도 어느 칸인지 분명해야 한다.
    const ringColor = selectRingColor(cell);
    return <View style={[styles.ring, styles.selectedRing, { borderColor: ringColor, shadowColor: ringColor }]}>{chip}</View>;
  }
  if (!cell.isToday) return chip;
  // 오늘 칩만 링을 두른다 — 프리즈로 이어진 날은 링도 파랑으로 간다.
  const ringColor = mode === 'frozen' ? Colors.freezeStroke : Colors.streakFlame;
  return <View style={[styles.ring, styles.todayRing, { borderColor: ringColor, shadowColor: ringColor }]}>{chip}</View>;
}

/** 선택 링은 칩 색을 따른다. 빈 날 칩은 바탕과 거의 같아 회색으로 대신한다. */
function selectRingColor(cell: CalendarCell): string {
  if (cell.kind === 'freeze') return Colors.freezeStroke;
  if (cell.kind !== 'studied') return Colors.textMuted;
  return cell.inRun ? StreakPalette.runRamp[cell.level - 1] : Colors.heatmapIntensities[cell.level];
}

function ChipBody({ cell }: { cell: CalendarCell }) {
  if (cell.kind === 'future') {
    return (
      <View style={styles.chip}>
        <Text style={[styles.dayNum, styles.dayNumFuture]}>{cell.dayNumber}</Text>
      </View>
    );
  }

  if (cell.kind === 'freeze') {
    return (
      <View style={[styles.chip, styles.chipFreeze]}>
        <Ionicons name="snow" size={22} color={Colors.freezeStroke} style={styles.freezeIcon} />
        <Text style={[styles.dayNum, { color: StreakPalette.freezeInk }]}>{cell.dayNumber}</Text>
      </View>
    );
  }

  if (cell.kind === 'none') {
    return (
      <View style={[styles.chip, { backgroundColor: Colors.heatmapIntensities[0] }]}>
        <Text style={[styles.dayNum, { color: Colors.textMuted }]}>{cell.dayNumber}</Text>
      </View>
    );
  }

  const inRun = cell.inRun;
  const background = inRun
    ? StreakPalette.runRamp[cell.level - 1]
    : Colors.heatmapIntensities[cell.level];
  const ink = cell.level === 4
    ? (inRun ? StreakPalette.runInkOn : StreakPalette.grassInkOn)
    : (inRun ? StreakPalette.runInk : StreakPalette.grassInk);

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      <Text style={[styles.dayNum, { color: ink }]}>{cell.dayNumber}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SIDE_PADDING,
    paddingBottom: 8,
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.headingBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navBtnPressed: {
    backgroundColor: Colors.surfaceSubtle,
  },
  monthLabel: {
    ...Typography.headingBold,
    width: 52,
    fontSize: 15,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readout: {
    ...Typography.bodySemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  readoutCount: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
  },
  legendText: {
    ...Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.textMuted,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekday: {
    ...Typography.bodySemiBold,
    flex: 1,
    fontSize: 11,
    textAlign: 'center',
    color: Colors.textMuted,
  },

  pager: {
    marginTop: 10,
  },
  month: {
    paddingHorizontal: SIDE_PADDING,
    gap: ROW_GAP,
  },
  week: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  band: {
    backgroundColor: StreakPalette.runBand,
  },
  bandStart: {
    borderTopLeftRadius: CELL_HEIGHT / 2,
    borderBottomLeftRadius: CELL_HEIGHT / 2,
  },
  bandEnd: {
    borderTopRightRadius: CELL_HEIGHT / 2,
    borderBottomRightRadius: CELL_HEIGHT / 2,
  },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipFreeze: {
    backgroundColor: Colors.freezeFill,
    borderWidth: 1,
    borderColor: Colors.freezeStroke,
  },
  freezeIcon: {
    position: 'absolute',
    opacity: 0.3,
  },
  cellPressed: {
    opacity: 0.6,
  },
  ring: {
    padding: RING,
    borderRadius: 12 + RING,
    borderWidth: RING,
  },
  selectedRing: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 2,
    transform: [{ scale: 1.04 }],
  },
  todayRing: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 2,
  },
  dayNum: {
    ...Typography.bodyBold,
    fontSize: 12,
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
  },
  dayNumFuture: {
    ...Typography.bodySemiBold,
    color: StreakPalette.futureInk,
  },
});
