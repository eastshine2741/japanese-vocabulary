import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Dimens } from '../theme/theme';
import { useHomeChromeStore } from '../stores/homeChromeStore';
import SearchFilledIcon from './SearchFilledIcon';

type TabKey = 'Home' | 'Search' | 'MyPage';

const DarkPalette = {
  bar: '#14181C',
  border: '#FFFFFF1F',
  iconActive: '#FFFFFF',
  iconInactive: '#FFFFFF80',
};

// Icon glyph is always the brand green; the active tab is distinguished by the
// filled glyph alone (inactive uses the outline glyph). This mirrors the Pencil
// design where tab.*.iconFill is fixed to the accent regardless of selection.
const TAB_CONFIG: Record<TabKey, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  // Ionicons `search` is the same outline as `search-outline`; the active
  // glyph is drawn by SearchFilledIcon instead (see below).
  Search: { active: 'search', inactive: 'search-outline' },
  MyPage: { active: 'person', inactive: 'person-outline' },
};

const ICON_SIZE = 24;

export default function BottomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const homeIsDark = useHomeChromeStore((s) => s.isDark);
  const activeRouteName = state.routes[state.index]?.name as TabKey | undefined;
  const isDark = activeRouteName === 'Home' && homeIsDark;

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: insets.bottom, height: Dimens.bottomBarHeight + insets.bottom },
        isDark && styles.barDark,
      ]}
    >
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

        const iconColor = isDark
          ? focused
            ? DarkPalette.iconActive
            : DarkPalette.iconInactive
          : Colors.primary;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.tab}
          >
            {route.name === 'Search' && focused ? (
              <SearchFilledIcon size={ICON_SIZE} color={iconColor} />
            ) : (
              <Ionicons
                name={focused ? config.active : config.inactive}
                size={ICON_SIZE}
                color={iconColor}
              />
            )}
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
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barDark: {
    backgroundColor: DarkPalette.bar,
    borderTopColor: DarkPalette.border,
  },
});
