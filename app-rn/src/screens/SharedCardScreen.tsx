import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from '../navigation/AppNavigator';
import { rewardCardApi } from '../api/rewardCardApi';
import { trackShareLinkOpen } from '../services/analytics';
import SharedCardStage, { sharedCardArtwork } from '../components/rewardCards/SharedCardStage';
import { CARD_RATIO, SHOWROOM } from '../components/rewardCards/cardTheme';
import type { SharedRewardCardDto } from '../types/rewardCard';

type Props = NativeStackScreenProps<RootStackParamList, 'SharedCard'>;

// 카드 아래 주인 줄과 위아래 버튼 자리.
const CHROME_HEIGHT = 240;

/** 공유 링크로 연 남의 카드. 보기만 한다. */
export default function SharedCardScreen({ navigation, route }: Props) {
  const { token } = route.params;
  const [shared, setShared] = useState<SharedRewardCardDto | null>(null);
  const [failed, setFailed] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cardW = Math.max(0, Math.min(screenW * 0.74, 340, (screenH - CHROME_HEIGHT) / CARD_RATIO));

  useEffect(() => {
    let cancelled = false;
    rewardCardApi
      .getSharedCard(token)
      .then((res) => {
        if (cancelled) return;
        setShared(res);
        trackShareLinkOpen(res.kind === 'SONG' ? 'song' : 'artist');
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);
  const songId = shared?.songCard?.songId ?? null;
  const artistId = shared?.artistCard?.artistId ?? null;
  const handleOpenTarget = useCallback(() => {
    if (songId != null) navigation.navigate('SongDetail', { songId, origin: 'CardShare' });
    else if (artistId != null) navigation.navigate('ArtistDetail', { artistId });
  }, [artistId, navigation, songId]);

  const artwork = shared ? sharedCardArtwork(shared) : null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {artwork ? <Image source={{ uri: artwork }} style={[StyleSheet.absoluteFill, styles.backdrop]} blurRadius={40} /> : null}
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
        </View>
        <View style={styles.stage}>
          {shared ? (
            <SharedCardStage shared={shared} width={cardW} />
          ) : failed ? (
            <Text style={styles.missingText}>카드를 찾을 수 없어요</Text>
          ) : (
            <ActivityIndicator color={SHOWROOM.fgDim} />
          )}
        </View>
        {shared && (
          <View style={styles.footer}>
            <Pressable onPress={handleOpenTarget} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
              <Text style={styles.ctaText}>{songId != null ? '곡 보기' : '아티스트 보기'}</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg },
  backdrop: { opacity: 0.55, transform: [{ scale: 1.3 }] },
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontSize: 14, color: SHOWROOM.fgDim },
  footer: { paddingHorizontal: 24, paddingBottom: 8 },
  cta: { height: 44, borderRadius: 14, backgroundColor: SHOWROOM.fg, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: SHOWROOM.bg, fontSize: 15, fontWeight: '700' },
});
