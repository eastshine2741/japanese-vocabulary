import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../stores/authStore';
import { useDeckListStore } from '../../stores/deckListStore';
import { useHomeChromeStore } from '../../stores/homeChromeStore';
import { useDeleteSongDeck, useSongDeckActionSheet } from '../../hooks/useDeleteSongDeck';
import type { SongDeckTarget } from '../../components/SongDeckActionSheet';
import { Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import HeatmapSection from '../../components/studyStats/HeatmapSection';
import { SongProgressItem, sumBy, toSongProgressItem } from '../../components/studyStats/songProgress';
import ProfileView from '../../components/profile/ProfileView';
import { flashcardApi } from '../../api/flashcardApi';
import { FlashcardStatsResponse } from '../../types/flashcard';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { ArtistRewardCard, SongRewardCard } from '../../components/rewardCards/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MyPageTab() {
  return <MyProfile />;
}

/** 편집·설정이 되는 내 프로필. 탭에 있고, 기여자 목록에서 나를 누르면 스택에도 올라온다. */
export function MyProfile({ onBack }: { onBack?: () => void }) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const username = useAuthStore((s) => s.username);
  const userName = useAuthStore((s) => s.userName);
  const profileImageUrl = useAuthStore((s) => s.profileImageUrl);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const songCards = useRewardCardStore((s) => s.songCards);
  const artistCards = useRewardCardStore((s) => s.artistCards);
  const cardsLoading = useRewardCardStore((s) => s.source === 'server' && (s.serverStatus === 'idle' || s.serverStatus === 'loading'));
  const { deckStatus, songDecks, loadDecks } = useDeckListStore(
    useShallow((s) => ({
      deckStatus: s.status,
      songDecks: s.songDecks,
      loadDecks: s.load,
    })),
  );
  const [flashcardStats, setFlashcardStats] = useState<FlashcardStatsResponse | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadDecks();
      if (useRewardCardStore.getState().source === 'server') useRewardCardStore.getState().loadServerCards();
    }, [loadProfile, loadDecks]),
  );

  const statsAliveRef = useRef(false);
  const loadFlashcardStats = useCallback(() => {
    flashcardApi.getStats()
      .then((data) => {
        if (!statsAliveRef.current) return;
        setFlashcardStats(data);
        setStatsError(null);
      })
      .catch((e: any) => {
        if (!statsAliveRef.current) return;
        setStatsError(e.message ?? 'failed');
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      statsAliveRef.current = true;
      loadFlashcardStats();
      return () => {
        statsAliveRef.current = false;
      };
    }, [loadFlashcardStats]),
  );

  const requestHomeReload = useHomeChromeStore((s) => s.requestReload);
  const handleDeckDeleted = useCallback(() => {
    loadDecks();
    loadFlashcardStats();
    requestHomeReload();
  }, [loadDecks, loadFlashcardStats, requestHomeReload]);
  const deckDeletion = useDeleteSongDeck(handleDeckDeleted);
  const { requestDelete } = deckDeletion;
  const handleDeleteFromSheet = useCallback((target: SongDeckTarget) => {
    requestDelete(target.deckId);
  }, [requestDelete]);
  const deckActions = useSongDeckActionSheet(handleDeleteFromSheet);
  const { open: openDeckActions } = deckActions;

  const handle = username ? `@${username}` : '@user';
  const displayName = userName?.trim() || '학습자';
  const progressItems = useMemo(() => songDecks.map(toSongProgressItem), [songDecks]);
  const representativeSongs = useMemo(() => progressItems.slice(0, 5), [progressItems]);
  const totalWords = flashcardStats?.total ?? sumBy(progressItems, (item) => item.totalWords);
  const longTermWords = flashcardStats?.longTermCount ?? sumBy(progressItems, (item) => item.longTermCount);
  const shortTermWords = flashcardStats?.shortTermCount ?? sumBy(progressItems, (item) => item.shortTermCount);
  const showStatsFallback = !flashcardStats && !!statsError;

  const handleSongProgressPress = useCallback((item: SongProgressItem) => {
    if (item.songId != null) {
      navigation.navigate('SongDetail', { songId: item.songId, origin: 'profile_song_progress' });
    } else {
      navigation.navigate('DeckDetail', { deckId: item.deckId });
    }
  }, [navigation]);

  const handleSongProgressLongPress = useCallback((item: SongProgressItem) => {
    openDeckActions({ deckId: item.deckId, title: item.title, artist: item.artist });
  }, [openDeckActions]);

  const handleOpenSongProgress = useCallback(() => {
    navigation.navigate('SongProgressList');
  }, [navigation]);

  const handleOpenStreak = useCallback(() => {
    navigation.navigate('Streak');
  }, [navigation]);

  const handleOpenSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const handleEditProfile = useCallback(() => {
    navigation.navigate('ProfileEdit');
  }, [navigation]);

  const handlePressCard = useCallback((card: SongRewardCard) => {
    navigation.navigate('RewardCardDetail', { cardId: card.id, ownerName: displayName });
  }, [navigation, displayName]);

  const handlePressArtistCard = useCallback((card: ArtistRewardCard) => {
    navigation.navigate('ArtistCardDetail', { cardId: card.id, ownerName: displayName });
  }, [navigation, displayName]);

  const handleOpenArtistCards = useCallback(() => {
    navigation.navigate('ArtistCardList', { ownerName: displayName });
  }, [navigation, displayName]);

  const heatmap = useMemo(() => <HeatmapSection onPressMore={handleOpenStreak} />, [handleOpenStreak]);
  // 스택에 올린 프로필엔 바텀탭이 없다.
  const contentPaddingBottom = (onBack ? 0 : Dimens.bottomBarHeight) + insets.bottom + 24;

  return (
    <ProfileView
      handle={handle}
      displayName={displayName}
      profileImageUrl={profileImageUrl}
      onBack={onBack}
      onOpenSettings={handleOpenSettings}
      onEditProfile={handleEditProfile}
      songCards={songCards}
      artistCards={artistCards}
      cardsLoading={cardsLoading}
      onPressCard={handlePressCard}
      onPressArtistCard={handlePressArtistCard}
      onOpenArtistCards={handleOpenArtistCards}
      totalWords={totalWords}
      longTermWords={longTermWords}
      shortTermWords={shortTermWords}
      showStatsFallback={showStatsFallback}
      songsLoading={deckStatus === 'loading'}
      representativeSongs={representativeSongs}
      onPressSong={handleSongProgressPress}
      onLongPressSong={handleSongProgressLongPress}
      onOpenSongProgress={handleOpenSongProgress}
      emptySongsHint="노래에서 단어를 저장하면 여기에 진행률이 보여요"
      heatmap={heatmap}
      contentPaddingBottom={contentPaddingBottom}
    >
      {deckActions.sheet}
      {deckDeletion.dialogs}
    </ProfileView>
  );
}
