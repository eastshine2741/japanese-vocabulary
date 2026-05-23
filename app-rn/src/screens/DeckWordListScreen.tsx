import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  SharedValue,
  useAnimatedStyle,
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
import ArtworkImage from '../components/ArtworkImage';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckWordList'>;

type ExamplesState = ExampleSentence[] | 'loading' | 'error';

const SWIPE_BTN_WIDTH = 72;
const SWIPE_ACTIONS_WIDTH = SWIPE_BTN_WIDTH * 2;

function RightActions({
  progress,
  onEdit,
  onDelete,
}: {
  progress: SharedValue<number>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: SWIPE_ACTIONS_WIDTH * (1 - Math.min(progress.value, 1)) }],
  }));
  return (
    <Reanimated.View style={[styles.swipeActions, animatedStyle]}>
      <TouchableOpacity style={[styles.swipeBtn, styles.swipeEdit]} onPress={onEdit}>
        <Ionicons name="create-outline" size={20} color="#FFFFFF" />
        <Text style={styles.swipeLabel}>수정</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.swipeBtn, styles.swipeDelete]} onPress={onDelete}>
        <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        <Text style={styles.swipeLabel}>삭제</Text>
      </TouchableOpacity>
    </Reanimated.View>
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
  const swipeRefs = useRef<Map<number, React.RefObject<SwipeableMethods | null>>>(new Map());
  const openIdRef = useRef<number | null>(null);

  const getSwipeRef = (id: number) => {
    let ref = swipeRefs.current.get(id);
    if (!ref) {
      ref = React.createRef<SwipeableMethods | null>();
      swipeRefs.current.set(id, ref);
    }
    return ref;
  };

  const closeOpenSwipe = useCallback(() => {
    if (openIdRef.current !== null) {
      swipeRefs.current.get(openIdRef.current)?.current?.close();
      openIdRef.current = null;
    }
  }, []);

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
    closeOpenSwipe();
    navigation.navigate('EditWord', {
      mode: 'edit',
      wordId: item.id,
      japanese: item.japanese,
      reading: item.reading,
      meanings: item.meanings,
    });
  }, [navigation, closeOpenSwipe]);

  const confirmDelete = useCallback((item: DeckWordItem) => {
    Alert.alert(
      '단어를 삭제할까요?',
      `${item.japanese} 단어와 학습 진행도가 함께 삭제돼요.`,
      [
        { text: '취소', style: 'cancel', onPress: closeOpenSwipe },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            closeOpenSwipe();
            try {
              await wordApi.deleteWord(item.id);
              load(deckId);
            } catch {
              Alert.alert('삭제하지 못했어요', '잠시 후 다시 시도해주세요.');
            }
          },
        },
      ],
    );
  }, [deckId, load, closeOpenSwipe]);

  const renderRightActions = useCallback(
    (item: DeckWordItem) =>
      (progress: SharedValue<number>, _translation: SharedValue<number>) => (
        <RightActions
          progress={progress}
          onEdit={() => goEdit(item)}
          onDelete={() => confirmDelete(item)}
        />
      ),
    [goEdit, confirmDelete],
  );

  const renderWord = ({ item, index }: { item: DeckWordItem; index: number }) => {
    const pos = item.meanings[0]?.partOfSpeech;
    const isExpanded = expandedId === item.id;
    const examples = examplesById[item.id];
    return (
      <View>
        <ReanimatedSwipeable
          friction={2}
          rightThreshold={40}
          overshootLeft={false}
          overshootRight={false}
          ref={getSwipeRef(item.id)}
          renderRightActions={renderRightActions(item)}
          onSwipeableWillOpen={() => {
            if (openIdRef.current !== null && openIdRef.current !== item.id) {
              swipeRefs.current.get(openIdRef.current)?.current?.close();
            }
            openIdRef.current = item.id;
          }}
          onSwipeableClose={() => {
            if (openIdRef.current === item.id) openIdRef.current = null;
          }}
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
        </ReanimatedSwipeable>
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
    paddingTop: 8,
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
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
