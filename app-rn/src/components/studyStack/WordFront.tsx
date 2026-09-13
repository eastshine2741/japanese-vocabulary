import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StudyCard } from './types';

export interface WordFrontProps {
  card: StudyCard;
  revealProgress?: Animated.Value;
  hideHeadword?: boolean;
  headwordRef?: React.Ref<View>;
  onHeadwordLayout?: () => void;
}

/** 앞면 wordLayer — headword + 탭 힌트. */
export const WordFront = React.memo(function WordFront({
  card,
  revealProgress,
  hideHeadword = false,
  headwordRef,
  onHeadwordLayout,
}: WordFrontProps) {
  const headwordStyle = revealProgress
    ? {
        opacity: revealProgress.interpolate({
          inputRange: [0, 0.72, 1],
          outputRange: [1, 1, 0],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            translateY: revealProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -92],
              extrapolate: 'clamp',
            }),
          },
          {
            scale: revealProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.69],
              extrapolate: 'clamp',
            }),
          },
        ],
      }
    : null;
  const hintStyle = revealProgress
    ? {
        opacity: revealProgress.interpolate({
          inputRange: [0, 0.28],
          outputRange: [1, 0],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            translateY: revealProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 10],
              extrapolate: 'clamp',
            }),
          },
        ],
      }
    : null;

  return (
    <View style={styles.wordFront}>
      <View style={styles.frontWordGroup}>
        <View ref={headwordRef} collapsable={false} onLayout={onHeadwordLayout}>
          <Animated.Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.frontHeadword, headwordStyle, hideHeadword && styles.hiddenHeadword]}
          >
            {card.japanese}
          </Animated.Text>
        </View>
      </View>
      <Animated.View style={[styles.tapHint, hintStyle]}>
        <MaterialIcons name="touch-app" size={16} color="rgba(255,255,255,0.85)" />
        <Text style={styles.tapHintText}>떠올린 후 탭해서 뜻 보기</Text>
      </Animated.View>
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
    alignItems: 'flex-start',
  },
  frontHeadword: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: 0,
    transformOrigin: 'left center',
  },
  hiddenHeadword: {
    opacity: 0,
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
