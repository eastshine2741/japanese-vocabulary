import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Reanimated, {
  Easing as ReEasing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { ArtworkThumb } from './CardStage';
import { Colors } from '../../theme/theme';
import { getJlptColor } from '../Badges';
import { getPosColor, getPosLabel } from '../../types/pos';
import { flattenExamples, joinMeanings, SenseExample } from '../../types/word';
import ReadingText from '../ReadingText';
import { StudyCard } from './types';

export const RATINGS = [
  { rating: 1, label: '다시', color: Colors.ratingAgain },
  { rating: 2, label: '어려움', color: Colors.ratingHard },
  { rating: 3, label: '알고 있음', color: Colors.ratingGood },
  { rating: 4, label: '쉬움', color: Colors.ratingEasy },
];

/** CardStage.stageContent 의 paddingHorizontal — 캐러셀은 이 안쪽 여백을 넘겨 화면 끝까지 펼친다. */
const STAGE_HORIZONTAL_PADDING = 20;
/** rating 선택 뒤 스와이프 어포던스가 펼쳐지는 시간과 높이. WordLayer 의 headword 보정(-24.5)은 높이의 절반이다. */
const AFFORDANCE_MS = 260;
const AFFORDANCE_HEIGHT = 49;

export interface WordBackProps {
  card: StudyCard;
  selectedRating: number | null;
  saving: boolean;
  onRating: (rating: number) => void;
  revealProgress?: Animated.Value;
  affordanceProgress?: Animated.Value;
  hideHeadword?: boolean;
  headwordRef?: React.Ref<View>;
  onHeadwordLayout?: () => void;
  onOpenExampleSource?: (songId: number) => void;
}

/** 뒷면 wordLayer — 뜻·품사/JLPT·예문 + rating 줄 + 스와이프 어포던스. */
export const WordBack = React.memo(function WordBack({
  card,
  selectedRating,
  saving,
  onRating,
  revealProgress,
  affordanceProgress,
  hideHeadword = false,
  headwordRef,
  onHeadwordLayout,
  onOpenExampleSource,
}: WordBackProps) {
  const meaning = joinMeanings(card.senses);
  const firstSense = card.senses[0];
  const pos = firstSense?.partOfSpeech;
  const jlpt = firstSense?.jlpt;
  const examples = useMemo(() => flattenExamples(card.senses), [card.senses]);

  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth;
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);
  const exampleScrollRef = useRef<ScrollView>(null);
  // 어포던스 컨테이너 height 는 레이아웃 값이라 RN Animated 네이티브 드라이버로 못 끈다 —
  // Reanimated 로 UI 스레드에서 돌린다. headword 를 따라 올리는 affordanceProgress(RN Animated,
  // 네이티브)와는 같은 duration/easing 으로 나란히 달린다.
  const layoutAffordanceProgress = useSharedValue(0);
  const hasAnimatedRatingSelectionRef = useRef(false);

  useEffect(() => {
    setActiveExampleIndex(0);
    exampleScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [card.id]);

  useEffect(() => {
    if (selectedRating == null) {
      hasAnimatedRatingSelectionRef.current = false;
      cancelAnimation(layoutAffordanceProgress);
      layoutAffordanceProgress.value = 0;
      affordanceProgress?.stopAnimation();
      affordanceProgress?.setValue(0);
      return;
    }
    if (hasAnimatedRatingSelectionRef.current) return;
    hasAnimatedRatingSelectionRef.current = true;

    layoutAffordanceProgress.value = 0;
    layoutAffordanceProgress.value = withTiming(1, {
      duration: AFFORDANCE_MS,
      easing: ReEasing.out(ReEasing.cubic),
    });
    if (affordanceProgress) {
      affordanceProgress.setValue(0);
      Animated.timing(affordanceProgress, {
        toValue: 1,
        duration: AFFORDANCE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [affordanceProgress, layoutAffordanceProgress, selectedRating]);

  const handleExampleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveExampleIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
  }, [pageWidth]);

  // 뒤집기 인터폴레이션은 revealProgress 가 바뀔 때만 다시 만든다 — 렌더마다 만들면
  // 네이티브 Animated 노드를 떼고 다시 붙인다.
  const revealStyles = useMemo(() => {
    if (!revealProgress) return null;
    const fade = (from: number, dy: number) => ({
      opacity: revealProgress.interpolate({
        inputRange: [from, 1],
        outputRange: [0, 1],
        extrapolate: 'clamp' as const,
      }),
      transform: [
        {
          translateY: revealProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [dy, 0],
            extrapolate: 'clamp' as const,
          }),
        },
      ],
    });
    return {
      question: fade(0.62, 18),
      answer: fade(0.32, 24),
      controls: fade(0.54, 20),
    };
  }, [revealProgress]);
  const questionStyle = revealStyles?.question ?? null;
  const answerStyle = revealStyles?.answer ?? null;
  const controlsStyle = revealStyles?.controls ?? null;
  const affordanceStyle = useAnimatedStyle(() => ({
    opacity: layoutAffordanceProgress.value,
    transform: [{
      translateY: interpolate(layoutAffordanceProgress.value, [0, 1], [26, 0], Extrapolation.CLAMP),
    }],
  }), [layoutAffordanceProgress]);
  const affordanceContainerStyle = useAnimatedStyle(() => ({
    height: interpolate(layoutAffordanceProgress.value, [0, 1], [0, AFFORDANCE_HEIGHT], Extrapolation.CLAMP),
  }), [layoutAffordanceProgress]);

  return (
    <View style={styles.wordBack}>
      <View style={styles.backCenterBlock}>
        <Animated.View style={[styles.questionGroup, questionStyle]}>
          <View ref={headwordRef} collapsable={false} onLayout={onHeadwordLayout}>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[styles.backHeadword, hideHeadword && styles.hiddenHeadword]}
            >
              {card.japanese}
            </Text>
          </View>
          <View style={styles.readingRow}>
            {card.reading && <ReadingText style={styles.reading} reading={card.reading} />}
            {(pos || jlpt) && (
              <View style={styles.metaLine}>
                {pos && <Text style={[styles.metaPos, { color: getPosColor(pos) }]}>{getPosLabel(pos)}</Text>}
                {pos && jlpt && <Text style={styles.metaDot}>·</Text>}
                {jlpt && <Text style={[styles.metaJlpt, { color: getJlptColor(jlpt) }]}>{jlpt}</Text>}
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View style={[styles.answerGroup, answerStyle]}>
          <Text numberOfLines={2} adjustsFontSizeToFit style={styles.meaning}>{meaning || '뜻 정보 없음'}</Text>
          {examples.length === 1 && (
            <ExamplePage example={examples[0]} japanese={card.japanese} onOpenSource={onOpenExampleSource} />
          )}
          {examples.length > 1 && (
            <View style={styles.exampleBlock}>
              <ScrollView
                ref={exampleScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleExampleScrollEnd}
                snapToInterval={pageWidth}
                decelerationRate="fast"
                style={[styles.exampleScroll, { width: pageWidth }]}
              >
                {examples.map((ex, i) => (
                  <View key={i} style={[styles.examplePage, { width: pageWidth }]}>
                    <ExamplePage example={ex} japanese={card.japanese} onOpenSource={onOpenExampleSource} />
                  </View>
                ))}
              </ScrollView>
              <View style={styles.exDotsRow}>
                {examples.map((_, i) => (
                  <View key={i} style={i === activeExampleIndex ? styles.exDotActive : styles.exDotInactive} />
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      </View>

      <Animated.View style={[styles.ratingRow, controlsStyle]}>
        {RATINGS.map(({ rating, label, color }) => (
          <RatingButton
            key={rating}
            rating={rating}
            label={label}
            interval={card.intervals?.[rating]}
            color={color}
            selected={selectedRating === rating}
            dimmed={selectedRating != null && selectedRating !== rating}
            disabled={saving}
            onPress={onRating}
          />
        ))}
      </Animated.View>

      <Reanimated.View style={[styles.swipeAffordance, affordanceContainerStyle]}>
        <Animated.View style={[styles.swipeAffordanceReveal, controlsStyle]}>
          <Reanimated.View style={[styles.swipeAffordanceContent, affordanceStyle]}>
            <View style={styles.swipeLabelRow}>
              <Feather name="chevron-up" size={15} color="rgba(255,255,255,0.85)" />
              <Text style={styles.swipeLabel}>위로 쓸어올려 다음 단어</Text>
            </View>
            <View style={styles.grabber} />
          </Reanimated.View>
        </Animated.View>
      </Reanimated.View>
    </View>
  );
});

interface ExamplePageProps {
  example: SenseExample;
  japanese: string;
  onOpenSource?: (songId: number) => void;
}

/** 예문 한 건 — 표제어 위치를 강조 표시하고 한국어 번역을 아래에 붙인다. */
const ExamplePage = React.memo(function ExamplePage({ example, japanese, onOpenSource }: ExamplePageProps) {
  const jpText = example.text;
  const hitIndex = jpText.indexOf(japanese);
  const hasHit = hitIndex >= 0;
  const beforeHit = hasHit ? jpText.slice(0, hitIndex) : '';
  const hit = hasHit ? jpText.slice(hitIndex, hitIndex + japanese.length) : '';
  const afterHit = hasHit ? jpText.slice(hitIndex + japanese.length) : jpText;
  const { songId, songTitle } = example;
  const handlePress = useCallback(() => {
    if (songId != null) onOpenSource?.(songId);
  }, [onOpenSource, songId]);
  return (
    <View style={styles.exampleContent}>
      {songId != null && songTitle && (
        <Pressable style={styles.exampleSourceRow} onPress={handlePress} hitSlop={6}>
          <ArtworkThumb artworkUrl={example.artworkUrl ?? null} size={16} radius={4} />
          <Text numberOfLines={1} style={styles.exampleSourceTitle}>{songTitle}</Text>
          <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.45)" />
        </Pressable>
      )}
      <Text numberOfLines={2} style={styles.jpLine}>
        {beforeHit}{hasHit && <Text style={styles.jpHit}>{hit}</Text>}{afterHit}
      </Text>
      {example.translation && (
        <Text numberOfLines={1} style={styles.krLine}>{example.translation}</Text>
      )}
    </View>
  );
});

interface RatingButtonProps {
  rating: number;
  label: string;
  interval?: string;
  color: string;
  selected: boolean;
  dimmed: boolean;
  disabled: boolean;
  onPress: (rating: number) => void;
}

const RatingButton = React.memo(function RatingButton({
  rating,
  label,
  interval,
  color,
  selected,
  dimmed,
  disabled,
  onPress,
}: RatingButtonProps) {
  const handlePress = useCallback(() => onPress(rating), [onPress, rating]);
  return (
    <Pressable
      style={[
        styles.ratingButton,
        selected
          ? [styles.ratingButtonSelected, { backgroundColor: color, shadowColor: color + '73' }]
          : { borderColor: color + '66' },
        dimmed && styles.ratingButtonDimmed,
      ]}
      onPress={handlePress}
      disabled={disabled}
    >
      <Text style={[styles.ratingLabel, selected ? styles.ratingLabelSelected : { color }]}>{label}</Text>
      {interval != null && (
        <Text style={[styles.ratingInterval, selected ? styles.ratingIntervalSelected : { color }]}>{interval}</Text>
      )}
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
  hiddenHeadword: {
    opacity: 0,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaPos: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  metaDot: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 11,
    fontWeight: '600',
  },
  metaJlpt: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  answerGroup: {
    gap: 16,
    width: '100%',
  },
  meaning: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0,
  },
  exampleBlock: {
    gap: 5,
    alignSelf: 'center',
  },
  exampleScroll: {
    flexGrow: 0,
  },
  examplePage: {
    paddingHorizontal: STAGE_HORIZONTAL_PADDING,
  },
  exampleContent: {
    gap: 5,
  },
  exampleSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  exampleSourceTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 160,
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
  exDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: STAGE_HORIZONTAL_PADDING,
    paddingTop: 4,
  },
  exDotActive: {
    width: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.90)',
  },
  exDotInactive: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
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
    backgroundColor: '#FFFFFF0D',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  ratingButtonSelected: {
    borderWidth: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 6,
  },
  ratingButtonDimmed: {
    opacity: 0.42,
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  ratingLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  ratingInterval: {
    fontSize: 10,
  },
  ratingIntervalSelected: {
    color: 'rgba(255,255,255,0.80)',
  },
  swipeAffordance: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  swipeAffordanceReveal: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  swipeAffordanceContent: {
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
