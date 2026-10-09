import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/theme';
import { Layers } from '../theme/layers';

const VISIBLE_MS = 2600;
const FADE_MS = 180;

interface SnackbarProps {
  message: string | null;
  bottomOffset?: number;
  onHide: () => void;
}

interface SnackbarBodyProps {
  message: string;
  bottomOffset: number;
  onHide: () => void;
}

const SnackbarBody = React.memo(function SnackbarBody({ message, bottomOffset, onHide }: SnackbarBodyProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true })
        .start(({ finished }) => { if (finished) onHide(); });
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [onHide, opacity]);

  return (
    <Animated.View pointerEvents="none" style={[styles.snackbar, { bottom: bottomOffset, opacity }]}>
      <Feather name="check" size={16} color={Colors.primary} />
      <View style={styles.messageWrap}>
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
});

/**
 * 짧은 알림 띠. 메시지마다 새 인스턴스를 만든다 — `Animated.Value` 를 재사용하며 되돌리면
 * iOS Release 에서 직전 값이 그대로 커밋된다 (`docs/runbooks/ios-native-animated-pitfalls.md`).
 */
export default function Snackbar({ message, bottomOffset = 24, onHide }: SnackbarProps) {
  const handleHide = useCallback(() => onHide(), [onHide]);
  if (message == null) return null;
  return <SnackbarBody key={message} message={message} bottomOffset={bottomOffset} onHide={handleHide} />;
}

const styles = StyleSheet.create({
  snackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0A0A0A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: Layers.modalSheet,
    zIndex: Layers.modalSheet,
  },
  messageWrap: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    color: '#FFFFFF',
  },
});
