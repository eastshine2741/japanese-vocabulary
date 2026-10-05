import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

export default function KaraokeNewSongsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('daily');

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

      <View style={styles.tabs}>
        {TABS.map(({ key, label }) => (
          <TabButton key={key} tabKey={key} label={label} active={tab === key} onSelect={setTab} />
        ))}
      </View>

      {tab === 'daily' ? (
        <KaraokeDailyList onSelectSong={handleSelectSong} paddingBottom={paddingBottom} />
      ) : (
        <KaraokeMonthlyList onSelectSong={handleSelectSong} paddingBottom={paddingBottom} />
      )}
    </SafeAreaView>
  );
}

interface TabButtonProps {
  tabKey: Tab;
  label: string;
  active: boolean;
  onSelect: (tab: Tab) => void;
}

const TabButton = React.memo(function TabButton({ tabKey, label, active, onSelect }: TabButtonProps) {
  const handlePress = useCallback(() => onSelect(tabKey), [onSelect, tabKey]);

  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={handlePress}
      activeOpacity={0.72}
    >
      <Text style={active ? styles.tabLabelActive : styles.tabLabel}>{label}</Text>
    </TouchableOpacity>
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
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
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
});
