import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StudyCard } from './types';

export interface WordFrontProps {
  card: StudyCard;
}

/** 앞면 wordLayer — headword + 탭 힌트. */
export const WordFront = React.memo(function WordFront({ card }: WordFrontProps) {
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
});

const styles = StyleSheet.create({
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
});
