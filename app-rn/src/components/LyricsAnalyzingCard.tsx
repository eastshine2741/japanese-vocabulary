import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

interface Props {
  onReload: () => void;
  style?: StyleProp<ViewStyle>;
}

function LyricsAnalyzingCard({ onReload, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.card}>
        <Ionicons name="sparkles" size={18} color={Colors.primary} />

        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>한국어 번역을 준비하고 있어요</Text>
          <Text style={styles.subtitle} numberOfLines={1}>1~2분 내에 완료돼요</Text>
        </View>

        <TouchableOpacity
          style={styles.reloadBtn}
          onPress={onReload}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityLabel="새로고침"
        >
          <Feather name="refresh-cw" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default React.memo(LyricsAnalyzingCard);

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  reloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
