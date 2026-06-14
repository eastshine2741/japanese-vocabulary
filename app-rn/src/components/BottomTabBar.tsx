import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

type TabKey = 'Home' | 'Search' | 'MyPage';

// Icon glyph is always the brand green; the active tab is distinguished by the
// filled glyph + primary label color (inactive uses the outline glyph + muted
// label). This mirrors the Pencil design where tab.*.iconFill is fixed to the
// accent regardless of selection.
const TAB_CONFIG: Record<TabKey, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap; label: string }> = {
  Home: { active: 'home', inactive: 'home-outline', label: '홈' },
  Search: { active: 'search', inactive: 'search-outline', label: '검색' },
  MyPage: { active: 'person', inactive: 'person-outline', label: '마이' },
};

export default function BottomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: 56 + insets.bottom }]}>
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
            style={styles.tab}
          >
            <Ionicons
              name={focused ? config.active : config.inactive}
              size={20}
              color={Colors.primary}
            />
            <Text style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>
              {config.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: Colors.textPrimary,
  },
  labelInactive: {
    color: Colors.textMuted,
  },
});
