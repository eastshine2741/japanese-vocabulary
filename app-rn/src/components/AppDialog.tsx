import React, { useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { Colors } from '../theme/theme';

export interface DialogButton {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface Props {
  visible: boolean;
  title: string;
  body: string;
  buttons: DialogButton[];
}

export default function AppDialog({ visible, title, body, buttons }: Props) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const dialogScale = useRef(new Animated.Value(0.85)).current;
  const dialogOpacity = useRef(new Animated.Value(0)).current;
  const isAnimatingOut = useRef(false);

  useEffect(() => {
    if (visible) {
      isAnimatingOut.current = false;
      overlayOpacity.setValue(0);
      dialogScale.setValue(0.85);
      dialogOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(dialogScale, {
          toValue: 1,
          delay: 60,
          useNativeDriver: true,
          tension: 65,
          friction: 10,
        }),
        Animated.timing(dialogOpacity, {
          toValue: 1,
          duration: 150,
          delay: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const animateOut = useCallback((callback: () => void) => {
    if (isAnimatingOut.current) return;
    isAnimatingOut.current = true;

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(dialogOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(dialogScale, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => callback());
  }, []);

  const handlePress = useCallback((onPress: () => void) => {
    animateOut(onPress);
  }, [animateOut]);

  const btnStyle = (variant: DialogButton['variant']) => {
    switch (variant) {
      case 'danger':
        return styles.btnDanger;
      case 'secondary':
        return styles.btnSecondary;
      default:
        return styles.btnPrimary;
    }
  };

  const btnTextStyle = (variant: DialogButton['variant']) => {
    switch (variant) {
      case 'danger':
        return styles.btnDangerText;
      case 'secondary':
        return styles.btnSecondaryText;
      default:
        return styles.btnPrimaryText;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => handlePress(buttons[0].onPress)}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Animated.View
          style={[
            styles.dialog,
            { opacity: dialogOpacity, transform: [{ scale: dialogScale }] },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.btns}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.btn, btnStyle(btn.variant)]}
                onPress={() => handlePress(btn.onPress)}
                activeOpacity={0.7}
              >
                <Text style={btnTextStyle(btn.variant)}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dialog: {
    width: 320,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 28,
    paddingBottom: 20,
    gap: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  btns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  btnSecondary: { backgroundColor: Colors.elevated },
  btnSecondaryText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  btnDanger: { backgroundColor: '#EF4444' },
  btnDangerText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
