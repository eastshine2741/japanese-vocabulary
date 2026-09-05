import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { JLPT_COLORS, selectMajorWords } from './songDetailWordDerivation';
import { getSongDetailWordKey } from './songDetailWordSave';
import { SongDetailWordItem } from './types';

interface MajorWordCardProps {
  word: SongDetailWordItem;
  isBusy: boolean;
  onStartWordLearning: (word: SongDetailWordItem) => void;
}

interface SongDetailMajorWordsProps {
  words: readonly SongDetailWordItem[];
  isLoading?: boolean;
  onViewAllWordsPress?: () => void;
  busyWordKey?: string | null;
  onStartWordLearning: (word: SongDetailWordItem) => void;
}

const MajorWordCard = React.memo(function MajorWordCard({
  word,
  isBusy,
  onStartWordLearning,
}: MajorWordCardProps) {
  const handlePress = useCallback(() => {
    onStartWordLearning(word);
  }, [onStartWordLearning, word]);
  const label = word.baseForm || word.japanese || word.surface;
  const jlptColor = getJlptColor(word.jlpt);

  return (
    <TouchableOpacity
      style={[styles.wordCard, isBusy && styles.wordCardBusy]}
      onPress={handlePress}
      activeOpacity={0.78}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityLabel={`${label} 단어로 학습 시작`}
    >
      <View style={styles.cardBadgeRow}>
        {word.jlpt ? (
          <View style={styles.jlptBadge}>
            <Text style={[styles.jlptText, { color: jlptColor }]}>{word.jlpt}</Text>
          </View>
        ) : <View />}
      </View>
      <View style={styles.wordTextBlock}>
        <Text style={styles.japanese} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {label}
        </Text>
      </View>
      <View style={styles.maskButton}>
        {isBusy ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <>
            <LucideIcon name="eye-off" size={12} color={Colors.textMuted} />
            <Text style={styles.maskLabel}>뜻 확인하기</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
});

export const SongDetailMajorWords = React.memo(function SongDetailMajorWords({
  words,
  isLoading = false,
  onViewAllWordsPress,
  busyWordKey,
  onStartWordLearning,
}: SongDetailMajorWordsProps) {
  const majorWords = useMemo(() => selectMajorWords(words), [words]);
  const handleViewAll = useCallback(() => {
    onViewAllWordsPress?.();
  }, [onViewAllWordsPress]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>핵심 단어</Text>
        <Text style={styles.description}>뜻을 보기 전에, 아는 단어인지 먼저 떠올려 보세요.</Text>
      </View>

      {isLoading ? (
        <View style={styles.list}>
          <View style={styles.stateBox}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.stateText}>단어를 불러오는 중이에요.</Text>
          </View>
        </View>
      ) : majorWords.length === 0 ? (
        <View style={styles.list}>
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>아직 표시할 단어가 없어요.</Text>
          </View>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardRail}
          style={styles.cardRailWrap}
        >
          {majorWords.map(word => {
            const wordKey = getSongDetailWordKey(word);
            return (
              <MajorWordCard
                key={wordKey}
                word={word}
                isBusy={busyWordKey === wordKey}
                onStartWordLearning={onStartWordLearning}
              />
            );
          })}
        </ScrollView>
      )}

      <View style={styles.viewAllWrap}>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={handleViewAll}
          activeOpacity={0.72}
          disabled={!onViewAllWordsPress}
        >
          <LucideIcon name="list" size={15} color={Colors.textSecondary} />
          <Text style={styles.viewAllText}>모든 단어 보기</Text>
          <LucideIcon name="chevron-right" size={13} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

type LucideIconName = 'eye-off' | 'list' | 'chevron-right';

interface LucideIconProps {
  name: LucideIconName;
  size: number;
  color: string;
}

const LucideIcon = React.memo(function LucideIcon({ name, size, color }: LucideIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'eye-off' ? (
        <>
          <Path
            d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M14.084 14.158a3 3 0 0 1-4.242-4.242"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="m2 2 20 20"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
      {name === 'list' ? (
        <>
          <Path d="M3 12h.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3 18h.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3 6h.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 12h13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 18h13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 6h13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {name === 'chevron-right' ? (
        <Path d="m9 18 6-6-6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </Svg>
  );
});

function getJlptColor(jlpt: string | null | undefined): string {
  switch (jlpt) {
    case 'N1':
    case 'N2':
    case 'N3':
    case 'N4':
    case 'N5':
      return JLPT_COLORS[jlpt];
    default:
      return Colors.textMuted;
  }
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
    marginHorizontal: -20,
  },
  header: {
    gap: 3,
    paddingHorizontal: 20,
  },
  title: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 17,
  },
  description: {
    ...Typography.heading,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  list: {
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  cardRail: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 2,
  },
  cardRailWrap: {
    marginVertical: -2,
  },
  wordCard: {
    width: 150,
    height: 180,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  wordCardBusy: {
    opacity: 0.68,
  },
  cardBadgeRow: {
    width: '100%',
    height: 17,
    flexDirection: 'row',
    alignItems: 'center',
  },
  jlptBadge: {
    height: 17,
    justifyContent: 'center',
    borderRadius: 9999,
    paddingTop: 2,
    paddingRight: 7,
    paddingBottom: 3,
    paddingLeft: 7,
    backgroundColor: '#F6F6F6',
  },
  jlptText: {
    ...Typography.bodyBold,
    fontSize: 10,
    lineHeight: 12,
  },
  wordTextBlock: {
    alignItems: 'center',
    gap: 2,
  },
  japanese: {
    ...Typography.headingBold,
    maxWidth: '100%',
    color: Colors.textPrimary,
    fontSize: 30,
    lineHeight: 36,
  },
  maskButton: {
    width: '100%',
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
  },
  maskLabel: {
    ...Typography.bodySemiBold,
    color: Colors.textMuted,
    fontSize: 11,
  },
  stateBox: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  viewAllButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F6F6F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewAllWrap: {
    paddingTop: 6,
    paddingRight: 20,
    paddingLeft: 20,
  },
  viewAllText: {
    ...Typography.bodySemiBold,
    color: Colors.textSecondary,
    fontSize: 13,
  },
});
