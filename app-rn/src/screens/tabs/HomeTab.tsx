import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  GestureResponderHandlers,
  ImageBackground,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { flashcardApi } from '../../api/flashcardApi';
import { deckApi } from '../../api/deckApi';
import { songApi } from '../../api/songApi';
import { studyStatsApi } from '../../api/studyStatsApi';
import { RootStackParamList, TabParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../theme/theme';
import { FlashcardDTO } from '../../types/flashcard';
import { RecommendedSongItem } from '../../types/song';
import { flattenExamples, joinMeanings } from '../../types/word';
import { SongDeckSummary } from '../../types/deck';
import { useStudyStatsStore } from '../../stores/studyStatsStore';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type HomeStatus = 'loading' | 'ready' | 'error';
type CardOrigin = 'due' | 'recommended' | 'mockDue';

type HomeSource = {
  deckId: number | null;
  songId: number | null;
  title: string;
  artist: string;
  artworkUrl: string | null;
  dueCount: number;
  totalCount: number;
};

type HomeStudyCard = FlashcardDTO & {
  source: HomeSource;
  origin: CardOrigin;
};

const RATINGS = [
  { rating: 1, label: '다시', fallbackInterval: '< 1분' },
  { rating: 2, label: '어려움', fallbackInterval: '6분' },
  { rating: 3, label: '알고 있음', fallbackInterval: '1일' },
  { rating: 4, label: '쉬움', fallbackInterval: '4일' },
];

// deckId 는 null 이어야 한다 — 실제 deck 인지 mock 인지 판별하는 유일한 기준이다.
const MOCK_RECOMMENDED_SOURCE: HomeSource = {
  deckId: null,
  songId: 103,
  title: 'アイドル',
  artist: 'YOASOBI',
  artworkUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80',
  dueCount: 2,
  totalCount: 24,
};

function makeMockCards(source: HomeSource, origin: CardOrigin): HomeStudyCard[] {
  const base = source.title === '夜に駆ける'
    ? [
        { id: 9201, japanese: '沈む', reading: 'しずむ', meaning: '가라앉다', example: '沈むように溶けてゆくように', translation: '가라앉듯 녹아가듯' },
        { id: 9202, japanese: '夜', reading: 'よる', meaning: '밤', example: '夜に駆ける', translation: '밤을 달리다' },
      ]
    : source.title === 'アイドル'
      ? [
          { id: 9301, japanese: '無敵', reading: 'むてき', meaning: '무적', example: '無敵の笑顔で荒らすメディア', translation: '무적의 미소로 미디어를 뒤흔들어' },
          { id: 9302, japanese: '秘密', reading: 'ひみつ', meaning: '비밀', example: '秘密は蜜の味', translation: '비밀은 꿀맛' },
        ]
      : [
          { id: 9101, japanese: '苦い', reading: 'にがい', meaning: '쓰다, 씁쓸하다', example: '苦いレモンの匂い', translation: '쓴 레몬 향기' },
          { id: 9102, japanese: '匂い', reading: 'におい', meaning: '향기, 냄새', example: 'レモンの匂い', translation: '레몬 향기' },
        ];

  return base.map((card, index) => ({
    id: card.id,
    wordId: card.id,
    japanese: card.japanese,
    reading: card.reading,
    state: 0,
    due: new Date().toISOString(),
    intervals: { 1: '< 1분', 2: '6분', 3: '1일', 4: '4일' },
    senses: [
      {
        meaning: card.meaning,
        partOfSpeech: index === 0 ? '형용사' : '명사',
        jlpt: index === 0 ? 'N3' : 'N5',
        examples: [
          {
            text: card.example,
            translation: card.translation,
            songId: source.songId,
            lineIndex: null,
            songTitle: source.title,
            artworkUrl: source.artworkUrl,
          },
        ],
      },
    ],
    source,
    origin,
  }));
}

function sourceFromDeck(deck: SongDeckSummary): HomeSource {
  return {
    deckId: deck.deckId,
    songId: deck.songId,
    title: deck.title,
    artist: deck.artist,
    artworkUrl: deck.artworkUrl,
    dueCount: deck.dueCount,
    totalCount: deck.wordCount,
  };
}

function sourceFromRecommendation(item: RecommendedSongItem): HomeSource {
  return {
    deckId: null,
    songId: item.songId,
    title: item.title,
    artist: item.artist,
    artworkUrl: item.artworkUrl,
    dueCount: MOCK_RECOMMENDED_SOURCE.dueCount,
    totalCount: MOCK_RECOMMENDED_SOURCE.totalCount,
  };
}

export default function HomeTab() {
  const navigation = useNavigation<Nav>();
  const [status, setStatus] = useState<HomeStatus>('loading');
  const [cards, setCards] = useState<HomeStudyCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [completedSource, setCompletedSource] = useState<HomeSource | null>(null);
  const [nextDueSource, setNextDueSource] = useState<HomeSource | null>(null);
  const [recommendedSource, setRecommendedSource] = useState<HomeSource | null>(MOCK_RECOMMENDED_SOURCE);
  const [streak, setStreak] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;

  const currentCard = cards[currentIndex] ?? null;
  const visibleSource = currentCard?.source ?? nextDueSource ?? recommendedSource ?? completedSource ?? MOCK_RECOMMENDED_SOURCE;
  const isComplete = status === 'ready' && !currentCard;
  const isError = status === 'error';
  const progress = currentCard
    ? Math.min(1, (reviewedCount + 1) / Math.max(1, currentCard.source.totalCount))
    : completedSource
      ? Math.min(1, reviewedCount / Math.max(1, completedSource.totalCount))
      : 0;

  const goSearch = useCallback(() => navigation.navigate('Search'), [navigation]);

  const openSource = useCallback(() => {
    const songId = visibleSource?.songId;
    if (songId == null) return;
    navigation.navigate('SongDetail', { songId, origin: 'Home' });
  }, [navigation, visibleSource?.songId]);

  const showCompletion = useCallback((source: HomeSource | null, dueDecks: SongDeckSummary[]) => {
    const nextDeck = dueDecks
      .filter(deck => deck.deckId !== source?.deckId && deck.dueCount > 0)
      .sort((a, b) => b.dueCount - a.dueCount)[0];
    setCards([]);
    setCurrentIndex(0);
    setRevealed(false);
    setSelectedRating(null);
    setCompletedSource(source);
    setNextDueSource(nextDeck ? sourceFromDeck(nextDeck) : null);
    setStatus('ready');
  }, []);

  const loadCardsForSource = useCallback(async (source: HomeSource, origin: CardOrigin = 'due') => {
    setStatus('loading');
    setLoadError(null);
    setReviewError(null);
    setCompletedSource(null);
    setCurrentIndex(0);
    setReviewedCount(0);
    setSelectedRating(null);
    setRevealed(false);
    try {
      if (origin === 'due' && source.deckId != null) {
        const due = await flashcardApi.getDueCards(source.deckId);
        if (due.cards.length > 0) {
          setCards(due.cards.map(card => ({ ...card, source, origin })));
          setStatus('ready');
          return;
        }
        setCards([]);
        setCompletedSource(source);
        setStatus('ready');
        return;
      }
      setCards(makeMockCards(source, origin));
      setStatus('ready');
    } catch (e: any) {
      // 실제 due API 실패를 완료 화면으로 위장하지 않는다.
      setLoadError(e.message ?? '복습 카드를 불러오지 못했어요');
      setCards([]);
      setCompletedSource(null);
      setStatus('error');
    }
  }, []);

  const loadHomeStack = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const [deckRes, homeStats, recommendations] = await Promise.all([
        deckApi.getDecks(),
        studyStatsApi.getHome(),
        songApi.getRecommendations(),
      ]);
      const recommended = recommendations[0]
        ? sourceFromRecommendation(recommendations[0])
        : MOCK_RECOMMENDED_SOURCE;
      setRecommendedSource(recommended);
      setStreak(homeStats.currentStreak);

      const dueDecks = deckRes.songDecks.filter(deck => deck.dueCount > 0);
      const firstDeck = [...dueDecks].sort((a, b) => b.dueCount - a.dueCount)[0];
      if (firstDeck) {
        const firstSource = sourceFromDeck(firstDeck);
        const followingDeck = dueDecks
          .filter(deck => deck.deckId !== firstDeck.deckId)
          .sort((a, b) => b.dueCount - a.dueCount)[0];
        setNextDueSource(followingDeck ? sourceFromDeck(followingDeck) : null);
        await loadCardsForSource(firstSource, 'due');
      } else {
        showCompletion(null, []);
      }
    } catch (e: any) {
      // streak 은 실제 API 가 있는 값이라 실패 시 임의 숫자를 채우지 않는다.
      setLoadError(e.message ?? '홈 데이터를 불러오지 못했어요');
      setCards([]);
      setCompletedSource(null);
      setNextDueSource(null);
      setStatus('error');
    }
  }, [loadCardsForSource, showCompletion]);

  useEffect(() => {
    loadHomeStack();
  }, [loadHomeStack]);

  const reveal = useCallback(() => setRevealed(true), []);

  const advanceAfterReview = useCallback(async () => {
    if (!currentCard || selectedRating == null || saving) return;
    setSaving(true);
    if (currentCard.origin === 'due') {
      try {
        await flashcardApi.review(currentCard.id, { rating: selectedRating });
        useStudyStatsStore.getState().invalidate();
      } catch (e: any) {
        // 저장에 실패하면 카드를 넘기지 않는다 — 넘기면 평가가 조용히 유실된다.
        setReviewError(e.message ?? '복습 저장에 실패했어요. 다시 시도해 주세요');
        setSaving(false);
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        return;
      }
    }
    setReviewError(null);
    const nextIndex = currentIndex + 1;
    Animated.timing(translateY, {
      toValue: -420,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(0);
      setSaving(false);
      setReviewedCount(count => count + 1);
      setSelectedRating(null);
      setRevealed(false);
      if (nextIndex >= cards.length) {
        setCards([]);
        setCurrentIndex(0);
        setCompletedSource(currentCard.source);
        if (nextDueSource?.deckId === currentCard.source.deckId) {
          setNextDueSource(null);
        }
      } else {
        setCurrentIndex(nextIndex);
      }
    });
  }, [cards.length, currentCard, currentIndex, nextDueSource?.deckId, saving, selectedRating, translateY]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => revealed && selectedRating != null && Math.abs(gesture.dy) > 8,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(Math.max(gesture.dy, -160));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -72) {
          advanceAfterReview();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
    [advanceAfterReview, revealed, selectedRating, translateY],
  );

  const continueDue = useCallback(() => {
    if (!nextDueSource) return;
    loadCardsForSource(nextDueSource, nextDueSource.deckId != null ? 'due' : 'mockDue');
  }, [loadCardsForSource, nextDueSource]);

  const startRecommended = useCallback(() => {
    loadCardsForSource(recommendedSource ?? MOCK_RECOMMENDED_SOURCE, 'recommended');
  }, [loadCardsForSource, recommendedSource]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HomeChrome
        streak={streak}
        progress={progress}
        onSearch={goSearch}
      />

      <View style={styles.stage}>
        {status === 'loading' && (
          <View style={styles.loadingLayer}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.loadingText}>오늘 볼 단어를 고르는 중</Text>
          </View>
        )}

        {isError && (
          <ErrorStage message={loadError} onRetry={loadHomeStack} onSearch={goSearch} />
        )}

        {status === 'ready' && currentCard && (
          <WordStage
            card={currentCard}
            revealed={revealed}
            selectedRating={selectedRating}
            saving={saving}
            translateY={translateY}
            panHandlers={panResponder.panHandlers}
            onReveal={reveal}
            onRating={setSelectedRating}
            onSourcePress={openSource}
          />
        )}

        {isComplete && (
          <CompletionStage
            completedSource={completedSource}
            nextDueSource={nextDueSource}
            recommendedSource={recommendedSource}
            onContinueDue={continueDue}
            onRecommended={startRecommended}
            onSearch={goSearch}
          />
        )}

        {status === 'ready' && currentCard && reviewError && (
          <View style={styles.reviewErrorBanner} pointerEvents="none">
            <Feather name="alert-circle" size={14} color="#FFD4D4" />
            <Text numberOfLines={2} style={styles.reviewErrorText}>{reviewError}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function ErrorStage({
  message,
  onRetry,
  onSearch,
}: {
  message: string | null;
  onRetry: () => void;
  onSearch: () => void;
}) {
  return (
    <ArtworkStage artworkUrl={null}>
      <View style={styles.completeCenter}>
        <View style={styles.errorBadge}>
          <Feather name="wifi-off" size={30} color="#FFD4D4" />
        </View>
        <View style={styles.doneGroup}>
          <Text style={styles.doneTitle}>오늘 복습을 불러오지 못했어요</Text>
          <View style={styles.doneSubRow}>
            <Text numberOfLines={3} style={styles.doneSub}>
              {message ?? '네트워크 상태를 확인한 뒤 다시 시도해 주세요'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.completeBottom}>
        <Pressable style={styles.primaryAction} onPress={onRetry}>
          <Text style={styles.primaryActionText}>다시 시도</Text>
        </Pressable>
        <View style={styles.secondaryActions}>
          <Pressable style={styles.secondaryAction} onPress={onSearch}>
            <Feather name="search" size={15} color="rgba(255,255,255,0.6)" />
            <Text style={styles.secondaryActionText}>새 곡 검색</Text>
          </Pressable>
        </View>
      </View>
    </ArtworkStage>
  );
}

function HomeChrome({
  streak,
  progress,
  onSearch,
}: {
  streak: number;
  progress: number;
  onSearch: () => void;
}) {
  return (
    <View style={styles.chrome}>
      <View style={styles.appBar}>
        <Text style={styles.wordmark}>Kotonoha</Text>
        <View style={styles.appBarRight}>
          <View style={styles.streakRow}>
            <Feather name="zap" size={15} color={Colors.streakFlame} />
            <Text style={styles.streakText}>{streak}일</Text>
          </View>
          <Pressable onPress={onSearch} hitSlop={8} style={styles.iconButton}>
            <Feather name="search" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(0.04, progress) * 100}%` }]} />
      </View>
    </View>
  );
}

function WordStage({
  card,
  revealed,
  selectedRating,
  saving,
  translateY,
  panHandlers,
  onReveal,
  onRating,
  onSourcePress,
}: {
  card: HomeStudyCard;
  revealed: boolean;
  selectedRating: number | null;
  saving: boolean;
  translateY: Animated.Value;
  panHandlers: GestureResponderHandlers;
  onReveal: () => void;
  onRating: (rating: number) => void;
  onSourcePress: () => void;
}) {
  const opacity = translateY.interpolate({
    inputRange: [-160, 0],
    outputRange: [0.25, 1],
    extrapolate: 'clamp',
  });

  return (
    <ArtworkStage artworkUrl={card.source.artworkUrl}>
      <SourceHeader source={card.source} onPress={onSourcePress} />
      <Animated.View
        style={[
          styles.wordLayer,
          { opacity, transform: [{ translateY }] },
        ]}
        {...panHandlers}
      >
        <Pressable style={styles.wordPressable} onPress={!revealed ? onReveal : undefined}>
          {!revealed ? (
            <WordFront card={card} />
          ) : (
            <WordBack
              card={card}
              selectedRating={selectedRating}
              saving={saving}
              onRating={onRating}
            />
          )}
        </Pressable>
      </Animated.View>
    </ArtworkStage>
  );
}

function ArtworkStage({
  artworkUrl,
  children,
}: {
  artworkUrl: string | null;
  children: React.ReactNode;
}) {
  const content = (
    <>
      <View style={styles.tint} />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.68)', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.50)', 'rgba(0,0,0,0.07)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </>
  );

  if (!artworkUrl) {
    return <View style={[styles.stageArt, styles.fallbackArt]}>{content}</View>;
  }

  return (
    <ImageBackground
      source={{ uri: artworkUrl }}
      resizeMode="cover"
      blurRadius={8}
      style={styles.stageArt}
      imageStyle={styles.stageImage}
    >
      {content}
    </ImageBackground>
  );
}

function SourceHeader({ source, onPress }: { source: HomeSource; onPress: () => void }) {
  return (
    <Pressable style={styles.sourceRow} onPress={onPress} disabled={source.songId == null}>
      <ArtworkThumb source={source} size={40} radius={8} />
      <View style={styles.sourceTextCol}>
        <Text numberOfLines={1} style={styles.sourceTitle}>{source.title}</Text>
        <Text numberOfLines={1} style={styles.sourceSub}>
          {source.artist}{source.totalCount > 0 ? ` · ${Math.max(0, source.totalCount - source.dueCount)} / ${source.totalCount}` : ''}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
    </Pressable>
  );
}

function ArtworkThumb({ source, size, radius }: { source: HomeSource; size: number; radius: number }) {
  if (!source.artworkUrl) {
    return <View style={[styles.thumbFallback, { width: size, height: size, borderRadius: radius }]} />;
  }
  return (
    <ImageBackground
      source={{ uri: source.artworkUrl }}
      resizeMode="cover"
      style={[styles.thumb, { width: size, height: size, borderRadius: radius }]}
      imageStyle={{ borderRadius: radius }}
    />
  );
}

function WordFront({ card }: { card: HomeStudyCard }) {
  return (
    <View style={styles.wordFront}>
      <View style={styles.frontWordGroup}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.frontHeadword}>
          {card.japanese}
        </Text>
      </View>
      <View style={styles.tapHint}>
        <MaterialIcons name="touch-app" size={16} color="rgba(255,255,255,0.85)" />
        <Text style={styles.tapHintText}>떠올린 후 탭해서 뜻 보기</Text>
      </View>
    </View>
  );
}

function WordBack({
  card,
  selectedRating,
  saving,
  onRating,
}: {
  card: HomeStudyCard;
  selectedRating: number | null;
  saving: boolean;
  onRating: (rating: number) => void;
}) {
  const meaning = joinMeanings(card.senses);
  const firstSense = card.senses[0];
  const example = flattenExamples(card.senses)[0];
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
        {RATINGS.map(({ rating, label, fallbackInterval }) => {
          const selected = selectedRating === rating;
          const dimmed = selectedRating != null && !selected;
          return (
            <Pressable
              key={rating}
              style={[styles.ratingButton, selected && styles.ratingButtonSelected, dimmed && styles.ratingButtonDimmed]}
              onPress={() => onRating(rating)}
              disabled={saving}
            >
              <Text style={[styles.ratingLabel, selected && styles.ratingLabelSelected]}>{label}</Text>
              <Text style={[styles.ratingInterval, selected && styles.ratingIntervalSelected]}>
                {card.intervals?.[rating] ?? fallbackInterval}
              </Text>
            </Pressable>
          );
        })}
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
}

function CompletionStage({
  completedSource,
  nextDueSource,
  recommendedSource,
  onContinueDue,
  onRecommended,
  onSearch,
}: {
  completedSource: HomeSource | null;
  nextDueSource: HomeSource | null;
  recommendedSource: HomeSource | null;
  onContinueDue: () => void;
  onRecommended: () => void;
  onSearch: () => void;
}) {
  const stageSource = nextDueSource ?? recommendedSource ?? completedSource ?? MOCK_RECOMMENDED_SOURCE;
  const hasNextDue = nextDueSource != null;
  const primaryLabel = hasNextDue ? '이어서 복습' : '이어서 학습';

  return (
    <ArtworkStage artworkUrl={stageSource.artworkUrl}>
      <View style={styles.completeCenter}>
        {hasNextDue || completedSource ? (
          <ArtworkThumb source={completedSource ?? stageSource} size={72} radius={14} />
        ) : (
          <View style={styles.doneBadge}>
            <Feather name="check" size={32} color="#A7E3C4" />
          </View>
        )}
        <View style={styles.doneGroup}>
          <Text style={styles.doneTitle}>
            {completedSource ? `${completedSource.title} 완주!` : '오늘 복습 끝!'}
          </Text>
          <View style={styles.doneSubRow}>
            <Feather name="check-circle" size={15} color="#A7E3C4" />
            <Text numberOfLines={2} style={styles.doneSub}>
              {completedSource
                ? `이 곡 단어 ${completedSource.totalCount}개를 전부 복습했어요`
                : '오늘의 모든 단어를 복습했어요'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.completeBottom}>
        <View style={styles.nudgeDivider} />
        <View style={styles.nudgeBlock}>
          <Text style={styles.nudgeReason}>
            {hasNextDue ? '복습할 단어가 남은 곡이 하나 더 있어요' : '새 단어를 배울 곡을 골라봤어요'}
          </Text>
          {stageSource && (
            <View style={styles.nextSourceRow}>
              <ArtworkThumb source={stageSource} size={34} radius={7} />
              <View style={styles.nextSourceText}>
                <Text numberOfLines={1} style={styles.nextTitle}>{stageSource.title}</Text>
                <Text numberOfLines={1} style={styles.nextSub}>
                  {stageSource.artist} · {hasNextDue ? `오늘 ${stageSource.dueCount}개 남음` : `배울 단어 ${stageSource.totalCount}개`}
                </Text>
              </View>
            </View>
          )}
        </View>

        <Pressable style={styles.primaryAction} onPress={hasNextDue ? onContinueDue : onRecommended}>
          <Text style={styles.primaryActionText}>{primaryLabel}</Text>
        </Pressable>

        <View style={styles.secondaryActions}>
          {hasNextDue && recommendedSource && (
            <Pressable style={styles.secondaryAction} onPress={onRecommended}>
              <Feather name="book-open" size={15} color="rgba(255,255,255,0.6)" />
              <Text style={styles.secondaryActionText}>추천곡 학습</Text>
            </Pressable>
          )}
          <Pressable style={styles.secondaryAction} onPress={onSearch}>
            <Feather name="search" size={15} color="rgba(255,255,255,0.6)" />
            <Text style={styles.secondaryActionText}>새 곡 검색</Text>
          </Pressable>
        </View>
      </View>
    </ArtworkStage>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  chrome: {
    backgroundColor: Colors.background,
  },
  appBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  wordmark: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0,
    color: Colors.textPrimary,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  iconButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#D2D2D2',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  stage: {
    flex: 1,
    backgroundColor: '#14181C',
    overflow: 'hidden',
  },
  stageArt: {
    flex: 1,
    backgroundColor: '#14181C',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
  },
  fallbackArt: {
    backgroundColor: '#16242A',
  },
  stageImage: {
    transform: [{ scale: 1.18 }],
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,24,28,0.30)',
  },
  loadingLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  sourceRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 2,
  },
  thumb: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  thumbFallback: {
    backgroundColor: 'rgba(82,183,136,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sourceTextCol: {
    flex: 1,
    gap: 2,
  },
  sourceTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sourceSub: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 11,
    fontWeight: '500',
  },
  wordLayer: {
    flex: 1,
    zIndex: 2,
  },
  wordPressable: {
    flex: 1,
  },
  wordFront: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 18,
  },
  frontWordGroup: {
    maxWidth: '100%',
  },
  frontHeadword: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: 0,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tapHintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
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
  completeCenter: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
    zIndex: 2,
  },
  doneBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,24,28,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(167,227,196,0.48)',
  },
  errorBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,24,28,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,212,212,0.48)',
  },
  reviewErrorBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(58,22,22,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,212,212,0.34)',
  },
  reviewErrorText: {
    flex: 1,
    color: '#FFD4D4',
    fontSize: 13,
    lineHeight: 18,
  },
  doneGroup: {
    gap: 8,
  },
  doneTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 37,
    letterSpacing: 0,
  },
  doneSubRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  doneSub: {
    flex: 1,
    color: 'rgba(255,255,255,0.90)',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  completeBottom: {
    gap: 16,
    zIndex: 2,
  },
  nudgeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  nudgeBlock: {
    gap: 10,
  },
  nudgeReason: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  nextSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nextSourceText: {
    flex: 1,
    gap: 2,
  },
  nextTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  nextSub: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 13,
    fontWeight: '500',
  },
  primaryAction: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#14181C',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActions: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 96,
  },
  secondaryActionText: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 13,
    fontWeight: '600',
  },
});
