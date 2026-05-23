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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { useDeckWordListStore } from '../stores/deckWordListStore';
import { useDeckDetailStore } from '../stores/deckDetailStore';
import { convertReading } from '../utils/readingConverter';
import { useSettingsStore } from '../stores/settingsStore';
import { Colors, Dimens } from '../theme/theme';
import { DeckWordItem } from '../types/deck';
import { PosBadge } from '../components/Badges';
import { AppBar } from '../components/AppBar';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckWordList'>;

export default function DeckWordListScreen({ route, navigation }: Props) {
  const { deckId } = route.params;
  const readingDisplay = useSettingsStore(s => s.readingDisplay);
  const { status, words, isLoadingMore, load, loadMore } = useDeckWordListStore(
    useShallow(s => ({
      status: s.status,
      words: s.words,
      isLoadingMore: s.isLoadingMore,
      load: s.load,
      loadMore: s.loadMore,
    })),
  );
  const deckDetail = useDeckDetailStore((s) => s.data);
  const headerTitle = deckDetail?.title || 'Words';

  useFocusEffect(
    useCallback(() => {
      load(deckId);
    }, [deckId]),
  );

  const renderWord = ({ item, index }: { item: DeckWordItem; index: number }) => {
    const pos = item.meanings[0]?.partOfSpeech;
    return (
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
          <View style={styles.wordLeft}>
            <Text style={styles.japanese}>{item.japanese}</Text>
            <View style={styles.subRow}>
              <Text style={styles.reading}>{convertReading(item.reading, readingDisplay)}</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.korean} numberOfLines={1}>
                {item.meanings.map(m => m.text).join(', ')}
              </Text>
            </View>
          </View>
          {pos && <PosBadge pos={pos} />}
        </TouchableOpacity>
        {index < words.length - 1 && <View style={styles.separator} />}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <AppBar title={headerTitle} onBack={() => navigation.goBack()} />
        <View style={styles.headerSeparator} />

        {status === 'loading' ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.center} />
        ) : (
          <FlatList
            data={words}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderWord}
            onEndReached={() => loadMore(deckId)}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  wordLeft: {
    flex: 1,
    gap: 2,
  },
  japanese: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reading: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  dot: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  korean: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
