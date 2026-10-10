import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from '../navigation/AppNavigator';
import ArtistCardReveal from '../components/rewardCards/ArtistCardReveal';
import { RewardCardReveal } from '../components/rewardCards/RewardCardReveal';
import { SHOWROOM } from '../components/rewardCards/cardTheme';
import { useRewardCardStore } from '../stores/rewardCardStore';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardCardReveal'>;

/** 웹 등 transitionEnd 가 오지 않는 환경에서도 연출은 시작한다. */
const START_FALLBACK_MS = 600;

export default function RewardCardRevealScreen({ navigation, route }: Props) {
  const { kind, cardId } = route.params;
  const songCard = useRewardCardStore((s) => (kind === 'song' ? s.songCards.find((c) => c.id === cardId) : undefined));
  const artistCard = useRewardCardStore((s) => (kind === 'artist' ? s.artistCards.find((c) => c.id === cardId) : undefined));
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const begin = () => setStarted(true);
    const timer = setTimeout(begin, START_FALLBACK_MS);
    const unsubscribe = navigation.addListener('transitionEnd', (e) => {
      if (!e.data.closing) begin();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigation]);

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <>
      <StatusBar style="light" />
      {songCard ? (
        <RewardCardReveal card={songCard} started={started} onClose={handleClose} />
      ) : artistCard ? (
        <ArtistCardReveal card={artistCard} started={started} onClose={handleClose} />
      ) : (
        <View style={styles.root} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg },
});
