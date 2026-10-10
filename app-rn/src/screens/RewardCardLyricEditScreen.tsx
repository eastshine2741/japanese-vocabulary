import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from '../navigation/AppNavigator';
import CardLyricEditor from '../components/rewardCards/CardLyricEditor';
import { SHOWROOM, useCardFonts } from '../components/rewardCards/cardTheme';
import { CardLyricLine } from '../components/rewardCards/types';
import { useRewardCardStore } from '../stores/rewardCardStore';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardCardLyricEdit'>;

const NO_LINES: CardLyricLine[] = [];

export default function RewardCardLyricEditScreen({ navigation, route }: Props) {
  const { cardId } = route.params;
  const card = useRewardCardStore((s) => s.songCards.find((c) => c.id === cardId));
  const setLyric = useRewardCardStore((s) => s.setLyric);
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const fonts = useCardFonts();
  const lines = useRewardCardStore((s) => s.lyricLines[cardId]) ?? NO_LINES;
  useEffect(() => {
    useRewardCardStore.getState().loadLyricLines(cardId);
  }, [cardId]);

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);
  const handleSave = useCallback(
    (picked: number[]) => {
      setLyric(cardId, picked);
      navigation.goBack();
    },
    [cardId, setLyric, navigation],
  );

  if (!card) {
    return <View style={styles.root} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <Pressable onPress={handleClose} hitSlop={10} style={styles.iconBtn}>
          <Feather name="x" size={20} color={SHOWROOM.fg} />
        </Pressable>
        <Text style={[styles.title, { fontFamily: fonts.jp }]} numberOfLines={1}>{card.title}</Text>
        <View style={styles.spacer} />
      </View>
      <CardLyricEditor
        card={card}
        lines={lines}
        fonts={fonts}
        previewWidth={Math.min(screenW * 0.34, 150)}
        ctaLabel="저장"
        requireChange
        onConfirm={handleSave}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  spacer: { width: 40 },
  title: { flex: 1, textAlign: 'center', color: SHOWROOM.fg, fontSize: 16, marginHorizontal: 12 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SHOWROOM.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
