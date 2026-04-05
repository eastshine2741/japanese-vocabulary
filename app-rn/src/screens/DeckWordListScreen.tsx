import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useDeckWordListStore } from '../stores/deckWordListStore';
import { useDeckDetailStore } from '../stores/deckDetailStore';
import { Colors, Dimens } from '../theme/theme';
import { DeckWordItem } from '../types/deck';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckWordList'>;

export default function DeckWordListScreen({ route, navigation }: Props) {
  const { songId } = route.params;
  const { status, words, isLoadingMore, load, loadMore } = useDeckWordListStore();
  const deckDetail = useDeckDetailStore((s) => s.data);
  const headerTitle = deckDetail?.title || 'Words';

  useFocusEffect(
    useCallback(() => {
      load(songId);
    }, [songId]),
  );

  const renderWord = ({ item, index }: { item: DeckWordItem; index: number }) => (
    <View>
      <TouchableOpacity
        style={styles.wordEntry}
        onPress={() => navigation.navigate('EditWord', {
          mode: 'edit',
          wordId: item.id,
          japanese: item.japanese,
          reading: item.reading,
          meanings: item.meanings,
        })}
        activeOpacity={0.6}
      >
        <View style={styles.headingRow}>
          <Text style={styles.japanese}>{item.japanese}</Text>
          <Text style={styles.reading}>({item.reading})</Text>
        </View>
        <Text style={styles.korean}>{item.meanings.map(m => m.text).join(', ')}</Text>
      </TouchableOpacity>
      {index < words.length - 1 && <View style={styles.separator} />}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top bar: back chevron + centered title */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
          <View style={styles.topBarRight} />
        </View>
        <View style={styles.headerSeparator} />

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Dimens.screenPadding,
  },
  backButton: {
    width: 40,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  topBarRight: {
    width: 40,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: Colors.border,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: Dimens.screenPadding,
    paddingTop: 8,
    paddingBottom: 20,
  },
  wordEntry: {
    paddingVertical: 16,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  japanese: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  reading: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  korean: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
