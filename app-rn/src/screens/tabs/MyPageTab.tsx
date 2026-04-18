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
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '../../stores/settingsStore';
import { tokenStorage } from '../../utils/tokenStorage';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import ServerURLEditor from '../../components/ServerURLEditor';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MyPageTab() {
  const navigation = useNavigation<Nav>();
  const {
    status, requestRetention, showIntervals, readingDisplay, showKoreanPronunciation, showFurigana, isSaving,
    loadSettings, setRetention, setShowIntervals, setReadingDisplay, setShowKoreanPronunciation, setShowFurigana, save,
  } = useSettingsStore(
    useShallow(s => ({
      status: s.status, requestRetention: s.requestRetention,
      showIntervals: s.showIntervals, readingDisplay: s.readingDisplay,
      showKoreanPronunciation: s.showKoreanPronunciation, showFurigana: s.showFurigana,
      isSaving: s.isSaving, loadSettings: s.loadSettings, setRetention: s.setRetention,
      setShowIntervals: s.setShowIntervals, setReadingDisplay: s.setReadingDisplay,
      setShowKoreanPronunciation: s.setShowKoreanPronunciation, setShowFurigana: s.setShowFurigana, save: s.save,
    })),
  );

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

  const handleShowKoreanPronunciationChange = useCallback((value: boolean) => {
    setShowKoreanPronunciation(value);
    setTimeout(() => save(), 0);
  }, [setShowKoreanPronunciation, save]);

  const handleShowFuriganaChange = useCallback((value: boolean) => {
    setShowFurigana(value);
    setTimeout(() => save(), 0);
  }, [setShowFurigana, save]);

  const handleReadingDisplayChange = useCallback((value: 'KATAKANA' | 'HIRAGANA' | 'KOREAN') => {
    setReadingDisplay(value);
    setTimeout(() => save(), 0);
  }, [setReadingDisplay, save]);

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

        {/* Reading Display */}
        <View style={styles.settingBlock}>
          <Text style={styles.settingLabel}>읽기 표기 방식</Text>
          <Text style={styles.settingDescription}>
            단어의 읽기(발음)를 어떤 문자로 표시할지 선택합니다
          </Text>
          <View style={styles.readingOptions}>
            {(['KATAKANA', 'HIRAGANA', 'KOREAN'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.readingOption,
                  readingDisplay === opt && styles.readingOptionActive,
                ]}
                onPress={() => handleReadingDisplayChange(opt)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.readingOptionText,
                  readingDisplay === opt && styles.readingOptionTextActive,
                ]}>
                  {opt === 'KATAKANA' ? 'カタカナ' : opt === 'HIRAGANA' ? 'ひらがな' : '한국어'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Furigana Toggle */}
        <View style={styles.settingBlock}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextBlock}>
              <Text style={styles.settingLabel}>후리가나 표시</Text>
              <Text style={styles.settingDescription}>
                재생 화면에서 한자 위에 히라가나 읽기를 표시합니다
              </Text>
            </View>
            <Switch
              value={showFurigana}
              onValueChange={handleShowFuriganaChange}
              trackColor={{ true: Colors.stateRetrievability, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>
        </View>

        {/* Korean Pronunciation Toggle */}
        <View style={styles.settingBlock}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextBlock}>
              <Text style={styles.settingLabel}>한국어 발음 표시</Text>
              <Text style={styles.settingDescription}>
                재생 화면에서 가사의 한국어 발음을 표시합니다
              </Text>
            </View>
            <Switch
              value={showKoreanPronunciation}
              onValueChange={handleShowKoreanPronunciationChange}
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

      {/* 서버 설정 (Debug) */}
      <Text style={styles.sectionLabel}>서버 설정</Text>
      <View style={styles.settingsCard}>
        <ServerURLEditor />
      </View>

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
    backgroundColor: Colors.card,
  },
  scrollView: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  content: {
    padding: 12,
    paddingBottom: 12 + Dimens.bottomBarHeight + 40,
    gap: 12,
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
    backgroundColor: Colors.background,
    borderRadius: 24,
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
    marginTop: 4,
    marginBottom: -4,
    marginLeft: 4,
  },

  // Menu Card
  menuCard: {
    backgroundColor: Colors.background,
    borderRadius: 24,
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
    backgroundColor: Colors.background,
    borderRadius: 24,
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

  // Reading display options
  readingOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  readingOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: 'center',
  },
  readingOptionActive: {
    backgroundColor: Colors.primary,
  },
  readingOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  readingOptionTextActive: {
    color: '#FFFFFF',
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
