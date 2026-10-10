import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SongCardFront } from './SongCardShowcase';
import { CardFonts, SHOWROOM } from './cardTheme';
import { MAX_LYRIC_LINES, pickLines, samePick, toggleLine } from './cardLyric';
import { CardLyricLine, SongRewardCard } from './types';

interface Props {
  card: SongRewardCard;
  /** 곡 가사 전체, 곡 순서대로. */
  lines: CardLyricLine[];
  fonts: CardFonts;
  previewWidth: number;
  ctaLabel: string;
  /** 처음 고른 그대로면 CTA 를 막는다 — 수정 화면용. */
  requireChange?: boolean;
  onConfirm: (picked: number[]) => void;
  bottomInset: number;
}

/** 카드 미리보기 + 가사 줄 목록. 고르는 대로 미리보기 앞면이 바뀐다. */
function CardLyricEditor({ card, lines, fonts, previewWidth, ctaLabel, requireChange, onConfirm, bottomInset }: Props) {
  const initial = useMemo(() => card.lyric.map((line) => line.index), [card.lyric]);
  const [picked, setPicked] = useState<number[]>(initial);

  const handleToggle = useCallback((index: number) => setPicked((prev) => toggleLine(prev, index)), []);
  const handleConfirm = useCallback(() => onConfirm(picked), [onConfirm, picked]);

  const preview = useMemo(() => ({ ...card, lyric: pickLines(lines, picked) }), [card, lines, picked]);
  const disabled = picked.length === 0 || (requireChange && samePick(picked, initial));

  return (
    <View style={styles.root}>
      <View style={styles.preview}>
        <View style={[styles.previewCard, { borderRadius: previewWidth * 0.046 }]}>
          <SongCardFront card={preview} width={previewWidth} fonts={fonts} />
        </View>
      </View>

      <View style={styles.head}>
        <Text style={styles.headTitle}>카드에 넣을 가사를 골라주세요</Text>
        <Text style={styles.headCount}>
          {picked.length}
          <Text style={styles.headMax}> / {MAX_LYRIC_LINES}</Text>
        </Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {lines.map((line) => (
          <LyricRow
            key={line.index}
            line={line}
            selected={picked.includes(line.index)}
            accent={card.accent}
            fonts={fonts}
            onToggle={handleToggle}
          />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]}>
        <Pressable
          onPress={handleConfirm}
          disabled={disabled}
          style={({ pressed }) => [styles.cta, disabled && styles.ctaDisabled, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default React.memo(CardLyricEditor);

interface RowProps {
  line: CardLyricLine;
  selected: boolean;
  accent: string;
  fonts: CardFonts;
  onToggle: (index: number) => void;
}

const LyricRow = React.memo(function LyricRow({ line, selected, accent, fonts, onToggle }: RowProps) {
  const handlePress = useCallback(() => onToggle(line.index), [onToggle, line.index]);
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        selected && { borderColor: accent, backgroundColor: `${accent}1F` },
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowText}>
        <View style={styles.rubyLine}>
          {line.ruby.map((seg, i) => (
            <View key={i} style={styles.rubySeg}>
              <Text style={styles.rubyTop}>{seg.reading ?? ' '}</Text>
              <Text style={[styles.rubyBase, { fontFamily: fonts.jp }]}>{seg.text}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.ko, { fontFamily: fonts.ko }]}>{line.ko}</Text>
      </View>
      <View style={[styles.check, selected && { backgroundColor: accent, borderColor: accent }]}>
        {selected && <Feather name="check" size={14} color={SHOWROOM.bg} />}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  preview: { alignItems: 'center', paddingVertical: 12 },
  previewCard: { boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)' },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headTitle: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '700' },
  headCount: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  headMax: { color: SHOWROOM.fgDim, fontWeight: '500' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: SHOWROOM.glass,
  },
  rowPressed: { opacity: 0.75 },
  rowText: { flex: 1, gap: 4 },
  rubyLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  rubySeg: { alignItems: 'center' },
  rubyTop: { color: SHOWROOM.fgDim, fontSize: 9, lineHeight: 12 },
  rubyBase: { color: SHOWROOM.fg, fontSize: 17, lineHeight: 22 },
  ko: { color: SHOWROOM.fgDim, fontSize: 13 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#FFFFFF40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  cta: {
    height: 52,
    borderRadius: 16,
    backgroundColor: SHOWROOM.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.35 },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: SHOWROOM.bg, fontSize: 16, fontWeight: '700' },
});
