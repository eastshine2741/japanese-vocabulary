import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Token, StudyUnit } from '../types/song';
import { POS_INFO } from '../types/pos';
import { Colors } from '../theme/theme';

const NO_UNDERLINE_POS = new Set(['PARTICLE', 'AUXILIARY_VERB', 'SYMBOL', 'SUPPLEMENTARY_SYMBOL', 'WHITESPACE']);

function getUnderlineColor(pos: string): string | null {
  if (NO_UNDERLINE_POS.has(pos)) return null;
  return POS_INFO[pos]?.color ?? Colors.posNoun;
}

interface Props {
  studyUnit: StudyUnit;
  isActive: boolean;
  onTokenPress: (token: Token, lineText: string, koreanLyrics: string | null) => void;
}

export default function LyricLine({ studyUnit, isActive, onTokenPress }: Props) {
  const textStyle = isActive ? styles.tokenTextActive : styles.tokenTextInactive;

  const renderToken = (token: Token, ti: number) => {
    const underlineColor = getUnderlineColor(token.partOfSpeech);

    if (!underlineColor) {
      return <Text key={ti} style={textStyle}>{token.surface}</Text>;
    }

    return (
      <TouchableOpacity
        key={ti}
        onPress={() => onTokenPress(token, studyUnit.originalText, studyUnit.koreanLyrics ?? null)}
        activeOpacity={0.6}
      >
        <View style={styles.tokenWithUnderline}>
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
    <View style={styles.container}>
      <View style={styles.tokensRow}>{renderTokens()}</View>
      {studyUnit.koreanPronounciation && (
        <Text style={isActive ? styles.pronActive : styles.pronInactive}>
          {studyUnit.koreanPronounciation}
        </Text>
      )}
      {studyUnit.koreanLyrics && (
        <Text style={isActive ? styles.translationActive : styles.translationInactive}>
          {studyUnit.koreanLyrics}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    gap: 4,
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
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
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
