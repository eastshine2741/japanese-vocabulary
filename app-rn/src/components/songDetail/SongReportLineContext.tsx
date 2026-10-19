import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme/theme';
import type { CurrentPlayingLyricLine } from './CurrentPlayingWordsSheet';
import { buildTokenCells, type TokenCell } from './songLyricsDial';
import type { SongReportLineFocus } from './songReportForm';

interface SongReportLineContextProps {
  line: CurrentPlayingLyricLine;
  focus: SongReportLineFocus;
}

interface CellProps {
  cell: TokenCell;
  focus: SongReportLineFocus;
  showFurigana: boolean;
  showMeaning: boolean;
}

const Cell = React.memo(function Cell({ cell, focus, showFurigana, showMeaning }: CellProps) {
  const isToken = cell.key.startsWith('token-');
  return (
    <View style={[styles.cell, focus === 'SEGMENTS' && isToken && styles.segment]}>
      {showFurigana ? <Text style={styles.furigana} numberOfLines={1}>{cell.furigana ?? ' '}</Text> : null}
      <Text style={styles.cellText}>{cell.text}</Text>
      {showMeaning ? <Text style={styles.meaning}>{cell.meaning ?? ' '}</Text> : null}
    </View>
  );
});

/** 고른 문제 유형이 다루는 것(원문·발음·번역·단어 뜻·단어 나눔)만 가사 줄에 얹어 보여준다. */
function SongReportLineContext({ line, focus }: SongReportLineContextProps) {
  const cells = useMemo(
    () => (focus === 'READING' || focus === 'MEANING' || focus === 'SEGMENTS'
      ? buildTokenCells(line, [], { kanaReadings: focus === 'READING' })
      : []),
    [focus, line],
  );
  const showFurigana = focus === 'READING' && cells.some(cell => cell.furigana);
  const showMeaning = focus === 'MEANING' && cells.some(cell => cell.meaning);

  return (
    <View style={styles.container}>
      {cells.length > 0 ? (
        <View style={styles.cells}>
          {cells.map(cell => (
            <Cell
              key={cell.key}
              cell={cell}
              focus={focus}
              showFurigana={showFurigana}
              showMeaning={showMeaning}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.lyric}>{line.originalText}</Text>
      )}
      {focus === 'TRANSLATION' && line.koreanLyrics ? (
        <Text style={styles.translation}>{line.koreanLyrics}</Text>
      ) : null}
    </View>
  );
}

export default React.memo(SongReportLineContext);

const styles = StyleSheet.create({
  container: {
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
  },
  lyric: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  translation: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  cells: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: 2,
    rowGap: 6,
  },
  cell: {
    alignItems: 'center',
  },
  segment: {
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  furigana: {
    fontSize: 10,
    lineHeight: 12,
    color: Colors.primary,
  },
  cellText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  meaning: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.primary,
  },
});
