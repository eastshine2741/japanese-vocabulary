import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useHomeStore } from '../../stores/homeStore';
import { useSearchStore } from '../../stores/searchStore';
import { flashcardApi } from '../../api/flashcardApi';
import SongCard from '../../components/SongCard';
import StatsCard from '../../components/StatsCard';
import SkeletonBox from '../../components/SkeletonLoading';
import { FlashcardStatsResponse } from '../../types/flashcard';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeTab() {
  const navigation = useNavigation<Nav>();
  const { status, songs, load } = useHomeStore();
  const { analyzeStatus, studyData, loadById } = useSearchStore();
  const [stats, setStats] = useState<FlashcardStatsResponse | null>(null);

  useEffect(() => {
    load();
    flashcardApi.getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (analyzeStatus === 'success' && studyData) {
      navigation.navigate('Player', { origin: 'Home' });
    }
  }, [analyzeStatus, studyData]);

  const renderHeader = () => (
    <View>
      <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('Search')}>
        <Ionicons name="search" size={18} color={Colors.textTertiary} />
        <Text style={styles.searchPlaceholder}>Search songs...</Text>
      </TouchableOpacity>

      {stats && (
        <View style={styles.statsSection}>
          <StatsCard
            wordCount={stats.total}
            dueToday={stats.due}
            actionLabel="Review"
            onAction={() => navigation.navigate('Review', {})}
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>Recently Played</Text>
    </View>
  );

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.skeletonGrid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <SkeletonBox height={100} borderRadius={Dimens.artworkCornerRadius} />
              <SkeletonBox width={80} height={14} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={songs}
        numColumns={3}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <SongCard
            artworkUrl={item.artworkUrl}
            title={item.title}
            artist={item.artist}
            onPress={() => loadById(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.columnWrapper}
      />
      {analyzeStatus === 'loading' && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Dimens.screenPadding },
  columnWrapper: { gap: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Dimens.smallCornerRadius,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 16,
  },
  searchPlaceholder: { fontSize: 15, color: Colors.textTertiary },
  statsSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Dimens.screenPadding, gap: 8 },
  skeletonCard: { width: '31%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
