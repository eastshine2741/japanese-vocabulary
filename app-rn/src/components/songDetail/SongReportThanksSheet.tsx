import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

export interface SongReportThanksSheetProps {
  onClose: () => void;
}

function SongReportThanksSheet({ onClose }: SongReportThanksSheetProps) {
  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <Feather name="heart" size={26} color={Colors.primary} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>제보해주셔서 감사합니다</Text>
        <Text style={styles.body}>
          {'보내주신 제보 덕분에 모든 분이 더 정확하게 배울 수 있어요.\n보내주신 내용은 꼼꼼히 살펴본 후 반영할게요.'}
        </Text>
      </View>

      <Pressable style={styles.button} onPress={onClose} accessibilityRole="button">
        <Text style={styles.buttonLabel}>확인</Text>
      </Pressable>
    </View>
  );
}

export default React.memo(SongReportThanksSheet);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 20,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryBg,
  },
  copy: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 19,
    lineHeight: 26,
    color: Colors.textPrimary,
    textAlign: 'center',
    ...Typography.headingExtraBold,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  buttonLabel: {
    fontSize: 14,
    lineHeight: 19,
    color: '#FFFFFF',
    ...Typography.bodyExtraBold,
  },
});
