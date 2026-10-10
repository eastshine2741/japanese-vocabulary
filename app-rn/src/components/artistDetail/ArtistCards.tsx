import React, { useCallback, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import ArtistCardThumb from '../rewardCards/ArtistCardThumb';
import { ArtistCardFront } from '../rewardCards/ArtistCardShowcase';
import MaterialGlyph from '../rewardCards/MaterialGlyph';
import SongCardThumb from '../rewardCards/SongCardThumb';
import { ARTIST_GRADE_STEPS, artistGradeStep, nextArtistGradeStep } from '../rewardCards/artistGrade';
import { artistCardPreview } from '../rewardCards/cardPreview';
import { ARTIST_MATERIAL, CARD_RATIO, CardFonts } from '../rewardCards/cardTheme';
import type { ArtistRewardCard, SongRewardCard } from '../rewardCards/types';
import type { ArtistDetail, ArtistStudyingSong } from '../../types/artist';
import type { SongSearchItem } from '../../types/song';
import { Colors, Dimens } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import type { SongCardSlot } from './artistCardSlots';

export const SONG_CARD_COLUMNS = 3;
export const SONG_CARD_GAP = 10;

interface SummaryProps {
  artist: ArtistDetail;
  card: ArtistRewardCard | null;
  width: number;
  fonts: CardFonts;
  onOpen: (card: ArtistRewardCard) => void;
}

/** 내 아티스트 카드와 재질 계단. 카드가 아직 없으면 종이 카드 견본을 흐리게 보여 준다. */
export const ArtistCardSummary = React.memo(function ArtistCardSummary({
  artist,
  card,
  width,
  fonts,
  onOpen,
}: SummaryProps) {
  const preview = useMemo(
    () => (card ? null : artistCardPreview(artist, 0)),
    [artist, card],
  );
  const masteredCount = card?.masteredCount ?? 0;
  const next = card ? nextArtistGradeStep(masteredCount) : null;

  return (
    <View style={styles.summary}>
      <Text style={styles.heading}>아티스트 카드</Text>
      <View style={styles.cardStage}>
        {card ? (
          <ArtistCardThumb card={card} width={width} fonts={fonts} onPress={onOpen} />
        ) : (
          <View style={styles.ahead}>
            <ArtistCardFront card={preview!} width={width} fonts={fonts} />
          </View>
        )}
      </View>
      <ArtistGradeLadder masteredCount={masteredCount} hasCard={card != null} />
      {next && (
        <Text style={styles.nextLine}>
          {next.label}까지 마스터 곡 <Text style={styles.nextValue}>{next.from - masteredCount}곡</Text>
        </Text>
      )}
    </View>
  );
});

const ArtistGradeLadder = React.memo(function ArtistGradeLadder({
  masteredCount,
  hasCard,
}: {
  masteredCount: number;
  hasCard: boolean;
}) {
  const current = hasCard ? artistGradeStep(masteredCount).grade : null;
  return (
    <View style={styles.ladder}>
      {ARTIST_GRADE_STEPS.map(step => {
        const reached = hasCard && masteredCount >= step.from;
        const isNow = step.grade === current;
        return (
          <View key={step.grade} style={[styles.rung, !reached && styles.ahead]}>
            <MaterialGlyph frame={ARTIST_MATERIAL[step.grade].frame} landscape size={13} />
            <Text style={[styles.rungLabel, isNow && styles.rungLabelNow]} numberOfLines={1} adjustsFontSizeToFit>
              {step.label}
            </Text>
            <Text style={styles.rungCaption} numberOfLines={1} adjustsFontSizeToFit>
              {step.from === 0 ? '첫 곡 카드' : `마스터 ${step.from}곡`}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

interface SlotRowProps {
  slots: readonly SongCardSlot[];
  width: number;
  fonts: CardFonts;
  /** 인기곡은 존재 확인이 도는 동안 막는다. 두 번째 탭이 첫 콜백과 경쟁하면 엉뚱한 곡으로 간다. */
  isChecking: boolean;
  onOpenCard: (card: SongRewardCard) => void;
  onOpenStudying: (songId: number) => void;
  onOpenPopular: (song: SongSearchItem) => void;
}

/** 곡 카드 도감 한 줄. 얻은 카드는 앞면, 아직 없는 곡은 앨범 아트를 흐리게 깐 빈칸이다. */
export const SongCardSlotRow = React.memo(function SongCardSlotRow({
  slots,
  width,
  fonts,
  isChecking,
  onOpenCard,
  onOpenStudying,
  onOpenPopular,
}: SlotRowProps) {
  return (
    <View style={styles.slotRow}>
      {slots.map(slot => {
        if (slot.kind === 'owned') {
          return <SongCardThumb key={slot.key} card={slot.card} width={width} fonts={fonts} onPress={onOpenCard} />;
        }
        if (slot.kind === 'studying') {
          return <StudyingSlot key={slot.key} song={slot.song} width={width} onPress={onOpenStudying} />;
        }
        return (
          <PopularSlot key={slot.key} song={slot.song} width={width} disabled={isChecking} onPress={onOpenPopular} />
        );
      })}
    </View>
  );
});

const StudyingSlot = React.memo(function StudyingSlot({
  song,
  width,
  onPress,
}: {
  song: ArtistStudyingSong;
  width: number;
  onPress: (songId: number) => void;
}) {
  const handlePress = useCallback(() => onPress(song.songId), [onPress, song.songId]);
  return <EmptySlot title={song.title} artworkUrl={song.artworkUrl} width={width} onPress={handlePress} />;
});

const PopularSlot = React.memo(function PopularSlot({
  song,
  width,
  disabled,
  onPress,
}: {
  song: SongSearchItem;
  width: number;
  disabled: boolean;
  onPress: (song: SongSearchItem) => void;
}) {
  const handlePress = useCallback(() => onPress(song), [onPress, song]);
  return (
    <EmptySlot title={song.title} artworkUrl={song.thumbnail} width={width} disabled={disabled} onPress={handlePress} />
  );
});

const EmptySlot = React.memo(function EmptySlot({
  title,
  artworkUrl,
  width,
  disabled = false,
  onPress,
}: {
  title: string;
  artworkUrl: string | null | undefined;
  width: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  const height = width * CARD_RATIO;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}, 아직 카드 없음`}
      style={({ pressed }) => [
        styles.emptySlot,
        { width, height, borderRadius: width * 0.046 },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.emptyArt, { width: width - 14, height: width - 14 }]}>
        {artworkUrl ? <Image source={{ uri: artworkUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      </View>
      <Text style={styles.emptyTitle} numberOfLines={2}>{title}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  summary: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Dimens.screenPadding,
    paddingTop: 20,
    gap: 14,
  },
  heading: {
    ...Typography.bodySemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cardStage: {
    alignItems: 'center',
  },
  ahead: {
    opacity: 0.45,
  },
  ladder: {
    flexDirection: 'row',
    gap: 4,
  },
  rung: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  rungLabel: {
    ...Typography.bodySemiBold,
    marginTop: 2,
    color: Colors.textSecondary,
    fontSize: 11.5,
  },
  rungLabelNow: {
    ...Typography.bodyBold,
    color: Colors.primary,
  },
  rungCaption: {
    ...Typography.body,
    color: Colors.textMuted,
    fontSize: 10.5,
  },
  nextLine: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  nextValue: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
  },
  slotRow: {
    flexDirection: 'row',
    gap: SONG_CARD_GAP,
    paddingHorizontal: Dimens.screenPadding,
    paddingBottom: SONG_CARD_GAP,
    backgroundColor: Colors.surface,
  },
  emptySlot: {
    alignItems: 'center',
    paddingTop: 7,
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  emptyArt: {
    overflow: 'hidden',
    borderRadius: 4,
    opacity: 0.35,
    backgroundColor: Colors.border,
  },
  emptyTitle: {
    ...Typography.bodyMedium,
    paddingHorizontal: 8,
    color: Colors.textMuted,
    fontSize: 11.5,
    lineHeight: 15,
    textAlign: 'center',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
