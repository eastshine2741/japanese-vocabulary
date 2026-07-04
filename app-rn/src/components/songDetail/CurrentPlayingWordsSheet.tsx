import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/theme';
import ReadingText from '../ReadingText';
import { SONG_DETAIL_MV_BAR_HEIGHT } from './SongDetailMvBar';
import { getCurrentLyricLineIndex } from './useCurrentLyricLine';

export const CURRENT_PLAYING_WORDS_PEEK_HEIGHT = 70;

export interface CurrentPlayingLyricLine {
  index: number;
  originalText: string;
  startTimeMs: number | null;
  koreanLyrics: string | null;
  koreanPronounciation?: string | null;
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
  zIndex?: number;
}

interface PageCardProps {
  page: WordPage;
  width: number;
}

interface WordRowProps {
  word: CurrentPlayingWord;
}

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

function wordMeaning(word: CurrentPlayingWord): string {
  if (word.koreanText) return word.koreanText;
  return word.meanings?.map(meaning => meaning.text).filter(Boolean).join(', ') ?? '';
}

const CurrentWordRow = React.memo(function CurrentWordRow({ word }: WordRowProps) {
  const label = wordLabel(word);
  const reading = wordReading(word);
  const meaning = wordMeaning(word);

  return (
    <View style={styles.wordRow}>
      <View style={styles.wordTextCol}>
        <View style={styles.wordPrimaryLine}>
          <Text style={styles.wordJapanese} numberOfLines={1}>{label}</Text>
          {reading ? <ReadingText style={styles.wordReading} reading={reading} /> : null}
        </View>
        <Text style={styles.wordMeaning} numberOfLines={2}>{meaning || '뜻을 준비 중이에요'}</Text>
      </View>
      <View style={styles.addButton}>
        <Feather name="bookmark" size={16} color={Colors.primary} />
      </View>
    </View>
  );
});

const CurrentWordsPageCard = React.memo(function CurrentWordsPageCard({ page, width }: PageCardProps) {
  return (
    <View style={[styles.pageCard, { width }]}>
      <View style={styles.lyricBlock}>
        <Text style={styles.lyricText} numberOfLines={3}>{page.line.originalText}</Text>
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
            page.words.map(word => (
              <CurrentWordRow
                key={`${word.id ?? wordLabel(word)}-${wordReading(word) ?? ''}`}
                word={word}
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
  zIndex = 20,
}: CurrentPlayingWordsSheetProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<WordPage>>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const sheetBottomInset = bottomInset ?? insets.bottom + SONG_DETAIL_MV_BAR_HEIGHT;
  const pageWidth = Math.max(280, screenWidth - 44);
  const snapPoints = useMemo<(string | number)[]>(
    () => [
      CURRENT_PLAYING_WORDS_PEEK_HEIGHT,
      expandedHeight ?? Math.min(430, Math.max(320, screenHeight * 0.48)),
    ],
    [expandedHeight, screenHeight],
  );

  const currentLineIndex = useMemo(
    () => getCurrentLyricLineIndex(lines, currentTimeMs, fallbackLineIndex),
    [lines, currentTimeMs, fallbackLineIndex],
  );

  const pages = useMemo<WordPage[]>(() => {
    const currentIndex = currentLineIndex;
    if (currentIndex < 0) return [];
    const targetIndexes = [currentIndex - 1, currentIndex, currentIndex + 1]
      .filter(index => index >= 0 && index < lines.length);

    return targetIndexes.map(index => {
      const line = lines[index];
      const wordIndexes = getLineWordIndexes(lineWordIndexes, line.index);
      return {
        key: String(line.index),
        line,
        words: wordIndexes.map(wordIndex => words[wordIndex]).filter(Boolean),
      };
    });
  }, [lines, words, lineWordIndexes, currentLineIndex]);

  const activePageIndex = useMemo(() => {
    if (currentLineIndex < 0 || !lines[currentLineIndex]) return 0;
    return Math.max(0, pages.findIndex(page => page.line.index === lines[currentLineIndex].index));
  }, [currentLineIndex, lines, pages]);

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
    <BottomSheet
      snapPoints={snapPoints}
      index={0}
      bottomInset={sheetBottomInset}
      enablePanDownToClose={false}
      enableDynamicSizing={false}
      enableOverDrag={false}
      backgroundStyle={styles.sheetBackground}
      handleComponent={null}
      style={[styles.sheet, { zIndex, elevation: zIndex }]}
    >
      <BottomSheetView style={styles.sheetContent}>
        <View style={styles.header}>
          <View style={styles.dragBar} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>지금 들리는 단어</Text>
          </View>
        </View>

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
          contentContainerStyle={styles.pagesContent}
          ItemSeparatorComponent={PageSeparator}
          removeClippedSubviews={false}
        />
      </BottomSheetView>
    </BottomSheet>
  );
}

function PageSeparator() {
  return <View style={styles.pageSeparator} />;
}

export const CurrentPlayingWordsSheet = React.memo(CurrentPlayingWordsSheetComponent);

const styles = StyleSheet.create({
  sheet: {
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
  },
  header: {
    height: CURRENT_PLAYING_WORDS_PEEK_HEIGHT,
    alignItems: 'center',
    paddingTop: 12,
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D2D2D2',
  },
  titleRow: {
    width: '100%',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  title: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pagesContent: {
    paddingHorizontal: 22,
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
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.elevated,
  },
  lyricText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  translationText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
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
  wordRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  wordTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  wordPrimaryLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  wordJapanese: {
    maxWidth: '70%',
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  wordReading: {
    flexShrink: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  wordMeaning: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryBg,
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
