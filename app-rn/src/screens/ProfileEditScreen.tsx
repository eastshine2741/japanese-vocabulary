import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { userApi } from '../api/userApi';
import { authApi, UsernameAvailabilityReason } from '../api/authApi';
import { Colors } from '../theme/theme';
import { AppBar } from '../components/AppBar';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const NAME_MAX = 20;
const USERNAME_MAX = 20;
const CHECK_DEBOUNCE_MS = 300;

type UsernameState =
  | { kind: 'unchanged' }
  | { kind: 'invalid' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'unavailable'; reason: UsernameAvailabilityReason };

const REASON_HINT: Record<UsernameAvailabilityReason, string> = {
  INVALID_FORMAT: '영문 소문자/숫자/_ 3~20자만 사용할 수 있어요',
  RESERVED: '사용할 수 없는 username 이에요',
  TAKEN: '이미 사용 중인 username 이에요',
};

export default function ProfileEditScreen({ navigation }: Props) {
  const { username, userName, setUserName, setUsername } = useAuthStore(
    useShallow((s) => ({
      username: s.username,
      userName: s.userName,
      setUserName: s.setUserName,
      setUsername: s.setUsername,
    })),
  );

  const initialUsername = username ?? '';
  const initialName = userName ?? '';

  const [nameInput, setNameInput] = useState(initialName);
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [usernameState, setUsernameState] = useState<UsernameState>({ kind: 'unchanged' });
  const [focusedField, setFocusedField] = useState<'name' | 'username' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleUsernameChange = (raw: string) => {
    const next = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX);
    setUsernameInput(next);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next === initialUsername) {
      setUsernameState({ kind: 'unchanged' });
      return;
    }
    if (!USERNAME_REGEX.test(next)) {
      setUsernameState({ kind: 'invalid' });
      return;
    }

    setUsernameState({ kind: 'checking' });
    const seq = ++checkSeqRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await authApi.checkUsername(next);
        if (seq !== checkSeqRef.current) return;
        if (res.available) {
          setUsernameState({ kind: 'available' });
        } else {
          setUsernameState({
            kind: 'unavailable',
            reason: (res.reason ?? 'INVALID_FORMAT') as UsernameAvailabilityReason,
          });
        }
      } catch {
        if (seq !== checkSeqRef.current) return;
        setUsernameState({ kind: 'unchanged' });
      }
    }, CHECK_DEBOUNCE_MS);
  };

  const trimmedName = nameInput.trim();
  const nameDirty = trimmedName !== initialName.trim();
  const usernameDirty = usernameInput !== initialUsername;
  const usernameOk =
    usernameState.kind === 'unchanged' || usernameState.kind === 'available';
  const canSave = (nameDirty || usernameDirty) && usernameOk && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const payload: { name?: string | null; username?: string } = {};
      if (nameDirty) payload.name = trimmedName === '' ? null : trimmedName;
      if (usernameDirty) payload.username = usernameInput;
      const res = await userApi.updateProfile(payload);
      await setUserName(res.name);
      await setUsername(res.username);
      navigation.goBack();
    } catch (e: any) {
      setError(e.response?.data?.message || '저장에 실패했어요');
      setSaving(false);
    }
  };

  const usernameHasError =
    usernameState.kind === 'invalid' || usernameState.kind === 'unavailable';
  const usernameFocused = focusedField === 'username';
  const usernameBorder = usernameHasError
    ? Colors.ratingAgain
    : usernameFocused
    ? Colors.primary
    : Colors.border;
  const usernameBorderWidth = usernameHasError || usernameFocused ? 1.5 : 1;
  const usernameIconColor = usernameFocused ? Colors.primary : Colors.textMuted;

  const usernameHelper = (() => {
    if (usernameState.kind === 'invalid') return REASON_HINT.INVALID_FORMAT;
    if (usernameState.kind === 'unavailable') return REASON_HINT[usernameState.reason];
    if (usernameState.kind === 'available') return '사용 가능한 유저네임이에요';
    return null;
  })();
  const usernameHelperColor =
    usernameState.kind === 'available'
      ? Colors.ratingGood
      : usernameHasError
      ? Colors.ratingAgain
      : Colors.textMuted;

  const nameFocused = focusedField === 'name';
  const nameBorder = nameFocused ? Colors.primary : Colors.border;
  const nameBorderWidth = nameFocused ? 1.5 : 1;
  const nameIconColor = nameFocused ? Colors.primary : Colors.textMuted;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <AppBar
          title="프로필 수정"
          onBack={() => navigation.goBack()}
          trailing={
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={styles.headerBtn}
              hitSlop={8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={[styles.saveLabel, !canSave && styles.saveLabelDisabled]}>저장</Text>
              )}
            </Pressable>
          }
        />

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>유저네임</Text>
              <View
                style={[
                  styles.inputBox,
                  { borderColor: usernameBorder, borderWidth: usernameBorderWidth },
                ]}
              >
                <Ionicons name="at" size={18} color={usernameIconColor} />
                <TextInput
                  value={usernameInput}
                  onChangeText={handleUsernameChange}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField((f) => (f === 'username' ? null : f))}
                  placeholder="username"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.inputText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  maxLength={USERNAME_MAX}
                />
                {usernameState.kind === 'checking' && (
                  <ActivityIndicator size="small" color={Colors.textMuted} />
                )}
                {usernameState.kind === 'available' && (
                  <Ionicons name="checkmark" size={18} color={Colors.ratingGood} />
                )}
                {usernameHasError && (
                  <Ionicons name="alert-circle" size={18} color={Colors.ratingAgain} />
                )}
              </View>
              <View style={styles.metaRow}>
                {usernameHelper ? (
                  <Text style={[styles.helper, { color: usernameHelperColor }]}>{usernameHelper}</Text>
                ) : (
                  <View />
                )}
                <Text style={styles.counter}>{`${usernameInput.length}/${USERNAME_MAX}`}</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>표시 이름</Text>
              <View
                style={[
                  styles.inputBox,
                  { borderColor: nameBorder, borderWidth: nameBorderWidth },
                ]}
              >
                <Ionicons name="person-outline" size={18} color={nameIconColor} />
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField((f) => (f === 'name' ? null : f))}
                  placeholder="이름을 입력하세요"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.inputText}
                  maxLength={NAME_MAX}
                />
              </View>
              <View style={styles.metaRow}>
                <View />
                <Text style={styles.counter}>{`${nameInput.length}/${NAME_MAX}`}</Text>
              </View>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  headerBtn: {
    minWidth: 56,
    height: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  saveLabelDisabled: { color: Colors.textMuted },

  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  form: { gap: 24 },

  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputText: { flex: 1, fontSize: 15, color: Colors.textPrimary, padding: 0 },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  counter: { fontSize: 12, color: Colors.textMuted },
  helper: { fontSize: 12 },

  error: { fontSize: 13, color: Colors.ratingAgain, textAlign: 'center' },
});
