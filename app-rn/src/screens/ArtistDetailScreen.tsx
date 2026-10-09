import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Pressable,
  SectionListData,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ArtworkImage from '../components/ArtworkImage';
import ErrorDialog from '../components/ErrorDialog';
import RowSpinner from '../components/RowSpinner';
import { artistApi } from '../api/artistApi';
import { isAnalyzingSong, useAnalysisStore } from '../stores/analysisStore';
import { usePlayerStore } from '../stores/playerStore';
import { Colors, Dimens } from '../theme/theme';
import { Typography } from '../theme/typography';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getErrorMessage } from '../utils/errorMessages';
import { ArtistDetail, ArtistStudyingSong } from '../types/artist';
import { SongSearchItem } from '../types/song';

type Props = NativeStackScreenProps<RootStackParamList, 'ArtistDetail'>;
type Status = 'loading' | 'success' | 'error';

const HERO_HEIGHT = 300;
const COLLAPSED_BAR_HEIGHT = 56;
const PARALLAX_RATIO = 0.4;
const CHEVRON_SIZE = 18;

type ArtistRow =
  | { kind: 'studying'; song: ArtistStudyingSong }
  | { kind: 'popular'; song: SongSearchItem };

interface ArtistSection {
  key: 'studying' | 'popular';
  title: string;
  data: ArtistRow[];
}

function coveragePercent(song: ArtistStudyingSong): number {
  if (song.totalLines <= 0) return 0;
  return Math.round((song.knownLines / song.totalLines) * 100);
}

const StudyingRow = React.memo(function StudyingRow({
  song,
  onPress,
}: {
  song: ArtistStudyingSong;
  onPress: (songId: number) => void;
}) {
  const percent = coveragePercent(song);
  const handlePress = useCallback(() => onPress(song.songId), [onPress, song.songId]);

  return (
    <TouchableOpacity style={styles.row} onPress={handlePress} activeOpacity={0.72}>
      <ArtworkImage url={song.artworkUrl} size={48} cornerRadius={8} />
      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>{song.title}</Text>
          <Text style={styles.coverageValue}>{percent}%</Text>
        </View>
        <View style={styles.coverageTrack}>
          <View style={[styles.coverageKnown, { width: `${percent}%` }]} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={Colors.textMuted} />
    </TouchableOpacity>
  );
});

const PopularRow = React.memo(function PopularRow({
  song,
  onPress,
  disabled,
  isActiveRow,
}: {
  song: SongSearchItem;
  onPress: (song: SongSearchItem) => void;
  // 존재 확인이 도는 동안 모든 행을 막는다. 두 번째 탭이 첫 콜백과 경쟁하면 엉뚱한 곡으로 간다.
  disabled: boolean;
  isActiveRow: boolean;
}) {
  const handlePress = useCallback(() => onPress(song), [onPress, song]);
  // 존재 확인이 끝난 뒤에도 분석이 도는 동안 계속 돌아 pill 과 같은 상태를 보여준다.
  const isAnalyzing = useAnalysisStore(s => isAnalyzingSong(s.jobs, song.title, song.artistName));

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      activeOpacity={0.72}
      disabled={disabled}
    >
      <ArtworkImage url={song.thumbnail} size={48} cornerRadius={8} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>{song.title}</Text>
      </View>
      {isActiveRow || isAnalyzing ? (
        <RowSpinner />
      ) : (
        <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={Colors.textMuted} />
      )}
    </TouchableOpacity>
  );
});

const ArtistArtwork = React.memo(function ArtistArtwork({
  artworkUrl,
  translateY,
}: {
  artworkUrl: string | null;
  translateY: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <Animated.View style={[styles.heroPhotoFrame, { transform: [{ translateY }] }]}>
      {artworkUrl ? (
        <Image source={{ uri: artworkUrl }} style={styles.heroPhoto} resizeMode="cover" />
      ) : (
        <View style={[styles.heroPhoto, styles.heroPhotoFallback]} />
      )}
      <LinearGradient
        style={styles.heroScrim}
        colors={['#000000AA', '#00000000', '#000000CC']}
        locations={[0, 0.25, 1]}
      />
    </Animated.View>
  );
});

// 아트워크는 스크롤 밖 고정 배경이 그린다. 스크롤 안에서 역보정 이동시키면 onScroll 이 한 프레임 늦어 떨린다.
const ArtistHero = React.memo(function ArtistHero({
  artist,
  infoOpacity,
  onOpenAppleMusic,
}: {
  artist: ArtistDetail;
  infoOpacity: Animated.AnimatedInterpolation<number>;
  onOpenAppleMusic: () => void;
}) {
  return (
    <View style={styles.hero}>
      <Animated.View style={[styles.heroInfo, { opacity: infoOpacity }]}>
        <Text style={styles.heroName} numberOfLines={2}>{artist.name}</Text>
        {artist.appleMusicUrl ? (
          <Pressable style={styles.appleMusicLink} onPress={onOpenAppleMusic} hitSlop={6}>
            <Feather name="music" size={14} color="#FFFFFF" />
            <Text style={styles.appleMusicLabel}>Apple Music에서 보기</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
});

export default function ArtistDetailScreen({ navigation, route }: Props) {
  const { artistId } = route.params;
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [checkingItemId, setCheckingItemId] = useState<string | null>(null);

  const analyze = usePlayerStore(s => s.analyze);
  const playerStatus = usePlayerStore(s => s.status);
  const resetPlayer = usePlayerStore(s => s.reset);

  // 존재 확인과 분석 요청만 행을 막는다. 그 뒤로는 전역 pill 이 이어받는다.
  const isChecking = playerStatus === 'loading';

  // 곡을 보고 돌아오면 이해도와 분석 여부가 달라져 있으므로 포커스마다 다시 읽는다.
  const runIdRef = useRef(0);
  const load = useCallback(() => {
    const runId = ++runIdRef.current;
    setStatus(prev => (prev === 'success' ? prev : 'loading'));
    artistApi
      .getDetail(artistId)
      .then(data => {
        if (runIdRef.current !== runId) return;
        setArtist(data);
        setStatus('success');
      })
      .catch((e: any) => {
        if (runIdRef.current !== runId) return;
        setErrorCode(e.response?.data?.error ?? null);
        setStatus('error');
      });
  }, [artistId]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        runIdRef.current++;
      };
    }, [load]),
  );

  useEffect(() => {
    return () => {
      if (usePlayerStore.getState().status === 'loading') {
        resetPlayer();
      }
    };
  }, [resetPlayer]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  // 히어로 바닥이 앱바 바닥에 닿는 지점에서 접힘이 끝난다.
  const collapsedBarFullHeight = insets.top + COLLAPSED_BAR_HEIGHT;
  const collapseEnd = HERO_HEIGHT - collapsedBarFullHeight;
  const collapseStart = collapseEnd - 56;

  // 화면 기준 아트워크 위치. 앱바 배경도 같은 값을 써야 히어로와 이음매 없이 겹친다.
  const artworkTranslate = useMemo(
    () => scrollY.interpolate({
      inputRange: [0, collapseEnd],
      outputRange: [0, -collapseEnd * PARALLAX_RATIO],
      extrapolate: 'clamp',
    }),
    [scrollY, collapseEnd],
  );
  const heroInfoOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [collapseStart - 40, collapseStart + 16],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    [scrollY, collapseStart],
  );
  const appBarContentOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [collapseStart, collapseEnd],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [scrollY, collapseStart, collapseEnd],
  );
  const appBarContentTranslate = useMemo(
    () => scrollY.interpolate({
      inputRange: [collapseStart, collapseEnd],
      outputRange: [10, 0],
      extrapolate: 'clamp',
    }),
    [scrollY, collapseStart, collapseEnd],
  );
  const handleScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true },
    ),
    [scrollY],
  );

  const handleOpenAppleMusic = useCallback(() => {
    if (artist?.appleMusicUrl) Linking.openURL(artist.appleMusicUrl);
  }, [artist?.appleMusicUrl]);

  const handleStudyingPress = useCallback((songId: number) => {
    navigation.navigate('SongDetail', { songId, origin: 'artist_detail' });
  }, [navigation]);

  const handlePopularPress = useCallback((song: SongSearchItem) => {
    // `disabled` 가 퍼지기 전에 들어온 탭을 막는다.
    if (isChecking) return;
    setCheckingItemId(song.id);
    analyze(song).then(() => {
      const state = usePlayerStore.getState();
      if (state.status === 'success') {
        if (!navigation.isFocused()) return;
        navigation.navigate('SongDetail', { songId: state.studyData?.song.id, origin: 'artist_detail' });
      } else if (state.status === 'error') {
        setErrorDialogMessage(
          state.errorCode === 'LYRICS_NOT_FOUND'
            ? `${song.title}의 가사를 찾을 수 없었어요.`
            : getErrorMessage(state.errorCode),
        );
      }
    });
  }, [analyze, navigation, isChecking]);

  const sections = useMemo<ArtistSection[]>(() => {
    if (!artist) return [];
    const result: ArtistSection[] = [];
    if (artist.studyingSongs.length > 0) {
      result.push({
        key: 'studying',
        title: '곡별 진도',
        data: artist.studyingSongs.map(song => ({ kind: 'studying', song })),
      });
    }
    if (artist.popularSongs.length > 0) {
      result.push({
        key: 'popular',
        title: '인기곡',
        data: artist.popularSongs.map(song => ({ kind: 'popular', song })),
      });
    }
    return result;
  }, [artist]);

  const renderItem = useCallback(({ item }: { item: ArtistRow }) => {
    // 리스트 뒤에 아트워크가 깔려 있어 눌림 페이드가 배경을 비치지 않게 불투명 셀로 감싼다.
    return (
      <View style={styles.cell}>
        {item.kind === 'studying' ? (
          <StudyingRow song={item.song} onPress={handleStudyingPress} />
        ) : (
          <PopularRow
            song={item.song}
            onPress={handlePopularPress}
            disabled={isChecking}
            isActiveRow={isChecking && item.song.id === checkingItemId}
          />
        )}
      </View>
    );
  }, [handleStudyingPress, handlePopularPress, isChecking, checkingItemId]);

  const firstSectionKey = sections[0]?.key;
  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<ArtistRow, ArtistSection> }) => (
      <View style={[styles.sectionHeader, section.key === firstSectionKey && styles.firstSectionHeader]}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length}곡</Text>
      </View>
    ),
    [firstSectionKey],
  );

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.primary} style={styles.center} />
        <View style={[styles.floatingBackBar, { paddingTop: insets.top + 6 }]}>
          <Pressable style={styles.backButtonOnLight} onPress={handleBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
      </View>
    );
  }

  if (status === 'error' || !artist) {
    return (
      <View style={styles.container}>
        <View style={[styles.floatingBackBar, { paddingTop: insets.top + 6 }]}>
          <Pressable style={styles.backButtonOnLight} onPress={handleBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color={Colors.textMuted} />
          <Text style={styles.messageText}>
            {errorCode === 'ARTIST_NOT_FOUND'
              ? '아티스트를 찾을 수 없었어요.'
              : '아티스트 정보를 불러오지 못했어요.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.heroBackdrop}>
        <ArtistArtwork artworkUrl={artist.artworkUrl} translateY={artworkTranslate} />
      </View>
      <Animated.SectionList
        sections={sections}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <ArtistHero
            artist={artist}
            infoOpacity={heroInfoOpacity}
            onOpenAppleMusic={handleOpenAppleMusic}
          />
        }
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={<View style={[styles.listFooter, { height: insets.bottom + 24 }]} />}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
      />
      <View pointerEvents="none" style={[styles.appBarBackdrop, { height: collapsedBarFullHeight }]}>
        <ArtistArtwork artworkUrl={artist.artworkUrl} translateY={artworkTranslate} />
        <Animated.View style={[styles.appBarScrim, { opacity: appBarContentOpacity }]} />
      </View>
      <View
        pointerEvents="box-none"
        style={[styles.appBar, { height: collapsedBarFullHeight, paddingTop: insets.top }]}
      >
        <Pressable style={styles.backButton} onPress={handleBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Animated.Text
          style={[
            styles.appBarTitle,
            { opacity: appBarContentOpacity, transform: [{ translateY: appBarContentTranslate }] },
          ]}
          numberOfLines={1}
        >
          {artist.name}
        </Animated.Text>
      </View>
      <ErrorDialog message={errorDialogMessage} onDismiss={() => setErrorDialogMessage(null)} />
    </View>
  );
}

const keyExtractor = (item: ArtistRow) =>
  item.kind === 'studying' ? `studying-${item.song.songId}` : `popular-${item.song.id}`;

const EmptyState = React.memo(function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>아직 보여줄 곡이 없어요</Text>
      <Text style={styles.emptyText}>이 아티스트의 곡을 분석하면 여기에 쌓여요</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  messageText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  floatingBackBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Dimens.screenPadding,
    zIndex: 1,
  },
  backButtonOnLight: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    overflow: 'hidden',
    backgroundColor: Colors.textPrimary,
  },
  hero: {
    height: HERO_HEIGHT,
    justifyContent: 'flex-end',
    paddingBottom: 22,
  },
  listFooter: {
    backgroundColor: Colors.surface,
  },
  heroPhotoFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
  },
  heroPhoto: {
    ...StyleSheet.absoluteFillObject,
  },
  heroPhotoFallback: {
    backgroundColor: Colors.card,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  appBarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: Colors.textPrimary,
  },
  appBarScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000080',
  },
  appBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  appBarTitle: {
    flex: 1,
    ...Typography.bodyExtraBold,
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 24,
  },
  heroName: {
    flex: 1,
    ...Typography.headingExtraBold,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  appleMusicLink: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    backgroundColor: '#00000066',
  },
  appleMusicLabel: {
    ...Typography.bodySemiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionHeader: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Dimens.screenPadding,
    paddingTop: 24,
    paddingBottom: 6,
  },
  firstSectionHeader: {
    paddingTop: 16,
  },
  sectionTitle: {
    ...Typography.bodySemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sectionCount: {
    fontSize: 13,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  cell: {
    backgroundColor: Colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Dimens.screenPadding,
    paddingVertical: 10,
    minHeight: 68,
  },
  rowInfo: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    ...Typography.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  coverageValue: {
    ...Typography.headingBold,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.coverageAccent,
    fontVariant: ['tabular-nums'],
  },
  coverageTrack: {
    height: 4,
    borderRadius: 9999,
    backgroundColor: Colors.coverageTrack,
    overflow: 'hidden',
  },
  coverageKnown: {
    height: 4,
    borderRadius: 9999,
    backgroundColor: Colors.coverageAccent,
  },
  empty: {
    backgroundColor: Colors.surface,
    paddingTop: 48,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
