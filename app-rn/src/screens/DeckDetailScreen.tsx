import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDeckDetailStore } from '../stores/deckDetailStore';
import ArtworkImage from '../components/ArtworkImage';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckDetail'>;

export default function DeckDetailScreen({ route, navigation }: Props) {
  const { songId } = route.params;
  const { status, data, error, load } = useDeckDetailStore();

  useEffect(() => {
    load(songId);
  }, [songId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top bar: back arrow only */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {status === 'loading' && (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.center} />
        )}
        {status === 'error' && <Text style={styles.errorText}>{error}</Text>}
        {status === 'success' && data && (
          <View style={styles.content}>
            {/* Artwork */}
            <ArtworkImage url={data.artworkUrl} size={200} cornerRadius={16} />

            {/* Song title */}
            {data.title && <Text style={styles.title}>{data.title}</Text>}

            {/* Artist */}
            {data.artist && <Text style={styles.artist}>{data.artist}</Text>}

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{data.wordCount}</Text>
                <Text style={styles.statLabel}>단어</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.stateRetrievability }]}>
                  {data.avgRetrievability != null
                    ? `${Math.round(data.avgRetrievability * 100)}%`
                    : '-'}
                </Text>
                <Text style={styles.statLabel}>Retrievability</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{data.dueCount}</Text>
                <Text style={styles.statLabel}>복습 대기</Text>
              </View>
            </View>

            {/* Study button */}
            <TouchableOpacity
              style={[styles.primaryButton, data.dueCount === 0 && styles.buttonDisabled]}
              onPress={() => navigation.navigate('Review', { songId })}
              disabled={data.dueCount === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="bulb-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>학습하기</Text>
            </TouchableOpacity>

            {/* View words button */}
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={() => navigation.navigate('DeckWordList', { songId })}
              activeOpacity={0.7}
            >
              <Ionicons name="list-outline" size={20} color={Colors.primary} style={styles.buttonIcon} />
              <Text style={styles.outlineButtonText}>단어 보기</Text>
            </TouchableOpacity>
          </View>
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
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  errorText: {
    color: Colors.ratingAgain,
    textAlign: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Dimens.screenPadding,
    gap: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: -16,
  },
  artist: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: -24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  outlineButton: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: -16,
  },
  outlineButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
});
