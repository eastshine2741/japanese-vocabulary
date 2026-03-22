import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettingsStore } from '../../stores/settingsStore';
import { tokenStorage } from '../../utils/tokenStorage';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MyPageTab() {
  const navigation = useNavigation<Nav>();
  const {
    status, requestRetention, showIntervals, isSaving,
    loadSettings, setRetention, setShowIntervals, save,
  } = useSettingsStore();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      save();
    }, 500);
  }, [save]);

  const handleRetentionChange = useCallback((value: number) => {
    setRetention(value);
    debouncedSave();
  }, [setRetention, debouncedSave]);

  const handleShowIntervalsChange = useCallback((value: boolean) => {
    setShowIntervals(value);
    // Toggle saves immediately (no need to debounce)
    setTimeout(() => save(), 0);
  }, [setShowIntervals, save]);

  const handleLogout = async () => {
    await tokenStorage.clearToken();
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }),
    );
  };

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>마이페이지</Text>
      <Text style={styles.subtitle}>계정 및 학습 설정을 관리하세요</Text>

      {/* Profile Card */}
      <TouchableOpacity style={styles.profileCard} activeOpacity={0.7}>
        <View style={styles.profileAvatar}>
          <Ionicons name="person" size={24} color={Colors.textMuted} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>사용자</Text>
          <Text style={styles.profileEmail}>학습 중</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* 계정 관리 Section */}
      <Text style={styles.sectionLabel}>계정 관리</Text>
      <View style={styles.menuCard}>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Ionicons name="person-outline" size={20} color={Colors.textPrimary} />
          <Text style={styles.menuItemLabel}>프로필 수정</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.menuSeparator} />
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Ionicons name="lock-closed-outline" size={20} color={Colors.textPrimary} />
          <Text style={styles.menuItemLabel}>비밀번호 변경</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* 학습 설정 Section */}
      <Text style={styles.sectionLabel}>학습 설정</Text>
      <View style={styles.settingsCard}>
        {/* Target Retrievability */}
        <View style={styles.settingBlock}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>목표 Retrievability</Text>
            <Text style={styles.retrievabilityValue}>
              {requestRetention.toFixed(2)}
            </Text>
          </View>
          <Text style={styles.settingDescription}>
            FSRS 알고리즘의 목표 기억 유지율입니다. 높을수록 복습 주기가 짧아집니다.
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.70}
            maximumValue={0.99}
            step={0.01}
            value={requestRetention}
            onValueChange={handleRetentionChange}
            minimumTrackTintColor={Colors.stateRetrievability}
            maximumTrackTintColor={Colors.border}
            thumbTintColor={Colors.stateRetrievability}
          />
        </View>

        <View style={styles.menuSeparator} />

        {/* Show Intervals Toggle */}
        <View style={styles.settingBlock}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextBlock}>
              <Text style={styles.settingLabel}>다음 복습 시점 노출</Text>
              <Text style={styles.settingDescription}>
                카드 선택지에 다음 복습 예정일을 표시합니다
              </Text>
            </View>
            <Switch
              value={showIntervals}
              onValueChange={handleShowIntervalsChange}
              trackColor={{ true: Colors.stateRetrievability, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>
        </View>
      </View>

      {/* Saving indicator */}
      {isSaving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={Colors.textMuted} />
          <Text style={styles.savingText}>저장 중...</Text>
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  content: {
    padding: Dimens.screenPadding,
    paddingBottom: 40,
  },

  // Header
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1.5,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 24,
  },

  // Profile Card
  profileCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Dimens.cardCornerRadius,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Section Label
  sectionLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Menu Card
  menuCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Dimens.cardCornerRadius,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  menuSeparator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },

  // Settings Card
  settingsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Dimens.cardCornerRadius,
    overflow: 'hidden',
  },
  settingBlock: {
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingTextBlock: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
  retrievabilityValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.stateRetrievability,
  },
  slider: {
    marginTop: 12,
    marginHorizontal: -4,
  },

  // Saving indicator
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  savingText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 6,
  },

  // Logout
  logoutButton: {
    alignItems: 'center',
    marginTop: 40,
    paddingVertical: 12,
  },
  logoutText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
