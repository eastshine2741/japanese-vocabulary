import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { RootStackParamList } from '../navigation/AppNavigator';
import SongCardShowcase from '../components/rewardCards/SongCardShowcase';
import LevelPips from '../components/rewardCards/LevelPips';
import { CARD_RATIO, LEVEL_MATERIAL, MASTER_CHIP, SHOWROOM, useCardFonts } from '../components/rewardCards/cardTheme';
import { songCardPreview } from '../components/rewardCards/cardPreview';
import { useCardTilt } from '../components/rewardCards/useCardTilt';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardCardPreview'>;

// 기울이면 원근 때문에 카드가 테 밖으로 조금 나온다.
const STAGE_INSET = 16;
const PREVIEW_ACCENT = '#C9C3D6';

/**
 * 곡 상세 단계의 '완료 시 보상'에서 여는 견본 전시. 카드 그래픽·가사·뒷면은 상세와 똑같이 보여 주고,
 * 내 카드가 아니라는 건 카드 밖(견본 표시·편집 없음·획득 조건)과 주인 정보 자리(SAMPLE·빈 서명·순번 없음)로만 알린다.
 */
export default function RewardCardPreviewScreen({ navigation, route }: Props) {
  const { song, level, mastered, condition, reached } = route.params;
  const card = useMemo(() => songCardPreview(song, level, mastered), [song, level, mastered]);
  const { width: screenW } = useWindowDimensions();
  const fonts = useCardFonts();
  const tilt = useCardTilt();

  const enter = useSharedValue(0);
  const info = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, { damping: 14, stiffness: 110, mass: 0.9 });
    info.value = withDelay(220, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, [enter, info]);

  const cardIn = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.6),
    transform: [{ translateY: (1 - enter.value) * 40 }, { scale: 0.86 + enter.value * 0.14 }],
  }));
  const infoIn = useAnimatedStyle(() => ({ opacity: info.value, transform: [{ translateY: (1 - info.value) * 12 }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: enter.value * 0.9,
    transform: [{ translateX: tilt.x.value * 14 }, { translateY: tilt.y.value * 10 }],
  }));

  const [stageHeight, setStageHeight] = useState(0);
  const handleStageLayout = useCallback((e: LayoutChangeEvent) => setStageHeight(e.nativeEvent.layout.height), []);
  const cardW = stageHeight === 0 ? 0 : Math.min(screenW * 0.74, 340, Math.max(0, stageHeight - STAGE_INSET * 2) / CARD_RATIO);

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);
  const handleFlip = useCallback(() => {
    tilt.flip.value = withTiming(tilt.flip.value > 0.5 ? 0 : 1, { duration: 720 });
  }, [tilt.flip]);

  const material = mastered ? MASTER_CHIP : LEVEL_MATERIAL[level];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {song.artworkUrl ? (
        <Image source={{ uri: song.artworkUrl }} style={[StyleSheet.absoluteFill, styles.backdrop]} blurRadius={40} />
      ) : null}
      <LinearGradient
        colors={[`${SHOWROOM.bg}99`, `${SHOWROOM.bg}D9`, SHOWROOM.bg]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={handleClose} hitSlop={10} style={styles.iconBtn}>
            <Feather name="chevron-down" size={22} color={SHOWROOM.fg} />
          </Pressable>
          <View style={styles.sampleBadge}>
            <Feather name="lock" size={12} color={SHOWROOM.fgDim} />
            <Text style={styles.sampleText}>견본</Text>
          </View>
          <Pressable onPress={handleFlip} hitSlop={10} style={styles.iconBtn}>
            <Feather name="refresh-ccw" size={18} color={SHOWROOM.fg} />
          </Pressable>
        </View>

        <View style={styles.stage} onLayout={handleStageLayout}>
          {cardW > 0 && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.glow,
                  { width: cardW * 0.9, height: cardW * 0.9 * CARD_RATIO, boxShadow: `0 0 120px 30px ${PREVIEW_ACCENT}59` },
                  glowStyle,
                ]}
              />
              <GestureDetector gesture={tilt.gesture}>
                <Animated.View style={cardIn}>
                  <SongCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} />
                </Animated.View>
              </GestureDetector>
            </>
          )}
        </View>

        <Animated.View style={[styles.info, infoIn]}>
          <View style={styles.chips}>
            <LinearGradient colors={material.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.levelChip}>
              <LevelPips level={level} color={material.chipText} size={5} />
              <Text style={[styles.levelText, { color: material.chipText }]}>{mastered ? '마스터' : `레벨 ${level}`}</Text>
            </LinearGradient>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelCaption}>획득 조건</Text>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>{condition}</Text>
              {reached && (
                <View style={styles.reached}>
                  <Feather name="check" size={12} color={SHOWROOM.fg} />
                  <Text style={styles.reachedText}>달성</Text>
                </View>
              )}
            </View>
          </View>

          <Pressable onPress={handleClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg },
  backdrop: { opacity: 0.55, transform: [{ scale: 1.3 }] },
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  sampleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#FFFFFF4D',
  },
  sampleText: { color: SHOWROOM.fgDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', borderRadius: 40 },
  info: { paddingHorizontal: 24, paddingBottom: 8, gap: 8 },
  chips: { flexDirection: 'row', justifyContent: 'center' },
  levelChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  levelText: { fontSize: 12, fontWeight: '700' },
  panel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#FFFFFF33',
    gap: 4,
  },
  panelCaption: { color: SHOWROOM.fgDim, fontSize: 11, fontWeight: '500' },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  panelTitle: { flex: 1, color: SHOWROOM.fg, fontSize: 13, fontWeight: '600' },
  reached: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reachedText: { color: SHOWROOM.fg, fontSize: 12, fontWeight: '700' },
  close: { height: 44, borderRadius: 14, backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
