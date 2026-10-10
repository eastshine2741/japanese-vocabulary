import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors } from '../theme/theme';
import { AppBar } from '../components/AppBar';
import ArtistCardThumb from '../components/rewardCards/ArtistCardThumb';
import { sortArtistCards } from '../components/rewardCards/artistGrade';
import { useCardFonts } from '../components/rewardCards/cardTheme';
import { DUMMY_ARTIST_CARDS } from '../components/rewardCards/dummyRewardCards';
import { ArtistRewardCard } from '../components/rewardCards/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ArtistCardList'>;

const SIDE_PADDING = 24;

export default function ArtistCardListScreen({ navigation, route }: Props) {
  const { ownerName } = route.params;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const fonts = useCardFonts();
  const cards = useMemo(() => sortArtistCards(DUMMY_ARTIST_CARDS), []);
  const cardWidth = screenWidth - SIDE_PADDING * 2;

  const handlePressCard = useCallback((card: ArtistRewardCard) => {
    navigation.navigate('ArtistCardDetail', { cardId: card.id, ownerName });
  }, [navigation, ownerName]);

  const renderItem = useCallback(
    ({ item }: { item: ArtistRewardCard }) => (
      <ArtistCardThumb card={item} width={cardWidth} fonts={fonts} onPress={handlePressCard} />
    ),
    [cardWidth, fonts, handlePressCard],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppBar
        title="아티스트 카드"
        onBack={navigation.goBack}
        trailing={<Text style={styles.navCount}>{cards.length}장</Text>}
      />
      <FlatList
        data={cards}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={CardGap}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
      />
    </SafeAreaView>
  );
}

function keyExtractor(card: ArtistRewardCard) {
  return card.id;
}

function CardGap() {
  return <View style={styles.cardGap} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  navCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
    paddingRight: 16,
  },
  list: { paddingHorizontal: SIDE_PADDING, paddingTop: 8 },
  cardGap: { height: 20 },
});
