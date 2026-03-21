import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDeckDetailStore } from '../stores/deckDetailStore';
import AppTopBar from '../components/AppTopBar';
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
    <View style={styles.container}>
      <AppTopBar title={data?.title || 'All Words'} onBack={() => navigation.goBack()} />
      {status === 'loading' && (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.center} />
      )}
      {status === 'error' && <Text style={styles.errorText}>{error}</Text>}
      {status === 'success' && data && (
        <ScrollView contentContainerStyle={styles.content}>
          {data.artworkUrl && (
            <View style={styles.artworkRow}>
              <ArtworkImage url={data.artworkUrl} size={160} cornerRadius={12} />
            </View>
          )}
          {data.title && <Text style={styles.title}>{data.title}</Text>}
          {data.artist && <Text style={styles.artist}>{data.artist}</Text>}

          <View style={styles.statsGrid}>
            <StatBox label="Total Words" value={String(data.wordCount)} />
            <StatBox label="Due Today" value={String(data.dueCount)} />
            <StatBox
              label="Retrievability"
              value={data.avgRetrievability != null ? `${Math.round(data.avgRetrievability * 100)}%` : '-'}
            />
          </View>

          <View style={styles.chipRow}>
            <Chip label="New" count={data.stateCounts.new} color="#3B82F6" />
            <Chip label="Learning" count={data.stateCounts.learning} color="#F59E0B" />
            <Chip label="Review" count={data.stateCounts.review} color="#10B981" />
            <Chip label="Relearn" count={data.stateCounts.relearning} color="#EF4444" />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, data.dueCount === 0 && styles.buttonDisabled]}
            onPress={() => navigation.navigate('Review', { songId })}
            disabled={data.dueCount === 0}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>Start Review</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => navigation.navigate('DeckWordList', { songId })}
            activeOpacity={0.7}
          >
            <Text style={styles.outlineButtonText}>View Words</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={statStyles.box}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function Chip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[chipStyles.chip, { backgroundColor: color + '15' }]}>
      <Text style={[chipStyles.text, { color }]}>
        {label} {count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center' },
  content: { padding: Dimens.screenPadding, alignItems: 'center' },
  errorText: { color: Colors.ratingAgain, textAlign: 'center', padding: 20 },
  artworkRow: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  artist: { fontSize: 15, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  statsGrid: {
    flexDirection: 'row',
    marginTop: 24,
    backgroundColor: Colors.surface,
    borderRadius: Dimens.cardCornerRadius,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    width: '100%',
  },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.4 },
  primaryButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  outlineButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  outlineButtonText: { color: Colors.primary, fontWeight: '600', fontSize: 16 },
});

const statStyles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center' },
  value: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  label: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
});

const chipStyles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  text: { fontSize: 13, fontWeight: '600' },
});
