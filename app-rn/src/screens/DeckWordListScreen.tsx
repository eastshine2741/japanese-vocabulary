import React, { useCallback, useEffect, useState } from 'react';
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { useDeckWordListStore } from '../stores/deckWordListStore';
import { useDeckDetailStore } from '../stores/deckDetailStore';
import { convertReading } from '../utils/readingConverter';
import { useSettingsStore } from '../stores/settingsStore';
import { Colors, Dimens } from '../theme/theme';
import { DeckWordItem } from '../types/deck';
import { ExampleSentence } from '../types/word';
import { wordApi } from '../api/wordApi';
import { PosBadge } from '../components/Badges';
import { AppBar } from '../components/AppBar';
import AppDialog from '../components/AppDialog';
import ErrorDialog from '../components/ErrorDialog';
import ArtworkImage from '../components/ArtworkImage';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckWordList'>;

type ExamplesState = ExampleSentence[] | 'loading' | 'error';

const SWIPE_BTN_WIDTH = 72;
const SWIPE_ACTIONS_WIDTH = SWIPE_BTN_WIDTH * 2;
const SNAP_DURATION = 200;
const VELOCITY_THRESHOLD = 500;

function SwipeableRow({
  isOpen,
  onWillOpen,
  onClose,
  children,
  actions,
}: {
  isOpen: boolean;
  onWillOpen: () => void;
  onClose: () => void;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(isOpen ? -SWIPE_ACTIONS_WIDTH : 0, { duration: SNAP_DURATION });
  }, [isOpen, translateX]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const x = startX.value + e.translationX;
      translateX.value = Math.max(-SWIPE_ACTIONS_WIDTH, Math.min(0, x));
    })
    .onEnd((e) => {
      const shouldOpen =
        translateX.value < -SWIPE_ACTIONS_WIDTH / 2 || e.velocityX < -VELOCITY_THRESHOLD;
      if (shouldOpen) {
        translateX.value = withTiming(-SWIPE_ACTIONS_WIDTH, { duration: SNAP_DURATION });
        runOnJS(onWillOpen)();
      } else {
        translateX.value = withTiming(0, { duration: SNAP_DURATION });
        runOnJS(onClose)();
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.swipeClip}>
      <GestureDetector gesture={pan}>
        <Reanimated.View style={animatedStyle}>
          {children}
          <View style={styles.swipeActions}>{actions}</View>
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

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

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [examplesById, setExamplesById] = useState<Record<number, ExamplesState>>({});
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeckWordItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      load(deckId);
    }, [deckId]),
  );

  const toggleExpand = useCallback(async (item: DeckWordItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    if (examplesById[item.id] === undefined) {
      setExamplesById(prev => ({ ...prev, [item.id]: 'loading' }));
      try {
        const detail = await wordApi.getById(item.id);
        setExamplesById(prev => ({ ...prev, [item.id]: detail?.examples ?? [] }));
      } catch {
        setExamplesById(prev => ({ ...prev, [item.id]: 'error' }));
      }
    }
  }, [expandedId, examplesById]);

  const goEdit = useCallback((item: DeckWordItem) => {
    setOpenSwipeId(null);
    navigation.navigate('EditWord', {
      mode: 'edit',
      wordId: item.id,
      japanese: item.japanese,
      reading: item.reading,
      meanings: item.meanings,
    });
  }, [navigation]);

  const confirmDelete = useCallback((item: DeckWordItem) => {
    setPendingDelete(item);
  }, []);

  const runDelete = useCallback(async () => {
    const item = pendingDelete;
    setPendingDelete(null);
    setOpenSwipeId(null);
    if (!item) return;
    try {
      await wordApi.deleteWord(item.id);
      load(deckId);
    } catch {
      setDeleteError('잠시 후 다시 시도해주세요.');
    }
  }, [pendingDelete, deckId, load]);

  const renderWord = ({ item, index }: { item: DeckWordItem; index: number }) => {
    const pos = item.meanings[0]?.partOfSpeech;
    const isExpanded = expandedId === item.id;
    const examples = examplesById[item.id];
    return (
      <View>
        <SwipeableRow
          isOpen={openSwipeId === item.id}
          onWillOpen={() => setOpenSwipeId(item.id)}
          onClose={() => {
            if (openSwipeId === item.id) setOpenSwipeId(null);
          }}
          actions={
            <>
              <TouchableOpacity style={[styles.swipeBtn, styles.swipeEdit]} onPress={() => goEdit(item)}>
                <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                <Text style={styles.swipeLabel}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.swipeBtn, styles.swipeDelete]} onPress={() => confirmDelete(item)}>
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.swipeLabel}>삭제</Text>
              </TouchableOpacity>
            </>
          }
        >
          <TouchableOpacity
            style={styles.wordEntry}
            onPress={() => toggleExpand(item)}
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
        </SwipeableRow>
        {isExpanded && <ExampleSection state={examples} />}
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
  swipeClip: {
    overflow: 'hidden',
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
  swipeActions: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '100%',
    width: SWIPE_ACTIONS_WIDTH,
    flexDirection: 'row',
  },
  swipeBtn: {
    width: SWIPE_BTN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeEdit: {
    backgroundColor: Colors.textSecondary,
  },
  swipeDelete: {
    backgroundColor: Colors.ratingAgain,
  },
  swipeLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
