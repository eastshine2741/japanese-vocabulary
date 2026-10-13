import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArtistCardFront } from './ArtistCardShowcase';
import { SongCardFront } from './SongCardShowcase';
import { ARTIST_GRADE_STEPS, type ArtistGradeStep } from './artistGrade';
import { SONG_CARD_KINDS, artistCardOfStep, songCardOfKind, type SongCardKind } from './cardKinds';
import { artistCardPreview, songCardPreview, type PreviewArtist, type PreviewSong } from './cardPreview';
import { CardFonts, songTierName } from './cardTheme';
import type { ArtistRewardCard, SongRewardCard } from './types';
import { useAuthStore } from '../../stores/authStore';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { songGradeCondition } from './songGradeCondition';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

const GAP = 10;
const SONG_COLUMNS = 3;
const ARTIST_COLUMNS = 2;

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function useOwnerName(): string {
  const userName = useAuthStore(s => s.userName);
  return userName?.trim() || '학습자';
}

function artistGradeCondition(step: ArtistGradeStep): { short: string; full: string } {
  if (step.from === 0) return { short: '첫 곡 카드', full: '이 아티스트의 곡 카드 처음 얻기' };
  return { short: `MASTER 카드 ${step.from}장`, full: `이 아티스트 곡의 MASTER 카드 ${step.from}장 모으기` };
}

interface SongGridProps {
  song: PreviewSong;
  /** 이 곡의 내 카드들(등급마다 한 장). 없는 등급은 견본이다. */
  cards: readonly SongRewardCard[];
  width: number;
  fonts: CardFonts;
}

/** 이 곡에서 얻을 수 있는 곡 카드 전부. 받은 등급은 그 등급의 내 카드, 아직인 등급은 견본이다. */
export const SongCardKindGrid = React.memo(function SongCardKindGrid({ song, cards, width, fonts }: SongGridProps) {
  const navigation = useNavigation<Navigation>();
  const gradeRule = useRewardCardStore(s => s.songGradeRule);
  const ownerName = useOwnerName();
  const tileWidth = Math.floor((width - GAP * (SONG_COLUMNS - 1)) / SONG_COLUMNS);

  const handleOpen = useCallback((kind: SongCardKind) => {
    const condition = songGradeCondition(SONG_CARD_KINDS.indexOf(kind), gradeRule).full;
    const card = songCardOfKind(cards, kind);
    if (card != null) {
      navigation.navigate('RewardCardDetail', { cardId: card.id, ownerName });
      return;
    }
    navigation.navigate('RewardCardPreview', {
      target: { kind: 'song', song, level: kind.level, mastered: kind.mastered },
      condition,
      reached: false,
    });
  }, [cards, gradeRule, navigation, ownerName, song]);

  return (
    <View style={styles.grid}>
      {SONG_CARD_KINDS.map((kind, rung) => (
        <SongKindTile
          key={kind.key}
          kind={kind}
          song={song}
          card={songCardOfKind(cards, kind)}
          condition={songGradeCondition(rung, gradeRule).short}
          width={tileWidth}
          fonts={fonts}
          onPress={handleOpen}
        />
      ))}
    </View>
  );
});

const SongKindTile = React.memo(function SongKindTile({
  kind,
  song,
  card,
  condition,
  width,
  fonts,
  onPress,
}: {
  kind: SongCardKind;
  song: PreviewSong;
  card: SongRewardCard | null;
  condition: string;
  width: number;
  fonts: CardFonts;
  onPress: (kind: SongCardKind) => void;
}) {
  const owned = card != null;
  const shown = useMemo(() => card ?? songCardPreview(song, kind.level, kind.mastered), [card, kind, song]);
  const handlePress = useCallback(() => onPress(kind), [onPress, kind]);
  return (
    <KindTile
      name={songTierName(kind.level, kind.mastered)}
      condition={condition}
      owned={owned}
      width={width}
      radius={width * 0.046}
      onPress={handlePress}
    >
      <SongCardFront card={shown} width={width} fonts={fonts} thumb />
    </KindTile>
  );
});

interface ArtistGridProps {
  artist: PreviewArtist;
  /** 이 아티스트의 내 카드들(등급마다 한 장). */
  cards: readonly ArtistRewardCard[];
  width: number;
  fonts: CardFonts;
}

/** 이 아티스트 카드의 등급 전부. 받은 등급은 그 등급의 내 카드, 아직인 등급은 견본이다. */
export const ArtistCardKindGrid = React.memo(function ArtistCardKindGrid({ artist, cards, width, fonts }: ArtistGridProps) {
  const navigation = useNavigation<Navigation>();
  const ownerName = useOwnerName();
  const tileWidth = Math.floor((width - GAP * (ARTIST_COLUMNS - 1)) / ARTIST_COLUMNS);

  const handleOpen = useCallback((step: ArtistGradeStep) => {
    const card = artistCardOfStep(cards, step);
    if (card != null) {
      navigation.navigate('ArtistCardDetail', { cardId: card.id, ownerName });
      return;
    }
    navigation.navigate('RewardCardPreview', {
      target: { kind: 'artist', artist, masteredCount: step.from },
      condition: artistGradeCondition(step).full,
      reached: false,
    });
  }, [artist, cards, navigation, ownerName]);

  return (
    <View style={styles.grid}>
      {ARTIST_GRADE_STEPS.map(step => (
        <ArtistKindTile
          key={step.grade}
          step={step}
          artist={artist}
          card={artistCardOfStep(cards, step)}
          width={tileWidth}
          fonts={fonts}
          onPress={handleOpen}
        />
      ))}
    </View>
  );
});

const ArtistKindTile = React.memo(function ArtistKindTile({
  step,
  artist,
  card,
  width,
  fonts,
  onPress,
}: {
  step: ArtistGradeStep;
  artist: PreviewArtist;
  card: ArtistRewardCard | null;
  width: number;
  fonts: CardFonts;
  onPress: (step: ArtistGradeStep) => void;
}) {
  const owned = card != null;
  const shown = useMemo(() => card ?? artistCardPreview(artist, step.from), [card, step, artist]);
  const handlePress = useCallback(() => onPress(step), [onPress, step]);
  return (
    <KindTile
      name={step.label}
      condition={artistGradeCondition(step).short}
      owned={owned}
      width={width}
      radius={width * 0.04}
      onPress={handlePress}
    >
      <ArtistCardFront card={shown} width={width} fonts={fonts} />
    </KindTile>
  );
});

function KindTile({
  name,
  condition,
  owned,
  width,
  radius,
  onPress,
  children,
}: {
  name: string;
  condition: string;
  owned: boolean;
  width: number;
  radius: number;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} 카드${owned ? '' : ' 견본'} 보기`}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <View style={[styles.card, { borderRadius: radius }]}>{children}</View>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {!owned && (
          <View style={styles.sampleTag}>
            <Text style={styles.sampleText}>견본</Text>
          </View>
        )}
      </View>
      <Text style={styles.condition} numberOfLines={1}>{condition}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GAP,
    rowGap: 18,
  },
  card: {
    boxShadow: '0 8px 14px -6px rgba(20, 12, 30, 0.4)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  name: {
    ...Typography.bodySemiBold,
    flexShrink: 1,
    fontSize: 12.5,
    color: Colors.textPrimary,
  },
  sampleTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  sampleText: {
    ...Typography.bodyMedium,
    fontSize: 10,
    color: Colors.textMuted,
  },
  condition: {
    ...Typography.body,
    marginTop: 2,
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
