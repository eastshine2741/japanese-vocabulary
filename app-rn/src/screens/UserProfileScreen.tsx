import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors } from '../theme/theme';
import { AppBar } from '../components/AppBar';
import ProfileView from '../components/profile/ProfileView';
import { HeatmapView } from '../components/studyStats/HeatmapSection';
import { SongProgressItem, sumBy, toSongProgressItem } from '../components/studyStats/songProgress';
import { ArtistRewardCard, SongRewardCard } from '../components/rewardCards/types';
import { PublicUserProfile, userProfileApi } from '../api/userProfileApi';
import { useUserProfileStore } from '../stores/userProfileStore';
import { FlashcardStatsResponse } from '../types/flashcard';
import { SongDeckSummary } from '../types/deck';
import { HeatmapDay } from '../types/studyStats';
import { MyProfile } from './tabs/MyPageTab';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // 카드가 가장 늦게 오므로 프로필을 기다리지 않고 같이 받는다. 내 프로필이면 버려진다.
    useUserProfileStore.getState().loadCards(userId);
    userProfileApi.getProfile(userId)
      .then((data) => alive && setProfile(data))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [userId]);

  if (profile?.me) return <MyProfile onBack={navigation.goBack} />;
  if (profile) return <OtherProfile profile={profile} navigation={navigation} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppBar onBack={navigation.goBack} />
      <View style={styles.center}>
        {failed ? (
          <Text style={styles.failedText}>프로필을 불러오지 못했어요</Text>
        ) : (
          <ActivityIndicator color={Colors.primary} />
        )}
      </View>
    </SafeAreaView>
  );
}

function OtherProfile({ profile, navigation }: { profile: PublicUserProfile; navigation: Props['navigation'] }) {
  const { userId } = profile;
  const insets = useSafeAreaInsets();
  const { cards, cardsStatus } = useUserProfileStore(
    useShallow((s) => ({
      cards: s.cards[userId],
      cardsStatus: s.cardsStatus[userId],
    })),
  );
  const [stats, setStats] = useState<FlashcardStatsResponse | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [songDecks, setSongDecks] = useState<SongDeckSummary[] | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[] | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    userProfileApi.getFlashcardStats(userId)
      .then((data) => alive && setStats(data))
      .catch(() => alive && setStatsFailed(true));
    userProfileApi.getDecks(userId)
      .then((data) => alive && setSongDecks(data.songDecks))
      .catch(() => alive && setSongDecks([]));
    userProfileApi.getHeatmap(userId)
      .then((data) => alive && setHeatmapDays(data.days))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [userId]);

  const displayName = profile.name.trim() || '학습자';
  const progressItems = useMemo(() => (songDecks ?? []).map(toSongProgressItem), [songDecks]);
  const representativeSongs = useMemo(() => progressItems.slice(0, 5), [progressItems]);

  // 남의 단어장 안은 보여 주지 않는다. 곡 단어장만 곡 상세로 연다.
  const handlePressSong = useCallback((item: SongProgressItem) => {
    if (item.songId != null) navigation.navigate('SongDetail', { songId: item.songId, origin: 'user_profile_song_progress' });
  }, [navigation]);

  const handlePressCard = useCallback((card: SongRewardCard) => {
    navigation.navigate('RewardCardDetail', { cardId: card.id, ownerName: displayName, userId });
  }, [navigation, displayName, userId]);

  const handlePressArtistCard = useCallback((card: ArtistRewardCard) => {
    navigation.navigate('ArtistCardDetail', { cardId: card.id, ownerName: displayName, userId });
  }, [navigation, displayName, userId]);

  const handleOpenArtistCards = useCallback(() => {
    navigation.navigate('ArtistCardList', { ownerName: displayName, userId });
  }, [navigation, displayName, userId]);

  const heatmap = useMemo(() => <HeatmapView days={heatmapDays} />, [heatmapDays]);

  return (
    <ProfileView
      handle={`@${profile.username}`}
      displayName={displayName}
      profileImageUrl={profile.profileImageUrl}
      onBack={navigation.goBack}
      songCards={cards?.songCards ?? NO_SONG_CARDS}
      artistCards={cards?.artistCards ?? NO_ARTIST_CARDS}
      cardsLoading={cardsStatus == null || cardsStatus === 'loading'}
      onPressCard={handlePressCard}
      onPressArtistCard={handlePressArtistCard}
      onOpenArtistCards={handleOpenArtistCards}
      totalWords={stats?.total ?? sumBy(progressItems, (item) => item.totalWords)}
      longTermWords={stats?.longTermCount ?? sumBy(progressItems, (item) => item.longTermCount)}
      shortTermWords={stats?.shortTermCount ?? sumBy(progressItems, (item) => item.shortTermCount)}
      showStatsFallback={!stats && statsFailed}
      songsLoading={songDecks == null}
      representativeSongs={representativeSongs}
      onPressSong={handlePressSong}
      heatmap={heatmap}
      contentPaddingBottom={insets.bottom + 24}
    />
  );
}

const NO_SONG_CARDS: SongRewardCard[] = [];
const NO_ARTIST_CARDS: ArtistRewardCard[] = [];

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  failedText: { fontSize: 14, color: Colors.textMuted },
});
