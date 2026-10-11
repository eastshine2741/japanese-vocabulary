import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SharedCardStage, { sharedCardTitle } from '../components/rewardCards/SharedCardStage';
import { CARD_RATIO, SHOWROOM } from '../components/rewardCards/cardTheme';
import { readShareWebData, storeOf } from './shareWebData';

const MAX_CARD_W = 320;
// 카드 아래 주인 줄과 버튼들이 첫 화면에 같이 보이게 남기는 높이.
const CHROME_HEIGHT = 300;

/** share-web 빌드의 루트. 서버가 랜딩 HTML 에 실어 준 카드를 그리고 앱·스토어로 보낸다. */
export default function ShareWebApp() {
  const data = useMemo(readShareWebData, []);
  const { width, height } = useWindowDimensions();
  const cardW = Math.max(0, Math.min(width * 0.78, MAX_CARD_W, (height - CHROME_HEIGHT) / CARD_RATIO));
  const store = useMemo(() => storeOf(typeof navigator === 'undefined' ? '' : navigator.userAgent), []);

  const open = useCallback((url: string) => {
    window.location.href = url;
  }, []);
  const handleOpenApp = useCallback(() => data && open(data.appUrl), [data, open]);
  const handleIos = useCallback(() => data && open(data.iosAppStoreUrl), [data, open]);
  const handleAndroid = useCallback(() => data && open(data.androidPlayUrl), [data, open]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {data ? (
          <>
            <SharedCardStage shared={data.card} width={cardW} />
            <Text style={styles.title} numberOfLines={2}>
              {sharedCardTitle(data.card)}
            </Text>
            <View style={styles.actions}>
              <Pressable onPress={handleOpenApp} style={[styles.btn, styles.primary]}>
                <Text style={[styles.btnText, styles.primaryText]}>앱에서 열기</Text>
              </Pressable>
              <View style={styles.stores}>
                <Pressable onPress={handleIos} style={[styles.btn, styles.store, store === 'ios' && styles.mine]}>
                  <Text style={styles.btnText}>App Store</Text>
                </Pressable>
                <Pressable onPress={handleAndroid} style={[styles.btn, styles.store, store === 'android' && styles.mine]}>
                  <Text style={styles.btnText}>Google Play</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.title}>카드를 찾을 수 없어요</Text>
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 32, gap: 20 },
  title: { color: SHOWROOM.fg, fontSize: 18, fontWeight: '700', textAlign: 'center', maxWidth: 360 },
  actions: { width: '100%', maxWidth: 360, gap: 10 },
  btn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: SHOWROOM.glass },
  btnText: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '600' },
  primary: { backgroundColor: SHOWROOM.fg },
  primaryText: { color: SHOWROOM.bg, fontWeight: '700' },
  stores: { flexDirection: 'row', gap: 10 },
  store: { flex: 1 },
  mine: { borderWidth: 1, borderColor: SHOWROOM.fgDim },
});
