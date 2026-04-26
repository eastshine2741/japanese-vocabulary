import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { flashcardApi } from '../api/flashcardApi';
import { Colors } from '../theme/theme';

type TabKey = 'Home' | 'Words' | 'MyPage';

const TAB_CONFIG: Record<TabKey, { icon: keyof typeof Feather.glyphMap; label: string }> = {
  Home: { icon: 'home', label: '홈' },
  Words: { icon: 'book-open', label: '단어' },
  MyPage: { icon: 'user', label: '마이' },
};

export default function PillTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [dueCount, setDueCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      flashcardApi.getStats().then((s) => setDueCount(s.due)).catch(() => {});
    }, [])
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.pill}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const config = TAB_CONFIG[route.name as TabKey];
          if (!config) return null;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const showBadge = route.name === 'Words' && dueCount > 0;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={[styles.tab, focused && styles.tabActive]}
            >
              <View>
                <Feather
                  name={config.icon}
                  size={18}
                  color={focused ? Colors.background : Colors.textMuted}
                />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{dueCount > 99 ? '99+' : dueCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 21,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 100,
    height: 62,
    padding: 4,
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
  labelActive: {
    color: Colors.background,
    fontWeight: '600',
  },
  labelInactive: {
    color: Colors.textMuted,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: Colors.accentRed,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.background,
    fontSize: 9,
    fontWeight: '700',
  },
});
