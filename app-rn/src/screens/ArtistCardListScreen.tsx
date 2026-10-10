import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors } from '../theme/theme';
import { AppBar } from '../components/AppBar';
import ArtistCardThumb from '../components/rewardCards/ArtistCardThumb';
import {
  ARTIST_CARD_SORT_LABEL,
  ARTIST_CARD_SORT_ORDER,
  ArtistCardSort,
  sortArtistCards,
} from '../components/rewardCards/artistGrade';
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
  const [sort, setSort] = useState<ArtistCardSort>('level');
  const cards = useMemo(() => sortArtistCards(DUMMY_ARTIST_CARDS, sort), [sort]);
  const cardWidth = screenWidth - SIDE_PADDING * 2;

  const handleSort = useCallback(() => {
    setSort((prev) => ARTIST_CARD_SORT_ORDER[(ARTIST_CARD_SORT_ORDER.indexOf(prev) + 1) % ARTIST_CARD_SORT_ORDER.length]);
  }, []);

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
      <AppBar title="아티스트 카드" onBack={navigation.goBack} />
      <FlatList
        data={cards}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.listHead}>
            <Text style={styles.count}>{cards.length}장</Text>
            <Pressable onPress={handleSort} style={({ pressed }) => [styles.sortChip, pressed && styles.pressed]} hitSlop={6}>
              <Text style={styles.sortLabel}>{ARTIST_CARD_SORT_LABEL[sort]}</Text>
              <Feather name="chevron-down" size={14} color={Colors.textSecondary} />
            </Pressable>
          </View>
        }
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
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  count: { fontSize: 14, fontWeight: '500', color: Colors.textMuted, fontVariant: ['tabular-nums'] },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.elevated,
  },
  sortLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  pressed: { opacity: 0.6 },
  list: { paddingHorizontal: SIDE_PADDING, paddingTop: 8 },
  cardGap: { height: 20 },
});
