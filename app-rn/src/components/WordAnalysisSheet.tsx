import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Token } from '../types/song';
import { WordDefinitionDTO, WordDetailResponse } from '../types/word';
import { JlptBadge, PosBadge } from './Badges';
import { Colors, Dimens } from '../theme/theme';

interface Props {
  token: Token;
  lookupStatus: string;
  definition: WordDefinitionDTO | null;
  lookupError: string | null;
  addStatus: string;
  getWordStatus: string;
  existingWord: WordDetailResponse | null;
  songId: number;
  lyricLine: string;
  onAddWord: () => void;
}

export default function WordAnalysisSheet({
  token,
  lookupStatus,
  definition,
  lookupError,
  addStatus,
  getWordStatus,
  existingWord,
  songId,
  lyricLine,
  onAddWord,
}: Props) {
  const isExisting = getWordStatus === 'found';

  const renderButton = () => {
    if (addStatus === 'success') {
      return (
        <View style={[styles.button, styles.buttonSuccess]}>
          <Text style={styles.buttonText}>추가 완료</Text>
        </View>
      );
    }
    if (addStatus === 'loading') {
      return (
        <View style={[styles.button, styles.buttonDisabled]}>
          <ActivityIndicator color="#FFF" size="small" />
        </View>
      );
    }
    if (isExisting) {
      return (
        <TouchableOpacity style={styles.button} onPress={onAddWord} activeOpacity={0.7}>
          <Text style={styles.buttonText}>+ 예문 담기</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={styles.button} onPress={onAddWord} activeOpacity={0.7}>
        <Text style={styles.buttonText}>+ 단어 담기</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Word header */}
      <View style={styles.header}>
        <Text style={styles.surface}>{token.surface}</Text>
        {token.reading && <Text style={styles.reading}>{token.reading}</Text>}
      </View>

      {/* Badges row */}
      {lookupStatus === 'success' && definition && (
        <View style={styles.badgeRow}>
          {definition.partsOfSpeech.map((p, i) => (
            <PosBadge key={i} pos={p} />
          ))}
          <JlptBadge level={definition.jlptLevel} />
        </View>
      )}

      {/* Korean meaning */}
      {lookupStatus === 'success' && definition && (
        <Text style={styles.meanings}>{definition.meanings.join(', ')}</Text>
      )}

      {/* Existing examples */}
      {isExisting && existingWord && existingWord.examples.length > 0 && (
        <View style={styles.existingSection}>
          <View style={styles.existingDivider} />
          {existingWord.examples.map((ex, i) => (
            <View key={i} style={styles.exampleItem}>
              <View style={styles.exampleContent}>
                {ex.lyricLine && (
                  <Text style={styles.exampleLyric}>{ex.lyricLine}</Text>
                )}
                {ex.songTitle && (
                  <Text style={styles.exampleSource}>
                    曲: {ex.songTitle}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Loading / Error states */}
      {lookupStatus === 'loading' && (
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      )}
      {lookupStatus === 'error' && (
        <Text style={styles.errorText}>{lookupError || 'Lookup failed'}</Text>
      )}

      {/* Action button */}
      {lookupStatus === 'success' && definition && renderButton()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  },
  surface: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  reading: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  meanings: {
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 24,
    marginBottom: 8,
  },
  existingSection: {
    marginTop: 4,
    marginBottom: 12,
  },
  existingDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  exampleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  exampleContent: {
    flex: 1,
  },
  exampleLyric: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  exampleSource: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  loader: {
    marginVertical: 20,
  },
  errorText: {
    color: Colors.ratingAgain,
    textAlign: 'center',
    marginVertical: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: Colors.textMuted,
  },
  buttonSuccess: {
    backgroundColor: Colors.ratingGood,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
