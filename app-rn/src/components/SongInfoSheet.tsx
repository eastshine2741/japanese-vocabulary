import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/theme';
import { buildReportMailto } from '../config/legal';

interface Props {
  songId: number;
  title: string;
  artist: string;
  lyricsSourceName: string | null;
  lyricsSourceUrl: string | null;
}

function SongInfoSheet({ songId, title, artist, lyricsSourceName, lyricsSourceUrl }: Props) {
  const handleReport = useCallback(() => {
    Linking.openURL(buildReportMailto({ songId, songTitle: title, artist }));
  }, [songId, title, artist]);

  const handleOpenSource = useCallback(() => {
    if (lyricsSourceUrl) Linking.openURL(lyricsSourceUrl);
  }, [lyricsSourceUrl]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>곡 정보</Text>
      <View style={styles.songBlock}>
        <Text style={styles.songTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{artist}</Text>
      </View>

      <View style={styles.divider} />

      {lyricsSourceName && (
        <>
          <Text style={styles.sectionLabel}>가사 출처</Text>
          {lyricsSourceUrl ? (
            <TouchableOpacity onPress={handleOpenSource} activeOpacity={0.6} style={styles.sourceRow}>
              <Text style={styles.sourceLink}>{lyricsSourceName}</Text>
              <Feather name="external-link" size={13} color={Colors.primary} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.body}>{lyricsSourceName}</Text>
          )}
        </>
      )}

      <Text style={[styles.sectionLabel, lyricsSourceName ? styles.sectionLabelGap : null]}>고지</Text>
      <Text style={styles.body}>
        가사 텍스트와 번역은 일본어 학습 목적으로만 제공되며, 저작권은 원권리자에게 있습니다.
        권리자 요청 시 해당 곡을 즉시 비공개 처리합니다.
      </Text>

      <TouchableOpacity style={styles.reportBtn} onPress={handleReport} activeOpacity={0.7}>
        <Feather name="flag" size={16} color={Colors.textPrimary} />
        <Text style={styles.reportText}>이 곡 권리자 신고</Text>
        <Feather name="mail" size={14} color={Colors.textMuted} style={styles.reportIconRight} />
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(SongInfoSheet);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 8,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  songBlock: {
    gap: 4,
    paddingVertical: 4,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  songArtist: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.4,
  },
  sectionLabelGap: {
    marginTop: 12,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 2,
  },
  sourceLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.card,
  },
  reportText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  reportIconRight: {
    marginLeft: 4,
  },
});
