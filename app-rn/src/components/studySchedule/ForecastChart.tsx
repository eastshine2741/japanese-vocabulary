import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { ScheduleForecastDay } from '../../types/studySchedule';
import { cumulativeBacklog } from './scheduleMath';

const CHART_HEIGHT = 142;
const VALUE_LABEL_HEIGHT = 15;
const BAR_AREA = CHART_HEIGHT - VALUE_LABEL_HEIGHT - 1;
/** 0 이 아닌 값은 최소 이만큼은 보이게 둔다. */
const MIN_BAR = 2;
/** 주 단위 눈금. 인덱스 -> 라벨. */
const WEEK_TICKS: Record<number, string> = { 0: '오늘', 7: '1주', 14: '2주', 21: '3주', 28: '4주' };

interface Props {
  days: ScheduleForecastDay[];
  dailyTarget: number;
}

/**
 * 30일 예보. 날짜마다 막대 두 개를 쌓는다 — 위는 미루면 쌓이는 누적량, 아래는 목표대로
 * 했을 때 그날 보는 양. 오늘(0일차)만 둘이 같아서 accent 막대 하나로 합친다.
 */
export const ForecastChart = React.memo(function ForecastChart({ days, dailyTarget }: Props) {
  const { backlog, max } = useMemo(() => {
    const acc = cumulativeBacklog(days);
    return { backlog: acc, max: Math.max(1, ...acc) };
  }, [days]);

  const scale = (value: number) =>
    value <= 0 ? 0 : Math.max(MIN_BAR, Math.round((value / max) * BAR_AREA));

  const lastIndex = days.length - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.chartBox}>
        {days.map((day, i) => {
          const isFirst = i === 0;
          const isLast = i === lastIndex;
          return (
            <View
              key={day.date}
              style={[styles.col, isLast && styles.colEnd, isFirst && styles.colStart]}
            >
              {isFirst && <Text style={[styles.value, styles.valueToday]}>{day.scheduledDue}</Text>}
              {isLast && <Text style={[styles.value, styles.valuePile]}>{backlog[i]}</Text>}
              {isFirst ? (
                <View style={[styles.today, { height: scale(backlog[i]) }]} />
              ) : (
                <>
                  <View style={[styles.pile, { height: scale(backlog[i]) }]} />
                  <View style={[styles.daily, { height: scale(day.simulatedReview) }]} />
                </>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.dayRow}>
        {days.map((day, i) => (
          <View key={day.date} style={styles.dayCell}>
            {WEEK_TICKS[i] != null && (
              <Text style={[styles.dayLabel, i === 0 && styles.dayLabelToday]}>{WEEK_TICKS[i]}</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <LegendItem color={Colors.forecastDaily} label={`매일 ${dailyTarget}장씩 하면`} />
        <LegendItem color={Colors.forecastPile} label="매일 미루면 쌓이는 양" />
      </View>
    </View>
  );
});

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  chartBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: CHART_HEIGHT,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 1,
  },
  colStart: {
    alignItems: 'flex-start',
  },
  colEnd: {
    alignItems: 'flex-end',
  },
  value: {
    ...Typography.bodyBold,
    height: VALUE_LABEL_HEIGHT,
    fontSize: 11,
  },
  valueToday: {
    color: Colors.primary,
  },
  valuePile: {
    color: Colors.forecastPile,
  },
  today: {
    alignSelf: 'stretch',
    borderRadius: 1,
    backgroundColor: Colors.primary,
  },
  pile: {
    alignSelf: 'stretch',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
    backgroundColor: Colors.forecastPile,
  },
  daily: {
    alignSelf: 'stretch',
    borderRadius: 1,
    backgroundColor: Colors.forecastDaily,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 2,
  },
  dayCell: {
    flex: 1,
    height: 14,
  },
  dayLabel: {
    ...Typography.bodyBold,
    fontSize: 10,
    color: Colors.textMuted,
  },
  dayLabelToday: {
    color: Colors.primary,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  legendLabel: {
    ...Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
