import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

type TabKey = 'Home' | 'Words' | 'MyPage';

const TAB_CONFIG: Record<TabKey, { icon: keyof typeof Feather.glyphMap; label: string }> = {
  Home: { icon: 'home', label: '홈' },
  Words: { icon: 'book-open', label: '단어' },
  MyPage: { icon: 'user', label: '마이' },
};

export default function PillTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

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

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={[styles.tab, focused && styles.tabActive]}
            >
              <Feather
                name={config.icon}
                size={18}
                color={focused ? '#FFFFFF' : Colors.textMuted}
              />
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
    backgroundColor: Colors.card,
    borderRadius: 100,
    height: 62,
    padding: 4,
    gap: 4,
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
    color: '#FFFFFF',
    fontWeight: '600',
  },
  labelInactive: {
    color: Colors.textMuted,
    fontWeight: '500',
  },
});
