import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ListRenderItemInfo,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FlatList, NativeViewGestureHandler, ScrollView } from 'react-native-gesture-handler';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/theme';
import { Layers } from '../../theme/layers';
import { AppBottomSheet } from '../bottomSheet';
import { getPosColor } from '../../types/pos';
import { Token } from '../../types/song';
import SongDetailWordRow from './SongDetailWordRow';
import { getCurrentLyricLineIndex } from './useCurrentLyricLine';

export const CURRENT_PLAYING_WORDS_PEEK_HEIGHT = 70;

export interface CurrentPlayingLyricLine {
  index: number;
  originalText: string;
  startTimeMs: number | null;
  koreanLyrics: string | null;
  koreanPronounciation?: string | null;
  tokens?: Token[];
}

export interface CurrentPlayingWord {
  id?: number | string;
  japanese?: string;
  baseForm?: string | null;
  surface?: string;
  reading?: string | null;
  baseFormReading?: string | null;
  koreanText?: string | null;
  meanings?: { text: string; partOfSpeech?: string | null }[];
  partOfSpeech?: string | null;
  partOfSpeechLabel?: string | null;
  jlpt?: string | null;
  appearanceOrder?: number | null;
}

interface WordPage {
  key: string;
  line: CurrentPlayingLyricLine;
  words: CurrentPlayingWord[];
}

export interface CurrentPlayingWordsSheetProps {
  lines: CurrentPlayingLyricLine[];
  words?: CurrentPlayingWord[];
  lineWordIndexes?: Record<string, number[]> | Map<number, number[]>;
  currentTimeMs: number;
  fallbackLineIndex?: number;
  bottomInset?: number;
  expandedHeight?: number;
  header?: React.ReactNode;
  headerHeight?: number;
  zIndex?: number;
}

interface PageCardProps {
  page: WordPage;
  width: number;
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
const LYRIC_BLOCK_HORIZONTAL_PADDING = 16;
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

function appearanceOrder(word: CurrentPlayingWord): number {
  return typeof word.appearanceOrder === 'number' && Number.isFinite(word.appearanceOrder)
    ? word.appearanceOrder
    : Number.MAX_SAFE_INTEGER;
}

function sortWordsByAppearanceOrder(words: CurrentPlayingWord[]): CurrentPlayingWord[] {
  return words
    .map((word, index) => ({ word, index }))
    .sort((a, b) => {
      const orderDiff = appearanceOrder(a.word) - appearanceOrder(b.word);
      return orderDiff !== 0 ? orderDiff : a.index - b.index;
    })
    .map(item => item.word);
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

const CurrentWordsPageCard = React.memo(function CurrentWordsPageCard({ page, width }: PageCardProps) {
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

  return (
    <View style={[styles.pageCard, { width }]}>
      <View style={styles.lyricBlock}>
        <View style={styles.lyricTokens}>
          {lyricTokens.map(token => (
            <LyricTokenStack key={token.key} token={token} fontSizes={lyricFontSizes} />
          ))}
        </View>
        {page.line.koreanLyrics ? (
          <Text style={styles.translationText} numberOfLines={2}>{page.line.koreanLyrics}</Text>
        ) : null}
      </View>

      <ScrollView
        style={styles.wordsScroll}
        contentContainerStyle={styles.wordsScrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.wordListBody}>
          {page.words.length > 0 ? (
            page.words.map((word, index) => (
              <SongDetailWordRow
                key={`${word.id ?? wordLabel(word)}-${wordReading(word) ?? ''}`}
                word={word}
                showDivider={index < page.words.length - 1}
              />
            ))
          ) : (
            <View style={styles.emptyWords}>
              <Text style={styles.emptyTitle}>이 가사의 단어가 아직 없어요</Text>
              <Text style={styles.emptyBody}>분석이 끝나면 여기에서 바로 볼 수 있어요.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
});

function CurrentPlayingWordsSheetComponent({
  lines,
  words = [],
  lineWordIndexes,
  currentTimeMs,
  fallbackLineIndex = 0,
  bottomInset,
  expandedHeight,
  header,
  headerHeight = 0,
  zIndex = Layers.currentPlayingWordsSheet,
}: CurrentPlayingWordsSheetProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<WordPage>>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const sheetBottomInset = bottomInset ?? insets.bottom;
  const pageWidth = Math.max(280, screenWidth - 44);
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
      const wordIndexes = getLineWordIndexes(lineWordIndexes, line.index);
      return {
        key: String(line.index),
        line,
        words: sortWordsByAppearanceOrder(wordIndexes.map(wordIndex => words[wordIndex]).filter(Boolean)),
      };
    });
  }, [lines, words, lineWordIndexes]);

  const activePageIndex = useMemo(() => {
    if (pages.length === 0) return 0;
    return Math.min(Math.max(currentLineIndex, 0), pages.length - 1);
  }, [currentLineIndex, pages.length]);

  useEffect(() => {
    if (pages.length === 0) return;
    listRef.current?.scrollToIndex({
      index: activePageIndex,
      animated: true,
      viewPosition: 0,
    });
  }, [activePageIndex, pages.length]);

  const renderPage = useCallback(({ item }: ListRenderItemInfo<WordPage>) => (
    <CurrentWordsPageCard page={item} width={pageWidth} />
  ), [pageWidth]);

  const keyExtractor = useCallback((item: WordPage) => item.key, []);
  const handleScrollToIndexFailed = useCallback(() => {
    requestAnimationFrame(() => {
      if (pages.length === 0) return;
      listRef.current?.scrollToIndex({
        index: activePageIndex,
        animated: false,
        viewPosition: 0,
      });
    });
  }, [activePageIndex, pages.length]);

  return (
    <AppBottomSheet
      snapPoints={snapPoints}
      index={0}
      bottomInset={sheetBottomInset}
      enablePanDownToClose={false}
      enableDynamicSizing={false}
      enableOverDrag={false}
      backgroundStyle={styles.sheetBackground}
      handleComponent={null}
      containerStyle={[styles.sheetContainer, { zIndex, elevation: zIndex }]}
      style={[styles.sheet, { zIndex, elevation: zIndex }]}
    >
      <BottomSheetView style={styles.sheetContent}>
        {header ? (
          <View style={[styles.headerSlot, { height: headerHeight }]}>
            {header}
          </View>
        ) : null}

        <NativeViewGestureHandler disallowInterruption>
          <FlatList
            ref={listRef}
            data={pages}
            keyExtractor={keyExtractor}
            renderItem={renderPage}
            horizontal
            pagingEnabled={false}
            snapToInterval={pageWidth + 12}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={activePageIndex > 0 ? activePageIndex : undefined}
            getItemLayout={(_, index) => ({
              length: pageWidth + 12,
              offset: (pageWidth + 12) * index,
              index,
            })}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            style={styles.pagesPager}
            contentContainerStyle={styles.pagesContent}
            ItemSeparatorComponent={PageSeparator}
            removeClippedSubviews={false}
          />
        </NativeViewGestureHandler>
      </BottomSheetView>
    </AppBottomSheet>
  );
}

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
  },
  pagesContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 18,
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
    gap: 14,
    borderRadius: 12,
    paddingHorizontal: 16,
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
  translationText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  wordsScroll: {
    flex: 1,
  },
  wordsScrollContent: {
    paddingBottom: 18,
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
