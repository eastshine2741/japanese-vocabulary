import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { flattenExamples, joinMeanings } from '../../types/word';
import { StudyCard } from './types';

export const RATINGS = [
  { rating: 1, label: '다시', fallbackInterval: '< 1분' },
  { rating: 2, label: '어려움', fallbackInterval: '6분' },
  { rating: 3, label: '알고 있음', fallbackInterval: '1일' },
  { rating: 4, label: '쉬움', fallbackInterval: '4일' },
];

export interface WordBackProps {
  card: StudyCard;
  selectedRating: number | null;
  saving: boolean;
  onRating: (rating: number) => void;
}

/** 뒷면 wordLayer — 뜻·품사/JLPT·예문 + rating 줄 + 스와이프 어포던스. */
export const WordBack = React.memo(function WordBack({
  card,
  selectedRating,
  saving,
  onRating,
}: WordBackProps) {
  const meaning = joinMeanings(card.senses);
  const firstSense = card.senses[0];
  const example = useMemo(() => flattenExamples(card.senses)[0], [card.senses]);
  const jpText = example?.text ?? '';
  const hitIndex = jpText.indexOf(card.japanese);
  const beforeHit = hitIndex >= 0 ? jpText.slice(0, hitIndex) : '';
  const hit = hitIndex >= 0 ? jpText.slice(hitIndex, hitIndex + card.japanese.length) : card.japanese;
  const afterHit = hitIndex >= 0 ? jpText.slice(hitIndex + card.japanese.length) : jpText;
  const meta = [firstSense?.partOfSpeech, firstSense?.jlpt].filter(Boolean).join(' · ');

  return (
    <View style={styles.wordBack}>
      <View style={styles.backCenterBlock}>
        <View style={styles.questionGroup}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.backHeadword}>{card.japanese}</Text>
          <View style={styles.readingRow}>
            {card.reading && <Text style={styles.reading}>{card.reading}</Text>}
            {meta !== '' && <Text style={styles.metaLine}>{meta}</Text>}
          </View>
        </View>

        <View style={styles.answerGroup}>
          <Text numberOfLines={2} adjustsFontSizeToFit style={styles.meaning}>{meaning || '뜻 정보 없음'}</Text>
          {jpText !== '' && (
            <View style={styles.exampleBlock}>
              <Text numberOfLines={2} style={styles.jpLine}>
                {beforeHit}<Text style={styles.jpHit}>{hit}</Text>{afterHit}
              </Text>
              {example?.translation && (
                <Text numberOfLines={1} style={styles.krLine}>{example.translation}</Text>
              )}
            </View>
          )}
        </View>
      </View>

      <View style={styles.ratingRow}>
        {RATINGS.map(({ rating, label, fallbackInterval }) => (
          <RatingButton
            key={rating}
            rating={rating}
            label={label}
            interval={card.intervals?.[rating] ?? fallbackInterval}
            selected={selectedRating === rating}
            dimmed={selectedRating != null && selectedRating !== rating}
            disabled={saving}
            onPress={onRating}
          />
        ))}
      </View>

      {selectedRating != null && (
        <View style={styles.swipeAffordance}>
          <View style={styles.swipeLabelRow}>
            <Feather name="chevron-up" size={15} color="rgba(255,255,255,0.85)" />
            <Text style={styles.swipeLabel}>위로 쓸어올려 다음 단어</Text>
          </View>
          <View style={styles.grabber} />
        </View>
      )}
    </View>
  );
});

interface RatingButtonProps {
  rating: number;
  label: string;
  interval: string;
  selected: boolean;
  dimmed: boolean;
  disabled: boolean;
  onPress: (rating: number) => void;
}

const RatingButton = React.memo(function RatingButton({
  rating,
  label,
  interval,
  selected,
  dimmed,
  disabled,
  onPress,
}: RatingButtonProps) {
  const handlePress = useCallback(() => onPress(rating), [onPress, rating]);
  return (
    <Pressable
      style={[styles.ratingButton, selected && styles.ratingButtonSelected, dimmed && styles.ratingButtonDimmed]}
      onPress={handlePress}
      disabled={disabled}
    >
      <Text style={[styles.ratingLabel, selected && styles.ratingLabelSelected]}>{label}</Text>
      <Text style={[styles.ratingInterval, selected && styles.ratingIntervalSelected]}>{interval}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wordBack: {
    flex: 1,
    paddingTop: 96,
  },
  backCenterBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: 26,
  },
  questionGroup: {
    gap: 6,
    alignItems: 'flex-start',
  },
  backHeadword: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: 0,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reading: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 15,
  },
  metaLine: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 11,
    fontWeight: '600',
  },
  answerGroup: {
    gap: 16,
  },
  meaning: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0,
  },
  exampleBlock: {
    gap: 5,
  },
  jpLine: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 15,
    lineHeight: 22,
  },
  jpHit: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  krLine: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 12,
  },
  ratingRow: {
    height: 48,
    flexDirection: 'row',
    gap: 8,
  },
  ratingButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  ratingButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  ratingButtonDimmed: {
    opacity: 0.42,
  },
  ratingLabel: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 12,
    fontWeight: '600',
  },
  ratingLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  ratingInterval: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 10,
  },
  ratingIntervalSelected: {
    color: 'rgba(255,255,255,0.80)',
  },
  swipeAffordance: {
    height: 49,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 16,
  },
  swipeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swipeLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  grabber: {
    width: 112,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.90)',
  },
});
