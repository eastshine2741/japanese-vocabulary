import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useSettingsStore } from '../stores/settingsStore';
import { userApi } from '../api/userApi';
import { tokenStorage } from '../utils/tokenStorage';
import { resetAllStores } from '../utils/resetAllStores';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import ServerURLDialog from '../components/ServerURLDialog';
import DeleteAccountDialog from '../components/DeleteAccountDialog';
import { AppBar } from '../components/AppBar';
import { TOS_URL, PRIVACY_URL, buildReportMailto } from '../config/legal';
import { isDevBuild } from '../utils/buildEnv';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const {
    status, showIntervals, readingDisplay, showKoreanPronunciation, showFurigana, dailyGoal, isSaving,
    loadSettings, setShowIntervals, setReadingDisplay, setShowKoreanPronunciation, setShowFurigana, setDailyGoal, save,
  } = useSettingsStore(
    useShallow(s => ({
      status: s.status,
      showIntervals: s.showIntervals, readingDisplay: s.readingDisplay,
      showKoreanPronunciation: s.showKoreanPronunciation, showFurigana: s.showFurigana,
      dailyGoal: s.dailyGoal,
      isSaving: s.isSaving, loadSettings: s.loadSettings,
      setShowIntervals: s.setShowIntervals, setReadingDisplay: s.setReadingDisplay,
      setShowKoreanPronunciation: s.setShowKoreanPronunciation, setShowFurigana: s.setShowFurigana,
      setDailyGoal: s.setDailyGoal, save: s.save,
    })),
  );

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [dailyGoalText, setDailyGoalText] = useState(String(dailyGoal));

  useEffect(() => { setDailyGoalText(String(dailyGoal)); }, [dailyGoal]);

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { save(); }, 500);
  }, [save]);

  const handleShowIntervalsChange = useCallback((value: boolean) => {
    setShowIntervals(value); setTimeout(() => save(), 0);
  }, [setShowIntervals, save]);

  const handleShowKoreanPronunciationChange = useCallback((value: boolean) => {
    setShowKoreanPronunciation(value); setTimeout(() => save(), 0);
  }, [setShowKoreanPronunciation, save]);

  const handleShowFuriganaChange = useCallback((value: boolean) => {
    setShowFurigana(value); setTimeout(() => save(), 0);
  }, [setShowFurigana, save]);

  const handleReadingDisplayChange = useCallback((value: 'KATAKANA' | 'HIRAGANA' | 'KOREAN') => {
    setReadingDisplay(value); setTimeout(() => save(), 0);
  }, [setReadingDisplay, save]);

  const handleDailyGoalTextChange = useCallback((text: string) => {
    setDailyGoalText(text.replace(/[^0-9]/g, ''));
  }, []);

  const handleDailyGoalCommit = useCallback(() => {
    const parsed = parseInt(dailyGoalText, 10);
    const next = Number.isFinite(parsed) ? parsed : dailyGoal;
    setDailyGoal(next);
    setDailyGoalText(String(Math.max(1, Math.min(50000, Math.round(next)))));
    debouncedSave();
  }, [dailyGoalText, dailyGoal, setDailyGoal, debouncedSave]);

  const handleLogout = async () => {
    try {
      await GoogleSignin.signOut();
    } catch {
      // ignore — proceed with local logout even if Google session clear fails
    }
    await tokenStorage.clearToken();
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
    requestAnimationFrame(() => resetAllStores());
  };

  const handleDeleteAccount = useCallback(async () => {
    await userApi.deleteSelf();
    try {
      await GoogleSignin.signOut();
    } catch {
      // ignore — local cleanup still proceeds even if Google session clear fails
    }
    await tokenStorage.clearToken();
    setShowDeleteDialog(false);
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
    requestAnimationFrame(() => resetAllStores());
  }, [navigation]);

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar title="설정" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Section title="학습 설정">
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>일일 목표</Text>
              <Text style={styles.description}>매일 리뷰할 카드 수 목표예요.</Text>
            </View>
            <TextInput
              style={styles.numberInput}
              value={dailyGoalText}
              onChangeText={handleDailyGoalTextChange}
              onBlur={handleDailyGoalCommit}
              onSubmitEditing={handleDailyGoalCommit}
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={5}
              selectTextOnFocus
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>다음 복습 시점 노출</Text>
              <Text style={styles.description}>카드 선택지에 다음 복습 예정일을 표시해요.</Text>
            </View>
            <Switch
              value={showIntervals}
              onValueChange={handleShowIntervalsChange}
              trackColor={{ true: Colors.stateRetrievability, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>

          <View style={styles.block}>
            <Text style={styles.label}>읽기 표기 방식</Text>
            <Text style={styles.description}>단어의 읽기(발음)를 어떤 문자로 표시할지 선택해요.</Text>
            <View style={styles.readingOptions}>
              {(['KOREAN', 'HIRAGANA', 'KATAKANA'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.readingOption, readingDisplay === opt && styles.readingOptionActive]}
                  onPress={() => handleReadingDisplayChange(opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.readingOptionText, readingDisplay === opt && styles.readingOptionTextActive]}>
                    {opt === 'KATAKANA' ? 'カタカナ' : opt === 'HIRAGANA' ? 'ひらがな' : '한국어'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>후리가나 표시</Text>
              <Text style={styles.description}>재생 화면에서 한자 위에 히라가나 읽기를 표시해요.</Text>
            </View>
            <Switch
              value={showFurigana}
              onValueChange={handleShowFuriganaChange}
              trackColor={{ true: Colors.stateRetrievability, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>한국어 발음 표시</Text>
              <Text style={styles.description}>재생 화면에서 가사의 한국어 발음을 표시해요.</Text>
            </View>
            <Switch
              value={showKoreanPronunciation}
              onValueChange={handleShowKoreanPronunciationChange}
              trackColor={{ true: Colors.stateRetrievability, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>
        </Section>

        {isSaving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color={Colors.textMuted} />
            <Text style={styles.savingText}>저장 중...</Text>
          </View>
        )}

        {isDevBuild && (
          <Section title="서버 설정">
            <MenuRow
              icon={<Ionicons name="server-outline" size={20} color={Colors.textPrimary} />}
              label="Backend URL"
              onPress={() => setShowServerDialog(true)}
              trailing={<Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
            />
          </Section>
        )}

        <Section title="법적 고지">
          <MenuRow
            icon={<Ionicons name="document-text-outline" size={20} color={Colors.textPrimary} />}
            label="이용약관"
            onPress={() => Linking.openURL(TOS_URL)}
            trailing={<Feather name="external-link" size={16} color={Colors.textMuted} />}
          />
          <MenuRow
            icon={<Ionicons name="shield-checkmark-outline" size={20} color={Colors.textPrimary} />}
            label="개인정보처리방침"
            onPress={() => Linking.openURL(PRIVACY_URL)}
            trailing={<Feather name="external-link" size={16} color={Colors.textMuted} />}
          />
          <MenuRow
            icon={<Ionicons name="cube-outline" size={20} color={Colors.textPrimary} />}
            label="오픈소스 라이선스"
            onPress={() => navigation.navigate('OssLicense')}
            trailing={<Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
          />
          <MenuRow
            icon={<Ionicons name="flag-outline" size={20} color={Colors.textPrimary} />}
            label="권리자 신고"
            onPress={() => Linking.openURL(buildReportMailto())}
            trailing={<Ionicons name="mail-outline" size={16} color={Colors.textMuted} />}
          />
        </Section>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={styles.dangerSection}>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={() => setShowDeleteDialog(true)}
            activeOpacity={0.6}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.accentRed} />
            <Text style={styles.dangerLabel}>계정 삭제</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {isDevBuild && (
        <ServerURLDialog visible={showServerDialog} onClose={() => setShowServerDialog(false)} />
      )}
      <DeleteAccountDialog
        visible={showDeleteDialog}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteAccount}
      />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

interface MenuRowProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  trailing?: React.ReactNode;
}

function MenuRow({ icon, label, onPress, trailing }: MenuRowProps) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
      {icon}
      <Text style={styles.menuLabel}>{label}</Text>
      {trailing}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 24, paddingBottom: 40, gap: 28 },

  section: { gap: 8 },
  sectionLabel: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  rowText: { flex: 1 },
  block: { paddingVertical: 14, gap: 6 },
  label: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  description: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },

  numberInput: {
    minWidth: 64, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, backgroundColor: Colors.card,
    fontSize: 16, fontWeight: '700', color: Colors.textPrimary,
    textAlign: 'center', fontVariant: ['tabular-nums'],
  },

  savingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  savingText: { fontSize: 12, color: Colors.textMuted, marginLeft: 6 },

  readingOptions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  readingOption: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.card, alignItems: 'center' },
  readingOptionActive: { backgroundColor: Colors.primary },
  readingOptionText: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  readingOptionTextActive: { color: '#FFFFFF' },

  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  menuLabel: { flex: 1, fontSize: 15, color: Colors.textPrimary },

  logoutButton: { alignItems: 'center', marginTop: 20, paddingVertical: 12 },
  logoutText: { fontSize: 14, color: Colors.textMuted },

  dangerSection: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  dangerLabel: { flex: 1, fontSize: 15, color: Colors.accentRed, fontWeight: '500' },
});
