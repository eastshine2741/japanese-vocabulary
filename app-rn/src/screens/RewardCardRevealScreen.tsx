import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from '../navigation/AppNavigator';
import { RewardCardReveal } from '../components/rewardCards/RewardCardReveal';
import { SHOWROOM } from '../components/rewardCards/cardTheme';
import { useRewardCardStore } from '../stores/rewardCardStore';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardCardReveal'>;

/** 웹 등 transitionEnd 가 오지 않는 환경에서도 연출은 시작한다. */
const START_FALLBACK_MS = 600;

export default function RewardCardRevealScreen({ navigation, route }: Props) {
  const { cardId } = route.params;
  const card = useRewardCardStore((s) => s.songCards.find((c) => c.id === cardId));
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

  if (!card) {
    return <View style={styles.root} />;
  }

  return (
    <>
      <StatusBar style="light" />
      <RewardCardReveal card={card} started={started} onClose={handleClose} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg },
});
