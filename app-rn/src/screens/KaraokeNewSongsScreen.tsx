import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  NavigationState,
  SceneRendererProps,
  TabBar,
  TabDescriptor,
  TabView,
} from 'react-native-tab-view';
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

interface TabRoute {
  key: 'daily' | 'monthly';
  title: string;
}

const ROUTES: TabRoute[] = [
  { key: 'daily', title: '날짜별' },
  { key: 'monthly', title: '월별 몰아보기' },
];

const TAB_OPTIONS: TabDescriptor<TabRoute> = {
  label: ({ route, focused }) => (
    <Text style={focused ? styles.tabLabelActive : styles.tabLabel}>{route.title}</Text>
  ),
};

type TabBarProps = SceneRendererProps & {
  navigationState: NavigationState<TabRoute>;
  options: Record<string, TabDescriptor<TabRoute>> | undefined;
};

function renderTabBar(props: TabBarProps) {
  return (
    <TabBar
      {...props}
      scrollEnabled
      gap={15}
      style={styles.tabBar}
      contentContainerStyle={styles.tabBarContent}
      tabStyle={styles.tab}
      indicatorStyle={styles.indicator}
      pressColor="transparent"
      pressOpacity={0.72}
    />
  );
}

export default function KaraokeNewSongsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const layout = useWindowDimensions();
  const [index, setIndex] = useState(0);

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
    if (ROUTES[index].key === 'monthly' && monthlyStatus === 'idle') loadMonthly(monthlyMonth);
  }, [index, monthlyStatus, monthlyMonth, loadMonthly]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleSelectSong = useCallback(
    (songId: number) => {
      navigation.navigate('SongDetail', { songId, origin: 'karaoke_new_songs' });
    },
    [navigation],
  );

  const paddingBottom = insets.bottom + 24;
  const navigationState = useMemo(() => ({ index, routes: ROUTES }), [index]);
  const initialLayout = useMemo(() => ({ width: layout.width }), [layout.width]);

  const renderScene = useCallback(
    ({ route }: { route: TabRoute }) =>
      route.key === 'daily' ? (
        <KaraokeDailyList onSelectSong={handleSelectSong} paddingBottom={paddingBottom} />
      ) : (
        <KaraokeMonthlyList onSelectSong={handleSelectSong} paddingBottom={paddingBottom} />
      ),
    [handleSelectSong, paddingBottom],
  );

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

      <TabView
        navigationState={navigationState}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        commonOptions={TAB_OPTIONS}
        onIndexChange={setIndex}
        initialLayout={initialLayout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  trailing: {
    paddingRight: 8,
  },
  tabBar: {
    backgroundColor: Colors.surface,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBarContent: {
    paddingHorizontal: Dimens.screenPadding,
  },
  tab: {
    width: 'auto',
    minHeight: 43,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  tabLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
    ...fontStyle('body', '600'),
  },
  indicator: {
    height: 2,
    backgroundColor: Colors.primary,
  },
});
