import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const ITEM_HEIGHT = 20;
const VIEWPORT_HEIGHT = 38;
const COLUMN_TOP = (VIEWPORT_HEIGHT - ITEM_HEIGHT) / 2;
const HOLD_MS = 1600;
const SLIDE_MS = 420;
const NEIGHBOR_OPACITY = 0.2;

interface SongDetailDueWordRollerProps {
  /** 지금 due 인 단어 미리보기. 순서대로 순환한다. */
  words: readonly string[];
}

/** CTA 안에서 due 단어를 세로로 굴려 보여준다. 단어가 하나뿐이면 굴리지 않고 세워 둔다. */
export const SongDetailDueWordRoller = React.memo(function SongDetailDueWordRoller({
  words,
}: SongDetailDueWordRollerProps) {
  const offset = useRef(new Animated.Value(0)).current;
  const wordsKey = words.join('|');
  // 마지막에서 첫 단어로 이어 굴리려고 첫 단어를 한 번 더 붙인다.
  const loopWords = useMemo(
    () => (words.length > 1 ? [...words, words[0]] : [...words]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wordsKey],
  );
  const cycleLength = words.length;

  useEffect(() => {
    offset.setValue(0);
    if (cycleLength <= 1) return;

    let cancelled = false;
    const step = (from: number) => {
      if (cancelled) return;
      const to = from + 1;
      Animated.sequence([
        Animated.delay(HOLD_MS),
        Animated.timing(offset, {
          toValue: to,
          duration: SLIDE_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (cancelled || !finished) return;
        const next = to % cycleLength;
        if (next === 0) offset.setValue(0);
        step(next);
      });
    };
    step(0);

    return () => {
      cancelled = true;
      offset.stopAnimation();
    };
  }, [cycleLength, offset, wordsKey]);

  if (loopWords.length === 0) return null;

  const translateY = offset.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -ITEM_HEIGHT],
  });

  return (
    <View style={styles.viewport}>
      <Animated.View style={[styles.column, { transform: [{ translateY }] }]}>
        {loopWords.map((word, index) => (
          <RollerItem
            key={`${index}-${word}`}
            word={word}
            index={index}
            offset={offset}
            isStatic={cycleLength <= 1}
          />
        ))}
      </Animated.View>
    </View>
  );
});

interface RollerItemProps {
  word: string;
  index: number;
  offset: Animated.Value;
  isStatic: boolean;
}

const RollerItem = React.memo(function RollerItem({ word, index, offset, isStatic }: RollerItemProps) {
  const opacity = isStatic
    ? 1
    : offset.interpolate({
      inputRange: [index - 1, index, index + 1],
      outputRange: [NEIGHBOR_OPACITY, 1, NEIGHBOR_OPACITY],
      extrapolate: 'clamp',
    });

  return (
    <Animated.View style={[styles.item, { opacity }]}>
      <Text style={styles.word} numberOfLines={1}>{word}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  viewport: {
    width: 64,
    height: VIEWPORT_HEIGHT,
    overflow: 'hidden',
  },
  column: {
    position: 'absolute',
    top: COLUMN_TOP,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: ITEM_HEIGHT,
  },
});
