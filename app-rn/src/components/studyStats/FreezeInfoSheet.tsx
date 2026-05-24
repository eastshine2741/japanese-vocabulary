import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';

interface Props {
  onConfirm: () => void;
}

function FreezeInfoSheet({ onConfirm }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="snow" size={36} color={Colors.freezeStroke} />
      </View>

      <View style={styles.textCol}>
        <Text style={styles.title}>프리즈</Text>
        <Text style={styles.desc}>
          {'복습을 놓친 날, 프리즈가 자동으로 사용되어\n'}
          {'연속 학습 기록을 지켜줘요.\n'}
          {'7일 연속 학습할 때마다 프리즈 1개가 지급되고,\n'}
          {'최대 2개까지 보유할 수 있어요.'}
        </Text>
      </View>

      <TouchableOpacity style={styles.cta} onPress={onConfirm} activeOpacity={0.8}>
        <Text style={styles.ctaText}>확인</Text>
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(FreezeInfoSheet);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 20,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.freezeFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
