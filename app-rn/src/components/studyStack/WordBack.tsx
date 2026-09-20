import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ArtworkThumb } from './CardStage';
import { Colors } from '../../theme/theme';
import { getJlptColor } from '../Badges';
import { getPosColor, getPosLabel } from '../../types/pos';
import { flattenExamples, joinMeanings, SenseExample } from '../../types/word';
import ReadingText from '../ReadingText';
import { formatInterval, holdLabel } from './intervalLabel';
import { PREVIEW_FLASHCARD_ID, StudyCard } from './types';

export const RATINGS = [
  { rating: 1, label: '다시', color: Colors.ratingAgain },
  { rating: 2, label: '어려움', color: Colors.ratingHard },
  { rating: 3, label: '알고 있음', color: Colors.ratingGood },
  { rating: 4, label: '쉬움', color: Colors.ratingEasy },
];

/** CardStage.stageContent 의 paddingHorizontal — 캐러셀은 이 안쪽 여백을 넘겨 화면 끝까지 펼친다. */
const STAGE_HORIZONTAL_PADDING = 20;
/** rating 을 고르면 나머지 버튼이 사라지고 선택한 색의 pill 하나로 합쳐지는 시간. */
const RATING_HOLD_ENTER_MS = 160;
/** ratingRow 의 gap — 분열 transform 이 버튼 폭을 계산할 때 쓴다. */
const RATING_GAP = 8;
/** 버튼 높이와 양끝 반원 캡의 폭. 몸통만 scaleX 하고 캡은 translateX 로 밀어 늘어나도 끝이 원으로 남는다. */
const BUTTON_HEIGHT = 56;
const BUTTON_CAP = BUTTON_HEIGHT / 2;
/**
 * 캡과 몸통이 겹치는 폭. 반투명 조각을 맞대면 Yoga 의 픽셀 반올림으로 틈이나 겹침이 세로 선으로
 * 보인다. 그래서 조각은 불투명 흰색으로 겹쳐 그리고, 그룹에 opacity + 오프스크린 합성을 걸어
 * 한 장으로 만든 뒤 알파를 입힌다 — 겹친 곳이 균일해진다. 버튼 네 개의 채움을 한 그룹에
 * 넣으므로 갈라지는 동안 서로 겹쳐도 알파가 쌓이지 않고 합집합 실루엣 하나로 보인다.
 */
const PIECE_OVERLAP = 2;
const GLASS_FILL_OPACITY = 0.14;
/**
 * 이웃한 버튼 사이 경계(최종 gap 의 중앙)에서 각 버튼의 끝이 시작할 때 뻗어 있는 거리.
 * 캡 하나만큼 서로 파고들어 있어 시작 상태의 합집합은 매끈한 pill 하나가 되고, 끝이 안쪽으로
 * 물러나는 동안 두 반원이 맞물린 자리에 잘록한 허리가 생겼다가 끊어진다.
 */
const JUNCTION_REACH = BUTTON_CAP + RATING_GAP / 2;
/** 끝이 물러난 거리 중 두 반원이 떨어지는 지점의 비율 — 그 뒤로는 gap 이 벌어지는 구간. */
const SPLIT_BREAK_TRAVEL = (BUTTON_CAP * 2) / (BUTTON_CAP * 2 + RATING_GAP);
/** 앞면 pill 과 겹친 채 머무는 splitProgress 구간 — 이 동안 앞면 pill 과 crossfade 가 끝난다. */
const SPLIT_START = 0.06;
/**
 * 허리가 눈에 띄기 시작할 때까지의 이동은 거의 보이지 않으므로 이 지점까지 빠르게 지나가고,
 * 그 뒤 허리가 깊어져 끊어지는 구간에 시간을 쓴다. 허리 깊이는 물러난 거리에 제곱으로
 * 깊어지므로 구간마다 이동 속도를 줄여 가야 보기에 일정하거나 느려진다.
 */
const SPLIT_NECK_AT = 0.2;
const SPLIT_NECK_TRAVEL = 0.5;
const SPLIT_BREAK_AT = 0.7;
/** 끊어진 뒤 조각이 제자리 버튼(채움·윤곽·그림자)으로 crossfade 되는 구간의 시작. */
const SPLIT_SETTLE_FROM = 0.78;

export interface WordBackProps {
  card: StudyCard;
  selectedRating: number | null;
  saving: boolean;
  onRating: (rating: number) => void;
  revealProgress?: Animated.Value;
  /** 앞면 pill 이 rating 버튼 넷으로 갈라지는 진행도 — WordLayer 가 reveal 과 함께 돌린다. */
  splitProgress?: Animated.Value;
  hideHeadword?: boolean;
  headwordRef?: React.Ref<View>;
  onHeadwordLayout?: () => void;
  onOpenExampleSource?: (songId: number) => void;
  /** 뜻 옆 연필 버튼 — 단어 편집 화면으로. 미리보기 카드(아직 안 담긴 단어)에는 버튼이 없다. */
  onEditWord?: (card: StudyCard) => void;
}

/** 뒷면 wordLayer — 뜻·품사/JLPT·예문 + 질문 한 줄 + rating pill 4개. */
export const WordBack = React.memo(function WordBack({
  card,
  selectedRating,
  saving,
  onRating,
  revealProgress,
  splitProgress,
  hideHeadword = false,
  headwordRef,
  onHeadwordLayout,
  onOpenExampleSource,
  onEditWord,
}: WordBackProps) {
  const meaning = joinMeanings(card.senses);
  const canEdit = onEditWord != null && card.id !== PREVIEW_FLASHCARD_ID;
  const handleEditPress = useCallback(() => onEditWord?.(card), [card, onEditWord]);
  const handleDictionaryPress = useCallback(() => openDictionary(card.japanese), [card.japanese]);
  const firstSense = card.senses[0];
  const pos = firstSense?.partOfSpeech;
  const jlpt = firstSense?.jlpt;
  const examples = useMemo(() => flattenExamples(card.senses), [card.senses]);

  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth;
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);
  const exampleScrollRef = useRef<ScrollView>(null);
  // 분열 transform 은 슬롯 실제 폭이 필요하다 — 측정 전에는 무대 여백을 뺀 화면 폭으로 근사한다.
  const [slotWidth, setSlotWidth] = useState(screenWidth - STAGE_HORIZONTAL_PADDING * 2);
  const handleSlotLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setSlotWidth(prev => (prev === w ? prev : w));
  }, []);
  // rating 을 고른 순간 버튼 4개가 사라지고 선택 색 pill 하나가 그 자리에 떠오른다. 홀드 중
  // 같은 버튼(=pill)을 다시 누르면 취소되어 되감긴다. 마지막으로 고른 rating 을 기억해 두어
  // 되감기는 동안에도 pill 이 같은 색·문구를 유지한다. 저장이 시작되면 selectedRating 은
  // 먼저 비워지지만 카드가 밀려나가는 동안 pill 은 그대로 둔다 — 실패로 돌아올 때만 되감긴다.
  const holdProgress = useRef(new Animated.Value(0)).current;
  const [heldRating, setHeldRating] = useState<number | null>(null);
  const holding = selectedRating != null || saving;

  useEffect(() => {
    setActiveExampleIndex(0);
    exampleScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [card.id]);

  useEffect(() => {
    if (selectedRating != null) setHeldRating(selectedRating);
  }, [selectedRating]);

  useEffect(() => {
    Animated.timing(holdProgress, {
      toValue: holding ? 1 : 0,
      duration: RATING_HOLD_ENTER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [holdProgress, holding]);

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
  // 앞면 '뜻 확인하기' pill 이 rating 버튼 넷으로 갈라지는 transform. 버튼은 처음부터 제 열에
  // 있고, 이웃과 맞닿는 끝만 경계 너머로 JUNCTION_REACH 만큼 뻗어 있다(채움은 한 그룹이라
  // 겹쳐도 pill 하나로 보인다). 그 상태로 앞면 pill 과 crossfade 한 뒤 끝이 안쪽으로 물러나며
  // 경계마다 허리가 생겨 끊어진다 — 버튼이 통째로 줄어드는 게 아니라 경계만 갈라진다.
  // 늘어남은 버튼 전체 scaleX 가 아니라 몸통 scaleX + 양끝 캡 translateX 로 만든다 — 통째로
  // 늘리면 끝 반원이 타원으로 찌그러진 채 오래 보인다.
  // 갈라지는 동안 조각에는 윤곽선도 그림자도 없다 — 반투명 채움 뒤로 다른 조각의 윤곽·그림자가
  // 비쳐 요란하다. 앞면 pill 의 윤곽이 분열 초반에 녹아 없어지고, 끊어진 뒤 제자리 버튼
  // (채움·윤곽·그림자)이 조각과 crossfade 로 바뀐다.
  const splitStyles = useMemo(() => {
    if (!revealProgress || !splitProgress) return null;
    const buttonWidth = (slotWidth - RATING_GAP * (RATINGS.length - 1)) / RATINGS.length;
    const bodyWidth = buttonWidth - BUTTON_CAP * 2;
    const keyframes = [0, SPLIT_START, SPLIT_NECK_AT, SPLIT_BREAK_AT, 1];
    // 뻗어 있던 끝이 물러난 비율 — 0 이면 시작 상태, 1 이면 제자리.
    const travel = [0, 0, SPLIT_NECK_TRAVEL, SPLIT_BREAK_TRAVEL, 1];
    const remaining = (reach: number) => travel.map(t => reach * (1 - t));
    const buttons = RATINGS.map((_, i) => {
      const leftReach = i > 0 ? JUNCTION_REACH : 0;
      const rightReach = i < RATINGS.length - 1 ? JUNCTION_REACH : 0;
      return {
        body: {
          transform: [
            {
              // 한쪽만 뻗으면 몸통 중심도 그쪽으로 절반 옮겨야 캡과 이어진다.
              translateX: splitProgress.interpolate({
                inputRange: keyframes,
                outputRange: remaining((rightReach - leftReach) / 2),
                extrapolate: 'clamp' as const,
              }),
            },
            {
              scaleX: splitProgress.interpolate({
                inputRange: keyframes,
                outputRange: remaining(leftReach + rightReach).map(r => (bodyWidth + r) / bodyWidth),
                extrapolate: 'clamp' as const,
              }),
            },
          ],
        },
        capLeft: {
          transform: [{
            translateX: splitProgress.interpolate({
              inputRange: keyframes,
              outputRange: remaining(-leftReach),
              extrapolate: 'clamp' as const,
            }),
          }],
        },
        capRight: {
          transform: [{
            translateX: splitProgress.interpolate({
              inputRange: keyframes,
              outputRange: remaining(rightReach),
              extrapolate: 'clamp' as const,
            }),
          }],
        },
      };
    });
    return {
      buttons,
      // 채움 그룹은 앞면 pill 채움과 같은 구간에 떠오르고(같은 자리·같은 색이라 보이지 않는다),
      // 끊어진 뒤 제자리 버튼에 자리를 내주며 사라진다.
      fillGroup: {
        opacity: Animated.multiply(
          revealProgress.interpolate({
            inputRange: [0, 0.2],
            outputRange: [0, 1],
            extrapolate: 'clamp' as const,
          }),
          splitProgress.interpolate({
            inputRange: [SPLIT_SETTLE_FROM, 1],
            outputRange: [GLASS_FILL_OPACITY, 0],
            extrapolate: 'clamp' as const,
          }),
        ),
      },
      rest: {
        opacity: splitProgress.interpolate({
          inputRange: [SPLIT_SETTLE_FROM, 1],
          outputRange: [0, 1],
          extrapolate: 'clamp' as const,
        }),
      },
      content: {
        opacity: splitProgress.interpolate({
          inputRange: [0.55, 0.9],
          outputRange: [0, 1],
          extrapolate: 'clamp' as const,
        }),
      },
    };
  }, [revealProgress, splitProgress, slotWidth]);
  const holdStyles = useMemo(() => ({
    row: {
      opacity: holdProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
        extrapolate: 'clamp' as const,
      }),
    },
    pill: {
      opacity: holdProgress,
      transform: [{
        scale: holdProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
          extrapolate: 'clamp' as const,
        }),
      }],
    },
  }), [holdProgress]);
  const held = heldRating == null ? null : RATINGS.find(r => r.rating === heldRating) ?? null;
  const handleHoldPress = useCallback(() => {
    if (heldRating != null) onRating(heldRating);
  }, [heldRating, onRating]);

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
          <View style={styles.meaningRow}>
            <Text numberOfLines={2} adjustsFontSizeToFit style={styles.meaning}>{meaning || '뜻 정보 없음'}</Text>
            {/* 아이콘은 뜻 글자의 baseline 에 맞춘다. 아이콘 글리프(Text)의 baseline 은 폰트마다
                제멋대로라, 고정 크기 상자 안에 절대 배치해 상자 아래변이 baseline 이 되게 한다. */}
            <View style={styles.wordActions}>
              {canEdit && (
                <Pressable style={styles.wordAction} onPress={handleEditPress} hitSlop={10} disabled={saving}>
                  <Feather name="edit-2" size={WORD_ACTION_SIZE} color={WORD_ACTION_COLOR} style={styles.wordActionIcon} />
                </Pressable>
              )}
              <Pressable style={styles.wordAction} onPress={handleDictionaryPress} hitSlop={10} disabled={saving}>
                <Feather name="external-link" size={WORD_ACTION_SIZE} color={WORD_ACTION_COLOR} style={styles.wordActionIcon} />
              </Pressable>
            </View>
          </View>
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

      {/* 질문 문구만 다른 뒷면 요소처럼 떠오른다 — 슬롯은 앞면 pill 자리를 그대로 이어받아야 하므로 움직이지 않는다. */}
      <View style={styles.ratingBlock}>
        <Animated.Text style={[styles.ratingQuestion, controlsStyle]}>얼마나 잘 기억했나요?</Animated.Text>
        <View style={styles.ratingSlot} onLayout={handleSlotLayout}>
          <Animated.View
            style={[styles.ratingRowLayer, holdStyles.row]}
            pointerEvents={holding ? 'none' : 'auto'}
          >
            {/* 갈라지는 조각과 버튼(제자리 모양+터치+글자)을 같은 4열 그리드에 두 겹으로 깐다.
                조각은 한 그룹으로 오프스크린 합성해 알파를 입히므로, 겹쳐도 실루엣 하나로 보인다. */}
            {splitStyles && (
              <Animated.View
                style={[styles.ratingShapeRow, splitStyles.fillGroup]}
                pointerEvents="none"
                needsOffscreenAlphaCompositing
              >
                {RATINGS.map(({ rating }, i) => (
                  <RatingShape key={rating} splitStyle={splitStyles.buttons[i]} />
                ))}
              </Animated.View>
            )}
            <View style={styles.ratingRow}>
              {RATINGS.map(({ rating, label, color }) => (
                <RatingButton
                  key={rating}
                  rating={rating}
                  label={label}
                  interval={card.intervals?.[rating]}
                  color={color}
                  disabled={saving}
                  onPress={onRating}
                  restStyle={splitStyles?.rest ?? null}
                  contentStyle={splitStyles?.content ?? null}
                />
              ))}
            </View>
          </Animated.View>
          {held && (
            <Animated.View
              style={[styles.holdPillLayer, holdStyles.pill]}
              pointerEvents={selectedRating == null ? 'none' : 'auto'}
            >
              <Pressable
                style={[styles.holdPill, { backgroundColor: held.color, shadowColor: held.color + '73' }]}
                onPress={handleHoldPress}
                disabled={saving}
              >
                <Text style={styles.holdLabel}>{holdLabel(held.label, card.intervals?.[held.rating])}</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
});

const WORD_ACTION_COLOR = 'rgba(255,255,255,0.40)';
const WORD_ACTION_SIZE = 15;
/** Feather 글리프는 24 그리드에서 위아래 1칸씩 비어 있다 — 그만큼 내려야 선이 baseline 에 닿는다. */
const WORD_ACTION_INK_INSET = Math.round(WORD_ACTION_SIZE / 24);

/** 네이버 일본어사전에서 표제어를 검색한다 — 리뉴얼 전 복습 화면과 같은 목적지. */
function openDictionary(word: string) {
  Linking.openURL(`https://ja.dict.naver.com/#/search?query=${encodeURIComponent(word)}`);
}

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

interface RatingSplitStyle {
  body: Animated.WithAnimatedObject<object>;
  capLeft: Animated.WithAnimatedObject<object>;
  capRight: Animated.WithAnimatedObject<object>;
}

interface RatingShapeProps {
  splitStyle: RatingSplitStyle;
}

/**
 * 갈라지는 동안의 rating 버튼 하나 — 캡·몸통·캡 세 조각. 몸통만 가로로 늘어나고 캡은 원형 그대로
 * 밀려난다. 알파는 부모 그룹이 입히므로 여기서는 불투명 흰색으로만 그린다.
 */
const RatingShape = React.memo(function RatingShape({ splitStyle }: RatingShapeProps) {
  return (
    <View style={styles.ratingShapeColumn}>
      <Animated.View style={[styles.ratingCap, styles.ratingCapLeft, styles.ratingFill, splitStyle.capLeft]} />
      <Animated.View style={[styles.ratingBody, styles.ratingFill, splitStyle.body]} />
      <Animated.View style={[styles.ratingCap, styles.ratingCapRight, styles.ratingFill, splitStyle.capRight]} />
    </View>
  );
});

interface RatingButtonProps {
  rating: number;
  label: string;
  interval?: string;
  color: string;
  disabled: boolean;
  onPress: (rating: number) => void;
  /** 조각이 끊어진 뒤 제자리 모양(채움·윤곽·그림자)을 띄우는 opacity. */
  restStyle: Animated.WithAnimatedObject<object> | null;
  /** 글자를 그보다 조금 먼저 띄우는 opacity. */
  contentStyle: Animated.WithAnimatedObject<object> | null;
}

/** rating 버튼 — 제자리 모양, 터치 영역, 글자. 갈라지는 동안의 모양은 RatingShape 가 같은 열 자리에 그린다. */
const RatingButton = React.memo(function RatingButton({
  rating,
  label,
  interval,
  color,
  disabled,
  onPress,
  restStyle,
  contentStyle,
}: RatingButtonProps) {
  const handlePress = useCallback(() => onPress(rating), [onPress, rating]);
  return (
    <Pressable style={styles.ratingButton} onPress={handlePress} disabled={disabled}>
      <Animated.View style={[styles.ratingButtonRest, restStyle]} />
      <Animated.View style={[styles.ratingButtonContent, contentStyle]}>
        <Text style={styles.ratingLabel}>{label}</Text>
        {interval != null && <Text style={[styles.ratingInterval, { color }]}>{formatInterval(interval)}</Text>}
      </Animated.View>
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
  meaningRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  wordActions: {
    flexDirection: 'row',
    gap: 12,
  },
  wordAction: {
    width: WORD_ACTION_SIZE,
    height: WORD_ACTION_SIZE,
  },
  wordActionIcon: {
    position: 'absolute',
    left: 0,
    bottom: -WORD_ACTION_INK_INSET,
  },
  meaning: {
    flexShrink: 1,
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
  ratingBlock: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  ratingQuestion: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  ratingSlot: {
    width: '100%',
    height: BUTTON_HEIGHT,
  },
  ratingRowLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  ratingRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    gap: RATING_GAP,
  },
  ratingShapeRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    gap: RATING_GAP,
  },
  ratingShapeColumn: {
    flex: 1,
    flexDirection: 'row',
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 앞면 pill 과 같은 색·두께·그림자 — 갈라지는 조각이 이 모양으로 안착한다.
  ratingButtonRest: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BUTTON_CAP,
    backgroundColor: `rgba(255,255,255,${GLASS_FILL_OPACITY})`,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  ratingCap: {
    width: BUTTON_CAP + PIECE_OVERLAP,
  },
  ratingCapLeft: {
    borderTopLeftRadius: BUTTON_CAP,
    borderBottomLeftRadius: BUTTON_CAP,
  },
  ratingCapRight: {
    borderTopRightRadius: BUTTON_CAP,
    borderBottomRightRadius: BUTTON_CAP,
  },
  ratingBody: {
    flex: 1,
    marginHorizontal: -PIECE_OVERLAP,
  },
  // 조각에는 그림자를 두지 않는다 — 조각마다 그림자를 드리우면 겹친 이웃 조각 위에 그림자가
  // 떨어져 반투명 실루엣 안에서 조각 윤곽이 드러난다.
  ratingFill: {
    backgroundColor: '#FFFFFF',
  },
  ratingButtonContent: {
    alignItems: 'center',
    gap: 2,
  },
  ratingLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  ratingInterval: {
    fontSize: 11,
    fontWeight: '600',
  },
  holdPillLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  holdPill: {
    flex: 1,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 6,
  },
  holdLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
