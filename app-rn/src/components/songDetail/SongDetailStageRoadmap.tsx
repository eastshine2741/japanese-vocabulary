import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import type { SongWordStageDto, SongWordStageKey } from '../../types/song';
import { PrimaryButton } from '../PrimaryButton';
import WordMasteryProgressBar from '../WordMasteryProgressBar';
import { resolveStageStatuses, selectCurrentStage, SongWordStageStatus } from './songDetailWordDerivation';

interface SongDetailStageRoadmapProps {
  stages: readonly SongWordStageDto[];
  isStartingLearning?: boolean;
  onStartStage: (stage: SongWordStageDto) => void;
}

export const SongDetailStageRoadmap = React.memo(function SongDetailStageRoadmap({
  stages,
  isStartingLearning = false,
  onStartStage,
}: SongDetailStageRoadmapProps) {
  const statuses = useMemo(() => resolveStageStatuses(stages), [stages]);
  const currentKey = useMemo(() => selectCurrentStage(stages)?.key ?? null, [stages]);
  const [expandedKey, setExpandedKey] = useState<SongWordStageKey | null>(currentKey);

  useEffect(() => {
    setExpandedKey(currentKey);
  }, [currentKey]);

  const handleToggle = useCallback((key: SongWordStageKey) => {
    setExpandedKey(prev => (prev === key ? null : key));
  }, []);

  if (stages.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>학습 로드맵</Text>
      </View>
      <View style={styles.roadmap}>
        {stages.map((stage, index) => (
          <StageRow
            key={stage.key}
            stage={stage}
            status={statuses[index]}
            isExpanded={expandedKey === stage.key}
            isLast={index === stages.length - 1}
            isStartingLearning={isStartingLearning}
            onToggle={handleToggle}
            onStartStage={onStartStage}
          />
        ))}
      </View>
    </View>
  );
});

interface StageRowProps {
  stage: SongWordStageDto;
  status: SongWordStageStatus;
  isExpanded: boolean;
  isLast: boolean;
  isStartingLearning: boolean;
  onToggle: (key: SongWordStageKey) => void;
  onStartStage: (stage: SongWordStageDto) => void;
}

const StageRow = React.memo(function StageRow({
  stage,
  status,
  isExpanded,
  isLast,
  isStartingLearning,
  onToggle,
  onStartStage,
}: StageRowProps) {
  const handleToggle = useCallback(() => {
    onToggle(stage.key);
  }, [onToggle, stage.key]);
  const handleStart = useCallback(() => {
    onStartStage(stage);
  }, [onStartStage, stage]);

  const isCurrent = status === 'current';
  const isDone = status === 'done';
  const nameColor = isCurrent ? Colors.textPrimary : Colors.textSecondary;
  const metaColor = isCurrent ? Colors.textSecondary : Colors.textMuted;

  return (
    <View style={styles.stageRow}>
      <View style={styles.rail}>
        <View style={[styles.badge, isCurrent && styles.badgeCurrent]}>
          {isDone ? (
            <Feather name="check" size={18} color={Colors.textMuted} />
          ) : (
            <Text style={[styles.badgeNumber, isCurrent && styles.badgeNumberCurrent]}>{stage.order}</Text>
          )}
        </View>
        {!isLast && <View style={styles.railLine} />}
      </View>

      <View style={[styles.body, isLast && styles.bodyLast]}>
        <Pressable
          style={styles.stageHeader}
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={`${stage.name} 단계, ${stage.knownCount}/${stage.totalCount}`}
        >
          <View style={styles.titleGroup}>
            <Text style={[styles.stageName, { color: nameColor }]}>{stage.name}</Text>
            <Text style={[styles.stageDesc, { color: metaColor }]} numberOfLines={1}>
              {stage.description}
            </Text>
          </View>
          <Text style={[styles.stageCount, { color: metaColor }]}>
            {stage.knownCount}/{stage.totalCount}
          </Text>
          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={metaColor} />
        </Pressable>

        {isExpanded && (
          <>
            <WordMasteryProgressBar
              totalCount={stage.totalCount}
              masteredCount={stage.knownCount}
              studyingCount={stage.learningCount}
            />
            {!isDone && (
              <PrimaryButton
                label={`${stage.name} 학습하기`}
                onPress={handleStart}
                disabled={isStartingLearning || stage.totalCount === 0}
                style={styles.learnButton}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 17,
  },
  roadmap: {
    paddingTop: 4,
  },
  stageRow: {
    flexDirection: 'row',
    gap: 14,
  },
  rail: {
    width: 32,
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.wordMasteryTrackBackground,
  },
  badgeCurrent: {
    backgroundColor: Colors.primary,
  },
  badgeNumber: {
    ...Typography.headingBold,
    color: Colors.textMuted,
    fontSize: 15,
  },
  badgeNumberCurrent: {
    color: '#FFFFFF',
  },
  railLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
  },
  body: {
    flex: 1,
    gap: 12,
    paddingTop: 4,
    paddingBottom: 26,
  },
  bodyLast: {
    paddingBottom: 4,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 24,
  },
  titleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stageName: {
    ...Typography.headingBold,
    fontSize: 15,
  },
  stageDesc: {
    ...Typography.body,
    flexShrink: 1,
    fontSize: 12,
  },
  stageCount: {
    ...Typography.bodySemiBold,
    fontSize: 12,
  },
  learnButton: {
    height: 40,
    borderRadius: 20,
  },
});
