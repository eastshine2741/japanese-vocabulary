import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/theme';
import { Layers } from '../../theme/layers';
import {
  AppBottomSheet,
  AppBottomSheetRef,
  AppBottomSheetView,
  AppSheetOwnedScrollView,
} from '../bottomSheet';
import { getPosColor } from '../../types/pos';
import { Token } from '../../types/song';
import { convertLineReading } from '../../utils/readingConverter';
import SongDetailWordRow from './SongDetailWordRow';
import { getSongDetailWordKey } from './songDetailWordSave';
import { SongDetailWordItem } from './types';
import { getCurrentLyricLineIndex } from './useCurrentLyricLine';

export const CURRENT_PLAYING_WORDS_PEEK_HEIGHT = 70;

export interface CurrentPlayingLyricLine {
  index: number;
  originalText: string;
  startTimeMs: number | null;
  koreanLyrics: string | null;
  /** 줄 발음은 토큰에서 조립한다. 토큰마다 그 줄에서 불리는 발음이 들어 있다. */
  tokens?: Token[];
}

export type CurrentPlayingWord = SongDetailWordItem & {
  id?: number | string;
  baseFormReading?: string | null;
  senses?: { meaning: string }[];
};

interface WordPage {
  key: string;
  line: CurrentPlayingLyricLine;
  words: CurrentPlayingWord[];
}

export interface CurrentPlayingWordsSheetProps {
  lines: CurrentPlayingLyricLine[];
  words?: CurrentPlayingWord[];
  lineWordIndexes?: Record<string, number[]> | Map<number, number[]>;
  lyricType?: 'SYNCED' | 'PLAIN';
  currentTimeMs: number;
  fallbackLineIndex?: number;
  bottomInset?: number;
  expandedHeight?: number;
  header?: React.ReactNode;
  headerHeight?: number;
  zIndex?: number;
  busyWordKey: string | null;
  /** 단어를 누르면 그 단어부터 복습한다 — 단어 탭·주요 단어와 같은 동작. */
  onStartWordReview: (word: CurrentPlayingWord) => void;
  onSheetChange?: (index: number) => void;
  onSyncedPageChange?: (line: CurrentPlayingLyricLine) => void;
}

interface PageCardProps {
  page: WordPage;
  width: number;
  busyWordKey: string | null;
  onStartWordReview: (word: CurrentPlayingWord) => void;
}

interface LyricToken {
  key: string;
  text: string;
  reading: string;
  underlineColor: string | null;
}

interface LyricFontSizes {
  text: number;
  textLineHeight: number;
  reading: number;
  readingLineHeight: number;
  readingMinHeight: number;
}

const KANJI_RE = /[一-鿿]/;
const ASCII_RE = /^[\u0020-\u007E]$/;
const JAPANESE_PUNCTUATION_RE = /^[、。，．！？・「」『』（）［］【】]$/;
const LYRIC_BLOCK_HORIZONTAL_PADDING = 0;
const LYRIC_TOKEN_GAP = 4;
const MAX_LYRIC_TEXT_FONT_SIZE = 18;
const MIN_LYRIC_TEXT_FONT_SIZE = 6;
const MAX_LYRIC_READING_FONT_SIZE = 9;
const MIN_LYRIC_READING_FONT_SIZE = 5;
const LYRIC_FONT_FIT_SAFETY = 0.92;
const NO_UNDERLINE_POS = new Set(['SYMBOL', 'SUPPLEMENTARY_SYMBOL', 'WHITESPACE']);

function getLineWordIndexes(
  lineWordIndexes: Record<string, number[]> | Map<number, number[]> | undefined,
  lineIndex: number,
): number[] {
  if (!lineWordIndexes) return [];
  if (lineWordIndexes instanceof Map) return lineWordIndexes.get(lineIndex) ?? [];
  return lineWordIndexes[String(lineIndex)] ?? [];
}

function wordLabel(word: CurrentPlayingWord): string {
  return word.baseForm ?? word.japanese ?? word.surface ?? '';
}

function wordReading(word: CurrentPlayingWord): string | null {
  return word.baseFormReading ?? word.reading ?? null;
}

function tokenSurface(word: CurrentPlayingWord): string {
  return word.surface || word.japanese || word.baseForm || '';
}

function pushPlainToken(tokens: LyricToken[], text: string, key: string) {
  if (text === '') return;
  tokens.push({
    key,
    text,
    reading: ' ',
    underlineColor: null,
  });
}

function visibleFurigana(text: string, reading: string | null | undefined): string {
  return reading && KANJI_RE.test(text) ? reading : ' ';
}

function getTokenUnderlineColor(partOfSpeech: string | null | undefined): string | null {
  if (!partOfSpeech || NO_UNDERLINE_POS.has(partOfSpeech)) return null;
  return getPosColor(partOfSpeech);
}

function lyricCharacterWeight(char: string): number {
  if (char.trim() === '') return 0.35;
  if (ASCII_RE.test(char)) return 0.55;
  if (JAPANESE_PUNCTUATION_RE.test(char)) return 0.65;
  return 1;
}

function lyricTextWeight(text: string): number {
  return Array.from(text).reduce((sum, char) => sum + lyricCharacterWeight(char), 0);
}

function getLyricFontSizes(tokens: LyricToken[], width: number): LyricFontSizes {
  const availableWidth = Math.max(1, width - LYRIC_BLOCK_HORIZONTAL_PADDING * 2);
  const gapWidth = Math.max(0, tokens.length - 1) * LYRIC_TOKEN_GAP;
  const readingToTextRatio = MAX_LYRIC_READING_FONT_SIZE / MAX_LYRIC_TEXT_FONT_SIZE;
  const tokenUnits = tokens.reduce((sum, token) => {
    const textUnits = lyricTextWeight(token.text);
    const readingUnits = lyricTextWeight(token.reading.trim()) * readingToTextRatio;
    return sum + Math.max(textUnits, readingUnits);
  }, 0);
  const fitFontSize = tokenUnits > 0
    ? ((availableWidth - gapWidth) / tokenUnits) * LYRIC_FONT_FIT_SAFETY
    : MAX_LYRIC_TEXT_FONT_SIZE;
  const text = Math.max(
    MIN_LYRIC_TEXT_FONT_SIZE,
    Math.min(MAX_LYRIC_TEXT_FONT_SIZE, fitFontSize),
  );
  const reading = Math.max(
    MIN_LYRIC_READING_FONT_SIZE,
    Math.min(MAX_LYRIC_READING_FONT_SIZE, text * readingToTextRatio),
  );

  return {
    text,
    textLineHeight: Math.ceil(text + 3),
    reading,
    readingLineHeight: Math.ceil(reading + 2),
    readingMinHeight: Math.ceil(reading + 2),
  };
}

function buildAnalyzedLyricTokens(text: string, analyzedTokens: Token[]): LyricToken[] {
  const tokens: LyricToken[] = [];
  let cursor = 0;

  analyzedTokens
    .slice()
    .sort((a, b) => a.charStart - b.charStart)
    .forEach((token, index) => {
      if (token.charStart > cursor) {
        pushPlainToken(tokens, text.slice(cursor, token.charStart), `gap-${index}`);
      }

      const tokenText = text.slice(token.charStart, token.charEnd) || token.surface;
      tokens.push({
        key: `token-${index}-${token.charStart}`,
        text: tokenText,
        reading: visibleFurigana(tokenText, token.baseFormReading ?? token.reading),
        underlineColor: getTokenUnderlineColor(token.partOfSpeech),
      });
      cursor = Math.max(cursor, token.charEnd);
    });

  if (cursor < text.length) {
    pushPlainToken(tokens, text.slice(cursor), 'tail');
  }

  if (tokens.length === 0) {
    pushPlainToken(tokens, text, 'fallback');
  }

  return tokens;
}

function buildLyricTokens(text: string, words: CurrentPlayingWord[]): LyricToken[] {
  const tokens: LyricToken[] = [];
  let cursor = 0;

  words.forEach((word, index) => {
    const candidates = [tokenSurface(word), wordLabel(word), word.baseForm]
      .filter((candidate): candidate is string => Boolean(candidate));
    let matchStart = -1;
    let matchText = '';

    for (const candidate of candidates) {
      const found = text.indexOf(candidate, cursor);
      if (found >= 0 && (matchStart < 0 || found < matchStart)) {
        matchStart = found;
        matchText = candidate;
      }
    }

    if (matchStart < 0 || matchText === '') return;
    if (matchStart > cursor) {
      pushPlainToken(tokens, text.slice(cursor, matchStart), `gap-${index}`);
    }
    tokens.push({
      key: `word-${index}-${matchStart}`,
      text: matchText,
      reading: visibleFurigana(matchText, wordReading(word)),
      underlineColor: getTokenUnderlineColor(word.partOfSpeech),
    });
    cursor = matchStart + matchText.length;
  });

  if (cursor < text.length) {
    pushPlainToken(tokens, text.slice(cursor), 'tail');
  }

  if (tokens.length === 0) {
    pushPlainToken(tokens, text, 'fallback');
  }

  return tokens;
}

const LyricTokenStack = React.memo(function LyricTokenStack({
  token,
  fontSizes,
}: {
  token: LyricToken;
  fontSizes: LyricFontSizes;
}) {
  return (
    <View style={styles.lyricToken}>
      <Text
        style={[
          styles.tokenReading,
          {
            fontSize: fontSizes.reading,
            lineHeight: fontSizes.readingLineHeight,
            minHeight: fontSizes.readingMinHeight,
          },
        ]}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {token.reading}
      </Text>
      <Text
        style={[
          styles.tokenText,
          {
            fontSize: fontSizes.text,
            lineHeight: fontSizes.textLineHeight,
          },
        ]}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {token.text}
      </Text>
      {token.underlineColor ? (
        <View style={[styles.tokenUnderline, { backgroundColor: token.underlineColor }]} />
      ) : null}
    </View>
  );
});

interface SheetHandleContextValue {
  header: React.ReactNode;
  headerHeight: number;
}

const SheetHandleContext = React.createContext<SheetHandleContextValue>({
  header: null,
  headerHeight: 0,
});

/**
 * MV 바가 시트의 핸들이다. 본문 pan 과 별개로 바에서도 시트를 끌 수 있다.
 *
 * 모듈 레벨 컴포넌트여야 한다 — handleComponent 로 매 렌더 새 함수를 넘기면 React 가
 * 다른 타입으로 보고 핸들을 새로 마운트해서, 안에 든 MV WebView 가 계속 초기화된다.
 * 바뀌는 값은 context 로 넘겨 리렌더만 시킨다.
 */
function SheetHandle() {
  const { header, headerHeight } = React.useContext(SheetHandleContext);
  return <View style={[styles.headerSlot, { height: headerHeight }]}>{header}</View>;
}

const CurrentWordsPageCard = React.memo(function CurrentWordsPageCard({
  page,
  width,
  busyWordKey,
  onStartWordReview,
}: PageCardProps) {
  const lyricTokens = useMemo(
    () => page.line.tokens && page.line.tokens.length > 0
      ? buildAnalyzedLyricTokens(page.line.originalText, page.line.tokens)
      : buildLyricTokens(page.line.originalText, page.words),
    [page.line.originalText, page.line.tokens, page.words],
  );
  const lyricFontSizes = useMemo(
    () => getLyricFontSizes(lyricTokens, width),
    [lyricTokens, width],
  );
  // 토큰에서 조립한다 — 단어 사이는 띄고, 받침은 토큰 경계를 넘고, 장음은 넘지 않는다.
  // 단어가 없는 줄은 조립할 게 없어서 빈 문자열이고, 그때는 독음 줄을 그리지 않는다.
  const koreanPronunciation = useMemo(
    () => convertLineReading(page.line.originalText, page.line.tokens ?? [], 'KOREAN'),
    [page.line.originalText, page.line.tokens],
  );
  const hasCurrentKorean = Boolean(koreanPronunciation || page.line.koreanLyrics);

  return (
    <View style={[styles.pageCard, { width }]}>
      <View style={styles.lyricBlock}>
        <View style={styles.lyricTokens}>
          {lyricTokens.map(token => (
            <LyricTokenStack key={token.key} token={token} fontSizes={lyricFontSizes} />
          ))}
        </View>
        {hasCurrentKorean ? (
          <View style={styles.currentKorean}>
            {koreanPronunciation ? (
              <Text style={styles.koreanPronunciationText} numberOfLines={1}>
                {koreanPronunciation}
              </Text>
            ) : null}
            {page.line.koreanLyrics ? (
              <Text style={styles.koreanTranslationText} numberOfLines={2}>
                {page.line.koreanLyrics}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* 세로 드래그를 이 목록이 소유한다. 위의 가사 카드에서 밀면 시트가 움직인다. */}
      <AppSheetOwnedScrollView
        style={styles.wordsScroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.wordListBody}>
          {page.words.length > 0 ? (
            page.words.map((word, index) => {
              const wordKey = getSongDetailWordKey(word);
              return (
                <SongDetailWordRow
                  key={wordKey}
                  word={word}
                  isBusy={busyWordKey === wordKey}
                  showDivider={index < page.words.length - 1}
                  onStartReview={onStartWordReview}
                />
              );
            })
          ) : (
            <View style={styles.emptyWords}>
              <Text style={styles.emptyTitle}>이 가사의 단어가 아직 없어요</Text>
              <Text style={styles.emptyBody}>분석이 끝나면 여기에서 바로 볼 수 있어요.</Text>
            </View>
          )}
        </View>
      </AppSheetOwnedScrollView>
    </View>
  );
});

const CurrentPlayingWordsSheetComponent = React.forwardRef<AppBottomSheetRef, CurrentPlayingWordsSheetProps>(function CurrentPlayingWordsSheetComponent({
  lines,
  words = [],
  lineWordIndexes,
  lyricType,
  currentTimeMs,
  fallbackLineIndex = 0,
  bottomInset,
  expandedHeight,
  header,
  headerHeight = 0,
  zIndex = Layers.currentPlayingWordsSheet,
  busyWordKey,
  onStartWordReview,
  onSheetChange,
  onSyncedPageChange,
}, ref) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<WordPage>>(null);
  const isUserPagingRef = useRef(false);
  const pendingUserSyncedPageIndexRef = useRef<number | null>(null);
  const scrollEndDragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inferredLyricType = lyricType ?? (lines.some(line => line.startTimeMs != null) ? 'SYNCED' : 'PLAIN');
  const canAutoSync = inferredLyricType === 'SYNCED';
  const [autoSyncEnabled, setAutoSyncEnabled] = React.useState(canAutoSync);
  // 첫 렌더에 보이는 페이지는 initialScrollIndex 가 가리키는 자리다. 0 으로 두면
  // 화면에 없는 카드가 보이는 카드로 취급돼 시트에 아무 스크롤도 등록되지 않는다.
  const [visiblePageIndex, setVisiblePageIndex] = React.useState(() => Math.max(fallbackLineIndex, 0));
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const sheetBottomInset = bottomInset ?? insets.bottom;
  const pageWidth = Math.max(280, screenWidth - 44);
  const pageInterval = pageWidth + 12;
  const collapsedHeight = header ? headerHeight : CURRENT_PLAYING_WORDS_PEEK_HEIGHT;
  const snapPoints = useMemo<(string | number)[]>(
    () => [
      collapsedHeight,
      expandedHeight ?? Math.max(320, screenHeight - sheetBottomInset - insets.top),
    ],
    [collapsedHeight, expandedHeight, insets.top, screenHeight, sheetBottomInset],
  );

  const currentLineIndex = useMemo(
    () => getCurrentLyricLineIndex(lines, currentTimeMs, fallbackLineIndex),
    [lines, currentTimeMs, fallbackLineIndex],
  );

  const pages = useMemo<WordPage[]>(() => {
    return lines.map(line => {
      // lineWordIndexes 는 서버가 그 줄에 나온 순서로 내려준다. 여기서 다시 정렬하면
      // 줄 안 어순이 곡 전체 등장순으로 덮인다 — 후렴에서 먼저 나온 단어가 앞으로 끌려온다.
      const wordIndexes = getLineWordIndexes(lineWordIndexes, line.index);
      return {
        key: String(line.index),
        line,
        words: wordIndexes.map(wordIndex => words[wordIndex]).filter(Boolean),
      };
    });
  }, [lines, words, lineWordIndexes]);

  const activePageIndex = useMemo(() => {
    if (pages.length === 0) return 0;
    return Math.min(Math.max(currentLineIndex, 0), pages.length - 1);
  }, [currentLineIndex, pages.length]);

  const scrollToPage = useCallback((index: number, animated: boolean) => {
    if (pages.length === 0) return;
    const targetIndex = Math.min(Math.max(index, 0), pages.length - 1);
    listRef.current?.scrollToIndex({
      index: targetIndex,
      animated,
      viewPosition: 0,
    });
    setVisiblePageIndex(targetIndex);
  }, [pages.length]);

  const clearScrollEndDragTimeout = useCallback(() => {
    if (scrollEndDragTimeoutRef.current != null) {
      clearTimeout(scrollEndDragTimeoutRef.current);
      scrollEndDragTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    setAutoSyncEnabled(canAutoSync);
  }, [canAutoSync, inferredLyricType]);

  useEffect(() => {
    if (pages.length === 0) {
      setVisiblePageIndex(0);
      return;
    }
    setVisiblePageIndex(prev => Math.min(prev, pages.length - 1));
  }, [pages.length]);

  useEffect(() => clearScrollEndDragTimeout, [clearScrollEndDragTimeout]);

  useEffect(() => {
    if (!autoSyncEnabled) return;
    if (isUserPagingRef.current) return;
    const pendingUserSyncedPageIndex = pendingUserSyncedPageIndexRef.current;
    if (pendingUserSyncedPageIndex != null) {
      if (pendingUserSyncedPageIndex !== activePageIndex) return;
      pendingUserSyncedPageIndexRef.current = null;
    }
    scrollToPage(activePageIndex, true);
  }, [activePageIndex, autoSyncEnabled, scrollToPage]);

  const handleToggleAutoSync = useCallback(() => {
    if (!canAutoSync) return;
    const next = !autoSyncEnabled;
    setAutoSyncEnabled(next);
    pendingUserSyncedPageIndexRef.current = null;
    isUserPagingRef.current = false;
    if (next) {
      requestAnimationFrame(() => scrollToPage(activePageIndex, true));
    }
  }, [activePageIndex, autoSyncEnabled, canAutoSync, scrollToPage]);

  const handlePageScrollBegin = useCallback(() => {
    clearScrollEndDragTimeout();
    isUserPagingRef.current = true;
  }, [clearScrollEndDragTimeout]);

  const settlePageScroll = useCallback((offsetX: number) => {
    if (pages.length === 0) return;
    clearScrollEndDragTimeout();
    isUserPagingRef.current = false;
    const nextIndex = Math.min(
      Math.max(Math.round(offsetX / pageInterval), 0),
      pages.length - 1,
    );
    const didChangePage = nextIndex !== visiblePageIndex;
    setVisiblePageIndex(nextIndex);
    if (autoSyncEnabled && didChangePage) {
      const targetLine = pages[nextIndex]?.line;
      if (targetLine?.startTimeMs != null) {
        pendingUserSyncedPageIndexRef.current = nextIndex;
        onSyncedPageChange?.(targetLine);
      }
    }
  }, [autoSyncEnabled, clearScrollEndDragTimeout, onSyncedPageChange, pageInterval, pages, visiblePageIndex]);

  const handlePageScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    settlePageScroll(event.nativeEvent.contentOffset.x);
  }, [settlePageScroll]);

  const handlePageScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    clearScrollEndDragTimeout();
    scrollEndDragTimeoutRef.current = setTimeout(() => {
      scrollEndDragTimeoutRef.current = null;
      settlePageScroll(offsetX);
    }, 120);
  }, [clearScrollEndDragTimeout, settlePageScroll]);

  const renderPage = useCallback(({ item }: ListRenderItemInfo<WordPage>) => (
    <CurrentWordsPageCard
      page={item}
      width={pageWidth}
      busyWordKey={busyWordKey}
      onStartWordReview={onStartWordReview}
    />
  ), [busyWordKey, onStartWordReview, pageWidth]);

  const keyExtractor = useCallback((item: WordPage) => item.key, []);
  const handleScrollToIndexFailed = useCallback(() => {
    requestAnimationFrame(() => {
      scrollToPage(activePageIndex, false);
    });
  }, [activePageIndex, scrollToPage]);

  const handleContextValue = useMemo<SheetHandleContextValue>(
    () => ({ header, headerHeight }),
    [header, headerHeight],
  );

  const pageStatusText = pages.length > 0 ? `${visiblePageIndex + 1}/${pages.length}` : '0/0';

  return (
    <SheetHandleContext.Provider value={handleContextValue}>
      <AppBottomSheet
        ref={ref}
        snapPoints={snapPoints}
        index={0}
        bottomInset={sheetBottomInset}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        enableOverDrag={false}
        hasHorizontalContent
        backgroundStyle={styles.sheetBackground}
        handleComponent={header ? SheetHandle : null}
        containerStyle={[styles.sheetContainer, { zIndex, elevation: zIndex }]}
        style={[styles.sheet, { zIndex, elevation: zIndex }]}
        onChange={onSheetChange}
      >
        <AppBottomSheetView fill style={styles.sheetContent}>
          <View style={styles.syncRow}>
            <Text style={styles.pageStatusText}>{pageStatusText}</Text>
            <Pressable
              accessibilityLabel="가사 자동 넘김"
              accessibilityRole="switch"
              accessibilityState={{ checked: autoSyncEnabled, disabled: !canAutoSync }}
              disabled={!canAutoSync}
              hitSlop={8}
              onPress={handleToggleAutoSync}
              style={[
                styles.syncToggle,
                autoSyncEnabled && styles.syncToggleOn,
                !autoSyncEnabled && canAutoSync && styles.syncToggleOff,
                !canAutoSync && styles.syncToggleDisabled,
              ]}
            >
              <Text
                style={[
                  styles.syncToggleText,
                  autoSyncEnabled && styles.syncToggleTextOn,
                  !autoSyncEnabled && canAutoSync && styles.syncToggleTextOff,
                  !canAutoSync && styles.syncToggleTextDisabled,
                ]}
              >
                {!canAutoSync ? '싱크 OFF' : autoSyncEnabled ? '싱크 ON' : '싱크 OFF'}
              </Text>
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={pages}
            keyExtractor={keyExtractor}
            renderItem={renderPage}
            horizontal
            pagingEnabled={false}
            snapToInterval={pageInterval}
            disableIntervalMomentum
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={activePageIndex > 0 ? activePageIndex : undefined}
            getItemLayout={(_, index) => ({
              length: pageInterval,
              offset: pageInterval * index,
              index,
            })}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            onScrollBeginDrag={handlePageScrollBegin}
            onMomentumScrollBegin={handlePageScrollBegin}
            onMomentumScrollEnd={handlePageScrollEnd}
            onScrollEndDrag={handlePageScrollEndDrag}
            style={styles.pagesPager}
            contentContainerStyle={styles.pagesContent}
            ItemSeparatorComponent={PageSeparator}
            removeClippedSubviews={false}
            // 96줄짜리 곡이면 기본값으로 카드가 열 장 넘게 살아 있다. 앞뒤 한 장만 준비해 둔다.
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={3}
          />
        </AppBottomSheetView>
      </AppBottomSheet>
    </SheetHandleContext.Provider>
  );
});

function PageSeparator() {
  return <View style={styles.pageSeparator} />;
}

export const CurrentPlayingWordsSheet = React.memo(CurrentPlayingWordsSheetComponent);

const styles = StyleSheet.create({
  sheetContainer: {
    zIndex: Layers.currentPlayingWordsSheet,
    elevation: Layers.currentPlayingWordsSheet,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  sheetBackground: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetContent: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.background,
  },
  pagesPager: {
    flex: 1,
  },
  headerSlot: {
    width: '100%',
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.background,
  },
  syncRow: {
    height: 28,
    paddingHorizontal: 16,
    marginTop: 11,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageStatusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  syncToggle: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncToggleOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  syncToggleOff: {
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  syncToggleDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    opacity: 0.48,
  },
  syncToggleText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  syncToggleTextOn: {
    color: Colors.primary,
  },
  syncToggleTextOff: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  syncToggleTextDisabled: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  pagesContent: {
    paddingHorizontal: 22,
    paddingTop: 0,
  },
  pageSeparator: {
    width: 12,
  },
  pageCard: {
    flex: 1,
    gap: 12,
    backgroundColor: 'transparent',
  },
  lyricBlock: {
    height: 110,
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: Colors.elevated,
  },
  lyricTokens: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: LYRIC_TOKEN_GAP,
    overflow: 'hidden',
  },
  lyricToken: {
    alignItems: 'center',
    gap: 1,
    flexShrink: 0,
  },
  tokenReading: {
    color: '#777777',
  },
  tokenText: {
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  tokenUnderline: {
    width: '100%',
    height: 2,
  },
  currentKorean: {
    width: '100%',
    gap: 4,
  },
  koreanPronunciationText: {
    fontSize: 10,
    lineHeight: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  koreanTranslationText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  wordsScroll: {
    flex: 1,
  },
  wordListBody: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  emptyWords: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
});
