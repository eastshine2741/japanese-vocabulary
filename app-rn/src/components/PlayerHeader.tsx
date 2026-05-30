import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Marquee, MarqueeRef } from '@animatereactnative/marquee';
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

interface Props {
  title: string;
  artist: string;
  onOpenVocab: () => void;
  onOpenInfo: () => void;
  vocabEnabled: boolean;
}

const MARQUEE_SPEED = 0.2;
const MARQUEE_SPACING = 32;
const MARQUEE_PAUSE_MS = 3000;
const MARQUEE_FADE_WIDTH = 16;
const MARQUEE_FADE_COLOR = Colors.background;
const MARQUEE_FADE_TRANSPARENT = 'rgba(255,255,255,0)';

function MarqueeText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const [containerW, setContainerW] = useState(0);
  const [textW, setTextW] = useState(0);
  const overflow = containerW > 0 && textW > 0 && textW > containerW;

  const marqueeRef = useRef<MarqueeRef>(null);
  const position = useSharedValue(0);
  const cycleLen = textW + MARQUEE_SPACING;

  const pauseThenStart = () => {
    marqueeRef.current?.stop();
    const timer = setTimeout(() => marqueeRef.current?.start(), MARQUEE_PAUSE_MS);
    return () => clearTimeout(timer);
  };

  useEffect(() => {
    if (!overflow) return;
    return pauseThenStart();
  }, [overflow, text]);

  useAnimatedReaction(
    () => position.value,
    (cur, prev) => {
      'worklet';
      if (prev == null || cycleLen <= 0) return;
      if (Math.floor(cur / cycleLen) > Math.floor(prev / cycleLen)) {
        runOnJS(pauseThenStart)();
      }
    },
    [cycleLen],
  );

  const fadeStyle = useAnimatedStyle(() => {
    if (cycleLen <= 0) return { opacity: 0 };
    const offset = position.value % cycleLen;
    const dist = offset < cycleLen - offset ? offset : cycleLen - offset;
    const op = dist / MARQUEE_FADE_WIDTH;
    return { opacity: op < 0 ? 0 : op > 1 ? 1 : op };
  }, [cycleLen]);

  return (
    <View
      style={styles.marqueeClip}
      onLayout={(e: LayoutChangeEvent) => setContainerW(e.nativeEvent.layout.width)}
    >
      <View style={styles.marqueeMeasureBox} pointerEvents="none">
        <Text
          style={style}
          onLayout={(e: LayoutChangeEvent) => setTextW(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      </View>
      {overflow ? (
        <>
          <Marquee
            ref={marqueeRef}
            speed={MARQUEE_SPEED}
            spacing={MARQUEE_SPACING}
            position={position}
            withGesture={false}
          >
            <Text style={style}>{text}</Text>
          </Marquee>
          <Animated.View
            pointerEvents="none"
            style={[styles.marqueeFade, styles.marqueeFadeLeft, fadeStyle]}
          >
            <LinearGradient
              colors={[MARQUEE_FADE_COLOR, MARQUEE_FADE_TRANSPARENT]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.marqueeFade, styles.marqueeFadeRight, fadeStyle]}
          >
            <LinearGradient
              colors={[MARQUEE_FADE_TRANSPARENT, MARQUEE_FADE_COLOR]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </>
      ) : (
        <Text style={style} numberOfLines={1}>{text}</Text>
      )}
    </View>
  );
}

function PlayerHeader({ title, artist, onOpenVocab, onOpenInfo, vocabEnabled }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.songInfo}>
        <MarqueeText text={title} style={styles.title} />
        <Text style={styles.artist} numberOfLines={1}>{artist}</Text>
      </View>
      <TouchableOpacity
        style={styles.infoBtn}
        onPress={onOpenInfo}
        activeOpacity={0.7}
        hitSlop={8}
        accessibilityLabel="곡 정보"
      >
        <Feather name="info" size={18} color={Colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.chip, !vocabEnabled && styles.chipDisabled]}
        onPress={onOpenVocab}
        activeOpacity={0.7}
        disabled={!vocabEnabled}
        accessibilityState={{ disabled: !vocabEnabled }}
      >
        <Feather
          name="book-open"
          size={14}
          color={vocabEnabled ? Colors.textPrimary : Colors.textMuted}
        />
        <Text style={[styles.chipText, !vocabEnabled && styles.chipTextDisabled]}>단어장</Text>
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(PlayerHeader);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: Colors.background,
  },
  songInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  marqueeClip: {
    overflow: 'hidden',
  },
  marqueeMeasureBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10000,
    opacity: 0,
    alignItems: 'flex-start',
  },
  marqueeFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: MARQUEE_FADE_WIDTH,
  },
  marqueeFadeLeft: {
    left: 0,
  },
  marqueeFadeRight: {
    right: 0,
  },
  infoBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  artist: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: Colors.card,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  chipTextDisabled: {
    color: Colors.textMuted,
  },
});
