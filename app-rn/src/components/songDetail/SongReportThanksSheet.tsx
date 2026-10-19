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
        <Text style={styles.title}>알려주셔서 감사합니다</Text>
        <Text style={styles.body}>
          {'저희가 놓친 부분을 짚어주셨어요.\n확인하고 바로잡으면 알림으로 알려드릴게요.'}
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
