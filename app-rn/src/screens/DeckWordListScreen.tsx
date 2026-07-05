import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { useDeckWordListStore } from '../stores/deckWordListStore';
import { useWordExamplesStore, ExamplesState } from '../stores/wordExamplesStore';
import { convertReading, ReadingDisplay } from '../utils/readingConverter';
import { useSettingsStore } from '../stores/settingsStore';
import { Colors, Dimens } from '../theme/theme';
import { DeckWordItem } from '../types/deck';
import { wordApi } from '../api/wordApi';
import { PosBadge } from '../components/Badges';
import { AppBar } from '../components/AppBar';
import AppDialog from '../components/AppDialog';
import ErrorDialog from '../components/ErrorDialog';
import ArtworkImage from '../components/ArtworkImage';
import DeckWordActionSheet from '../components/DeckWordActionSheet';
import { AppBottomSheet, AppBottomSheetRef } from '../components/bottomSheet';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckWordList'>;

interface WordRowProps {
  item: DeckWordItem;
  isExpanded: boolean;
  readingDisplay: ReadingDisplay;
  isLast: boolean;
  onToggleExpand: (item: DeckWordItem) => void;
  onLongPress: (item: DeckWordItem) => void;
}

const WordRow = React.memo(function WordRow({
  item,
  isExpanded,
  readingDisplay,
  isLast,
  onToggleExpand,
  onLongPress,
}: WordRowProps) {
  // Subscribe only to this row's examples — when one row's fetch resolves,
  // other rows' selectors return the same reference and skip re-render.
  const examples = useWordExamplesStore(s => s.byId[item.id]);
  const pos = item.meanings[0]?.partOfSpeech;
  const handleToggle = useCallback(() => onToggleExpand(item), [onToggleExpand, item]);
  const handleLongPress = useCallback(() => onLongPress(item), [onLongPress, item]);

  return (
    <View>
      <TouchableOpacity
        style={styles.wordEntry}
        onPress={handleToggle}
        onLongPress={handleLongPress}
        delayLongPress={350}
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
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.textMuted}
        />
      </TouchableOpacity>
      {isExpanded && <ExampleSection state={examples} />}
      {!isLast && <View style={styles.separator} />}
    </View>
  );
});

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
  const fetchExamples = useWordExamplesStore(s => s.fetch);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionItem, setActionItem] = useState<DeckWordItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeckWordItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const actionSheetRef = useRef<AppBottomSheetRef>(null);
  // Imperative open-state tracking for the hardware back handler. Mirrors
  // PlayerScreen's pattern — a ref (not state) so it can be set
  // synchronously at expand()/close() call sites, closing the race window
  // before gorhom's onChange settles.
  const actionOpenRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      load(deckId);
    }, [deckId]),
  );

  // Android hardware back: close the action sheet first if it's open,
  // otherwise fall through to default (pop screen).
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (actionOpenRef.current) {
          actionOpenRef.current = false;
          actionSheetRef.current?.close();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

  const toggleExpand = useCallback((item: DeckWordItem) => {
    setExpandedId(prev => (prev === item.id ? null : item.id));
  }, []);

  // Fetch examples when a new id is expanded. Store handles dedup so this
  // is safe to call without checking the cache first.
  useEffect(() => {
    if (expandedId != null) fetchExamples(expandedId);
  }, [expandedId, fetchExamples]);

  const handleLongPress = useCallback((item: DeckWordItem) => {
    setActionItem(item);
    actionOpenRef.current = true;
    actionSheetRef.current?.expand();
  }, []);

  const handleActionSheetChange = useCallback((index: number) => {
    actionOpenRef.current = index >= 0;
    if (index < 0) setActionItem(null);
  }, []);

  const handleEditFromSheet = useCallback(() => {
    if (!actionItem) return;
    const item = actionItem;
    actionOpenRef.current = false;
    actionSheetRef.current?.close();
    navigation.navigate('EditWord', {
      mode: 'edit',
      wordId: item.id,
      japanese: item.japanese,
      reading: item.reading,
      meanings: item.meanings,
    });
  }, [actionItem, navigation]);

  const handleDeleteFromSheet = useCallback(() => {
    if (!actionItem) return;
    const item = actionItem;
    actionOpenRef.current = false;
    actionSheetRef.current?.close();
    setPendingDelete(item);
  }, [actionItem]);

  const runDelete = useCallback(async () => {
    const item = pendingDelete;
    setPendingDelete(null);
    if (!item) return;
    try {
      await wordApi.deleteWord(item.id);
      load(deckId);
    } catch {
      setDeleteError('잠시 후 다시 시도해주세요.');
    }
  }, [pendingDelete, deckId, load]);

  const renderItem = useCallback(
    ({ item, index }: { item: DeckWordItem; index: number }) => (
      <WordRow
        item={item}
        isExpanded={expandedId === item.id}
        readingDisplay={readingDisplay}
        isLast={index === words.length - 1}
        onToggleExpand={toggleExpand}
        onLongPress={handleLongPress}
      />
    ),
    [expandedId, readingDisplay, words.length, toggleExpand, handleLongPress],
  );

  const keyExtractor = useCallback((item: DeckWordItem) => String(item.id), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <AppBar title="단어" onBack={() => navigation.goBack()} />
        <View style={styles.headerSeparator} />

        {status === 'loading' ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.center} />
        ) : (
          <FlatList
            data={words}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onEndReached={() => loadMore(deckId)}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoadingMore ? <ActivityIndicator color={Colors.primary} style={{ padding: 16 }} /> : null
            }
            contentContainerStyle={styles.list}
            initialNumToRender={12}
            maxToRenderPerBatch={6}
            windowSize={7}
          />
        )}
      </View>

      <AppBottomSheet
        ref={actionSheetRef}
        variant="floating"
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        onChange={handleActionSheetChange}
      >
        <BottomSheetView>
          {actionItem && (
            <DeckWordActionSheet
              item={actionItem}
              onEdit={handleEditFromSheet}
              onDelete={handleDeleteFromSheet}
            />
          )}
        </BottomSheetView>
      </AppBottomSheet>

      <AppDialog
        visible={pendingDelete !== null}
        title="단어를 삭제할까요?"
        body={'단어와 학습 진행도가\n함께 삭제돼요.'}
        buttons={[
          { label: '취소', variant: 'secondary', onPress: () => setPendingDelete(null) },
          { label: '삭제', variant: 'danger', onPress: runDelete },
        ]}
      />

      <ErrorDialog message={deleteError} onDismiss={() => setDeleteError(null)} />
    </SafeAreaView>
  );
}

function ExampleSection({ state }: { state: ExamplesState | undefined }) {
  if (state === 'loading' || state === undefined) {
    return (
      <View style={styles.exSection}>
        <ActivityIndicator size="small" color={Colors.textMuted} />
      </View>
    );
  }
  if (state === 'error') {
    return (
      <View style={styles.exSection}>
        <Text style={styles.exEmpty}>예문을 불러올 수 없어요</Text>
      </View>
    );
  }
  if (state.length === 0) {
    return (
      <View style={styles.exSection}>
        <Text style={styles.exEmpty}>예문이 없어요</Text>
      </View>
    );
  }
  return (
    <View style={styles.exSection}>
      {state.map((ex) => (
        <View key={ex.id} style={styles.exRow}>
          <ArtworkImage url={ex.artworkUrl} size={28} cornerRadius={6} />
          <View style={styles.exText}>
            {ex.lyricLine && <Text style={styles.exJp}>{ex.lyricLine}</Text>}
            {ex.koreanLyricLine && <Text style={styles.exKr}>{ex.koreanLyricLine}</Text>}
            {ex.songTitle && <Text style={styles.exSrc}>{ex.songTitle}</Text>}
          </View>
        </View>
      ))}
    </View>
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
    paddingBottom: 20,
  },
  wordEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: Dimens.screenPadding,
    backgroundColor: Colors.background,
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
  exSection: {
    paddingHorizontal: Dimens.screenPadding,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    gap: 10,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exText: {
    flex: 1,
    gap: 3,
  },
  exJp: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  exKr: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  exSrc: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  exEmpty: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
