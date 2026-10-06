import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { AppBar } from '../components/AppBar';
import KaraokeDailyList from '../components/karaoke/KaraokeDailyList';
import KaraokeMonthlyList from '../components/karaoke/KaraokeMonthlyList';
import { KaraokeNotifyToggle } from '../components/karaoke/KaraokeNotifyToggle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useKaraokeStore } from '../stores/karaokeStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Colors, Dimens } from '../theme/theme';
import { fontStyle } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'KaraokeNewSongs'>;

type Tab = 'daily' | 'monthly';

const TABS: { key: Tab; label: string }[] = [
  { key: 'daily', label: '날짜별' },
  { key: 'monthly', label: '월별 몰아보기' },
];

const TAB_TRANSITION_MS = 260;

interface TabLayout {
  x: number;
  width: number;
}

export default function KaraokeNewSongsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('daily');
  const tabProgress = useRef(new Animated.Value(0)).current;

  const { monthlyStatus, monthlyMonth, loadDaily, loadMonthly } = useKaraokeStore(
    useShallow((s) => ({
      monthlyStatus: s.monthly.status,
      monthlyMonth: s.monthly.month,
      loadDaily: s.loadDaily,
      loadMonthly: s.loadMonthly,
    })),
  );

  const { karaokeNotificationsEnabled, settingsStatus, loadSettings, toggleKaraokeNotifications } = useSettingsStore(
    useShallow((s) => ({
      karaokeNotificationsEnabled: s.karaokeNewSongNotifications,
      settingsStatus: s.status,
      loadSettings: s.loadSettings,
      toggleKaraokeNotifications: s.toggleKaraokeNewSongNotifications,
    })),
  );

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  // status 를 의존성에 두면 실패할 때마다 다시 불러 무한히 재시도한다. 진입할 때 한 번만 읽는다.
  useEffect(() => {
    if (useSettingsStore.getState().status !== 'loaded') loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (tab === 'monthly' && monthlyStatus === 'idle') loadMonthly(monthlyMonth);
  }, [tab, monthlyStatus, monthlyMonth, loadMonthly]);

  useEffect(() => {
    Animated.timing(tabProgress, {
      toValue: tab === 'monthly' ? 1 : 0,
      duration: TAB_TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, tabProgress]);

  const contentTranslate = useMemo(
    () => tabProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -screenWidth],
      extrapolate: 'clamp',
    }),
    [screenWidth, tabProgress],
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleSelectSong = useCallback(
    (songId: number) => {
      navigation.navigate('SongDetail', { songId, origin: 'karaoke_new_songs' });
    },
    [navigation],
  );

  const paddingBottom = insets.bottom + 24;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppBar
        title="노래방 신곡"
        onBack={handleBack}
        trailing={
          <View style={styles.trailing}>
            <KaraokeNotifyToggle
              enabled={karaokeNotificationsEnabled}
              onPress={toggleKaraokeNotifications}
              disabled={settingsStatus === 'loading'}
            />
          </View>
        }
      />

      <KaraokeTabs tab={tab} tabProgress={tabProgress} onSelect={setTab} />

      <View style={styles.viewport}>
        <Animated.View
          style={[styles.rail, { width: screenWidth * 2, transform: [{ translateX: contentTranslate }] }]}
        >
          <View pointerEvents={tab === 'daily' ? 'auto' : 'none'} style={{ width: screenWidth }}>
            <KaraokeDailyList onSelectSong={handleSelectSong} paddingBottom={paddingBottom} />
          </View>
          <View pointerEvents={tab === 'monthly' ? 'auto' : 'none'} style={{ width: screenWidth }}>
            <KaraokeMonthlyList onSelectSong={handleSelectSong} paddingBottom={paddingBottom} />
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

interface KaraokeTabsProps {
  tab: Tab;
  tabProgress: Animated.Value;
  onSelect: (tab: Tab) => void;
}

const KaraokeTabs = React.memo(function KaraokeTabs({ tab, tabProgress, onSelect }: KaraokeTabsProps) {
  const [layouts, setLayouts] = useState<Partial<Record<Tab, TabLayout>>>({});

  const handleTabLayout = useCallback((key: Tab, layout: TabLayout) => {
    setLayouts((prev) => {
      const current = prev[key];
      return current && current.x === layout.x && current.width === layout.width
        ? prev
        : { ...prev, [key]: layout };
    });
  }, []);

  const daily = layouts.daily;
  const monthly = layouts.monthly;

  // 탭 폭이 달라 width 대신 1px 막대를 scaleX 로 늘린다 (width 는 native driver 로 못 움직인다).
  const indicatorTransform = useMemo(() => {
    if (!daily || !monthly) return null;
    return [
      {
        translateX: tabProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [daily.x + daily.width / 2 - 0.5, monthly.x + monthly.width / 2 - 0.5],
          extrapolate: 'clamp',
        }),
      },
      {
        scaleX: tabProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [daily.width, monthly.width],
          extrapolate: 'clamp',
        }),
      },
    ];
  }, [daily, monthly, tabProgress]);

  return (
    <View style={styles.tabs}>
      {TABS.map(({ key, label }, index) => (
        <TabButton
          key={key}
          tabKey={key}
          label={label}
          index={index}
          active={tab === key}
          tabProgress={tabProgress}
          onSelect={onSelect}
          onTabLayout={handleTabLayout}
        />
      ))}
      {indicatorTransform ? (
        <Animated.View pointerEvents="none" style={[styles.indicator, { transform: indicatorTransform }]} />
      ) : null}
    </View>
  );
});

interface TabButtonProps {
  tabKey: Tab;
  label: string;
  index: number;
  active: boolean;
  tabProgress: Animated.Value;
  onSelect: (tab: Tab) => void;
  onTabLayout: (tab: Tab, layout: TabLayout) => void;
}

const TabButton = React.memo(function TabButton({
  tabKey,
  label,
  index,
  active,
  tabProgress,
  onSelect,
  onTabLayout,
}: TabButtonProps) {
  const handlePress = useCallback(() => onSelect(tabKey), [onSelect, tabKey]);
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => onTabLayout(tabKey, { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width }),
    [onTabLayout, tabKey],
  );

  const activeOpacity = useMemo(
    () => tabProgress.interpolate({
      inputRange: [0, 1],
      outputRange: index === 0 ? [1, 0] : [0, 1],
      extrapolate: 'clamp',
    }),
    [index, tabProgress],
  );
  const inactiveOpacity = useMemo(
    () => tabProgress.interpolate({
      inputRange: [0, 1],
      outputRange: index === 0 ? [0, 1] : [1, 0],
      extrapolate: 'clamp',
    }),
    [index, tabProgress],
  );

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={styles.tab}
      onPress={handlePress}
      onLayout={handleLayout}
    >
      <Animated.Text style={[styles.tabLabel, { opacity: inactiveOpacity }]}>{label}</Animated.Text>
      <Animated.Text style={[styles.tabLabel, styles.tabLabelActive, styles.tabLabelOverlay, { opacity: activeOpacity }]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  trailing: {
    paddingRight: 8,
  },
  tabs: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 15,
    paddingHorizontal: Dimens.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.textPrimary,
    ...fontStyle('body', '600'),
  },
  tabLabelOverlay: {
    position: 'absolute',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 1,
    height: 2,
    backgroundColor: Colors.primary,
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  rail: {
    flex: 1,
    flexDirection: 'row',
  },
});
