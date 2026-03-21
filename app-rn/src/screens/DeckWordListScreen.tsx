import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDeckWordListStore } from '../stores/deckWordListStore';
import AppTopBar from '../components/AppTopBar';
import { Colors, Dimens } from '../theme/theme';
import { DeckWordItem } from '../types/deck';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckWordList'>;

export default function DeckWordListScreen({ route, navigation }: Props) {
  const { songId } = route.params;
  const { status, words, isLoadingMore, load, loadMore } = useDeckWordListStore();

  useEffect(() => {
    load(songId);
  }, [songId]);

  const renderWord = ({ item }: { item: DeckWordItem }) => (
    <View style={styles.wordCard}>
      <View style={styles.wordRow}>
        <Text style={styles.japanese}>{item.japanese}</Text>
        <Text style={styles.reading}>{item.reading}</Text>
      </View>
      <Text style={styles.korean}>{item.koreanText}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppTopBar title="Words" onBack={() => navigation.goBack()} />
      {status === 'loading' ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.center} />
      ) : (
        <FlatList
          data={words}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderWord}
          onEndReached={() => loadMore(songId)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? <ActivityIndicator color={Colors.primary} style={{ padding: 16 }} /> : null
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center' },
  list: { padding: Dimens.screenPadding },
  wordCard: {
    backgroundColor: Colors.surface,
    borderRadius: Dimens.cardCornerRadius,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    marginBottom: 8,
  },
  wordRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  japanese: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  reading: { fontSize: 14, color: Colors.textSecondary },
  korean: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
});
