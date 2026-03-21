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
  const renderButton = () => {
    if (addStatus === 'success') {
      return (
        <View style={[styles.button, styles.buttonDisabled]}>
          <Text style={styles.buttonText}>Added</Text>
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
    if (getWordStatus === 'found') {
      return (
        <TouchableOpacity style={styles.button} onPress={onAddWord} activeOpacity={0.7}>
          <Text style={styles.buttonText}>Add example</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={styles.button} onPress={onAddWord} activeOpacity={0.7}>
        <Text style={styles.buttonText}>Add to My Vocabulary</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.surface}>{token.surface}</Text>
        {token.reading && <Text style={styles.reading}>{token.reading}</Text>}
        <PosBadge pos={token.partOfSpeech} />
      </View>

      {getWordStatus === 'found' && existingWord && (
        <View style={styles.existingSection}>
          <Text style={styles.sectionLabel}>Saved examples</Text>
          {existingWord.examples.map((ex, i) => (
            <Text key={i} style={styles.exampleText}>
              {ex.lyricLine} — {ex.songTitle}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      {lookupStatus === 'loading' && (
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      )}
      {lookupStatus === 'error' && (
        <Text style={styles.errorText}>{lookupError || 'Lookup failed'}</Text>
      )}
      {lookupStatus === 'success' && definition && (
        <View style={styles.resultSection}>
          <View style={styles.badgeRow}>
            <JlptBadge level={definition.jlptLevel} />
            {definition.partsOfSpeech.map((p, i) => (
              <PosBadge key={i} pos={p} />
            ))}
          </View>
          <Text style={styles.meanings}>{definition.meanings.join(', ')}</Text>
          {renderButton()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  surface: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  reading: { fontSize: 16, color: Colors.textSecondary },
  existingSection: { marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  exampleText: { fontSize: 13, color: Colors.textTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 12 },
  loader: { marginVertical: 20 },
  errorText: { color: Colors.ratingAgain, textAlign: 'center', marginVertical: 12 },
  resultSection: { gap: 12 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  meanings: { fontSize: 16, color: Colors.textPrimary, lineHeight: 22 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { backgroundColor: Colors.textTertiary },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});
