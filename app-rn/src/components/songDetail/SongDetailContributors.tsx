import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import type { SongContributor, SongContributorsDto } from '../../types/songReport';
import { contributorColor, contributorInitial } from './songDetailContributors';

interface SongDetailContributorsProps {
  contributors: SongContributorsDto;
  onPressContributor: (contributor: SongContributor) => void;
}

interface ContributorFaceProps {
  contributor: SongContributor;
  index: number;
  onPress: (contributor: SongContributor) => void;
}

const ContributorFace = React.memo(function ContributorFace({ contributor, index, onPress }: ContributorFaceProps) {
  const handlePress = useCallback(() => onPress(contributor), [onPress, contributor]);
  return (
    <Pressable
      style={({ pressed }) => [styles.faceCell, pressed && styles.facePressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={contributor.name ?? contributor.username}
    >
      {contributor.profileImageUrl ? (
        <Image source={{ uri: contributor.profileImageUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: contributorColor(index) }]}>
          <Text style={styles.initial}>{contributorInitial(contributor)}</Text>
        </View>
      )}
    </Pressable>
  );
});

export const SongDetailContributors = React.memo(function SongDetailContributors({
  contributors,
  onPressContributor,
}: SongDetailContributorsProps) {
  if (contributors.contributors.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>이 곡을 함께 다듬어 주신 분들</Text>
        <Text style={styles.subtitle}>{`${contributors.count}명이 알려주신 덕분에 가사와 단어를 바로잡았어요`}</Text>
      </View>

      <View style={styles.faceGrid}>
        {contributors.contributors.map((contributor, index) => (
          <ContributorFace key={contributor.userId} contributor={contributor} index={index} onPress={onPressContributor} />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.textPrimary,
    ...Typography.headingBold,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  // 칸이 아바타보다 4 넓다. 바깥으로 그만큼 빼야 첫 아바타가 제목과 맞는다.
  faceGrid: {
    marginHorizontal: -4,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  faceCell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facePressed: {
    opacity: 0.6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4A4A4A',
    ...Typography.bodyBold,
  },
});
