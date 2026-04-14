import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated, StyleSheet } from 'react-native';
import { Token, StudyUnit } from '../types/song';
import { POS_INFO } from '../types/pos';
import { Colors } from '../theme/theme';
import { useSettingsStore } from '../stores/settingsStore';
import { katakanaToHiragana } from '../utils/readingConverter';

const NO_UNDERLINE_POS = new Set(['SYMBOL', 'SUPPLEMENTARY_SYMBOL', 'WHITESPACE']);

const KANJI_RE = /[\u4e00-\u9fff]/;

function getUnderlineColor(pos: string): string | null {
  if (NO_UNDERLINE_POS.has(pos)) return null;
  return POS_INFO[pos]?.color ?? Colors.posNoun;
}

interface Props {
  studyUnit: StudyUnit;
  isActive: boolean;
  onTokenPress: (token: Token, lineText: string, koreanLyrics: string | null) => void;
  onLineSeek?: (ms: number) => void;
}

function LyricLine({ studyUnit, isActive, onTokenPress, onLineSeek }: Props) {
  const showKoreanPronunciation = useSettingsStore(s => s.showKoreanPronunciation);
  const showFurigana = useSettingsStore(s => s.showFurigana);
  const textStyle = isActive ? styles.tokenTextActive : styles.tokenTextInactive;
  const furiganaStyle = isActive ? styles.furiganaActive : styles.furiganaInactive;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  const canSeek = onLineSeek != null && studyUnit.startTimeMs != null;

  const handleLinePress = useCallback(() => {
    if (!onLineSeek || studyUnit.startTimeMs == null) return;
    flashOpacity.setValue(0.10);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
    onLineSeek(studyUnit.startTimeMs);
  }, [onLineSeek, studyUnit.startTimeMs, flashOpacity]);

  const needsFurigana = (token: Token) =>
    showFurigana && token.reading && KANJI_RE.test(token.surface);

  const renderToken = (token: Token, ti: number) => {
    const underlineColor = getUnderlineColor(token.partOfSpeech);
    const furigana = needsFurigana(token) ? katakanaToHiragana(token.reading!) : null;

    if (!underlineColor) {
      if (furigana) {
        return (
          <View key={ti} style={styles.furiganaWrapper}>
            <Text style={furiganaStyle}>{furigana}</Text>
            <Text style={textStyle}>{token.surface}</Text>
          </View>
        );
      }
      return <Text key={ti} style={textStyle}>{token.surface}</Text>;
    }

    return (
      <TouchableOpacity
        key={ti}
        onPress={() => onTokenPress(token, studyUnit.originalText, studyUnit.koreanLyrics ?? null)}
        activeOpacity={0.6}
      >
        <View style={styles.tokenWithUnderline}>
          {furigana && <Text style={furiganaStyle}>{furigana}</Text>}
          <Text style={textStyle}>{token.surface}</Text>
          <View style={[styles.underline, { backgroundColor: underlineColor, opacity: isActive ? 1 : 0.35 }]} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderTokens = () => {
    if (studyUnit.tokens.length === 0) {
      return <Text style={textStyle}>{studyUnit.originalText}</Text>;
    }

    const elements: React.ReactNode[] = [];
    let cursor = 0;

    studyUnit.tokens.forEach((token, ti) => {
      if (token.charStart > cursor) {
        elements.push(
          <Text key={`gap-${ti}`} style={textStyle}>
            {studyUnit.originalText.slice(cursor, token.charStart)}
          </Text>,
        );
      }
      elements.push(renderToken(token, ti));
      cursor = token.charEnd;
    });

    if (cursor < studyUnit.originalText.length) {
      elements.push(
        <Text key="tail" style={textStyle}>
          {studyUnit.originalText.slice(cursor)}
        </Text>,
      );
    }

    return elements;
  };

  return (
    <Pressable style={styles.container} onPress={canSeek ? handleLinePress : undefined} disabled={!canSeek}>
      {canSeek && (
        <Animated.View
          style={[styles.flashOverlay, { backgroundColor: Colors.textMuted, opacity: flashOpacity }]}
          pointerEvents="none"
        />
      )}
      <View style={styles.tokensRow}>{renderTokens()}</View>
      {showKoreanPronunciation && studyUnit.koreanPronounciation && (
        <Text style={isActive ? styles.pronActive : styles.pronInactive}>
          {studyUnit.koreanPronounciation}
        </Text>
      )}
      {studyUnit.koreanLyrics && (
        <Text style={isActive ? styles.translationActive : styles.translationInactive}>
          {studyUnit.koreanLyrics}
        </Text>
      )}
    </Pressable>
  );
}

export default React.memo(LyricLine);

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    gap: 4,
  },
  flashOverlay: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: -8,
    right: -8,
    borderRadius: 8,
  },
  tokensRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 3,
  },
  tokenTextActive: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  tokenTextInactive: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  tokenWithUnderline: {
    position: 'relative',
    alignItems: 'center',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  furiganaWrapper: {
    alignItems: 'center',
  },
  furiganaActive: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  furiganaInactive: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  pronActive: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pronInactive: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  translationActive: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  translationInactive: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
