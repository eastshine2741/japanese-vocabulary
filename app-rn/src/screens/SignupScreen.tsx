import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '../stores/authStore';
import { authApi, UsernameAvailabilityReason } from '../api/authApi';
import { TOS_URL, PRIVACY_URL } from '../config/legal';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const CHECK_DEBOUNCE_MS = 300;

type UsernameState =
  | { kind: 'idle' }
  | { kind: 'invalid' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'unavailable'; reason: UsernameAvailabilityReason };

const REASON_HINT: Record<UsernameAvailabilityReason, string> = {
  INVALID_FORMAT: '영문 소문자/숫자/_ 3~20자만 사용할 수 있어요',
  RESERVED: '사용할 수 없는 username 이에요',
  TAKEN: '이미 사용 중인 username 이에요',
};

const DEFAULT_HINT = '영문/숫자/_ 3~20자';

export default function SignupScreen({ navigation, route }: Props) {
  const { idToken, email } = route.params;

  const { status, error, googleSignup, reset } = useAuthStore(
    useShallow((s) => ({
      status: s.status,
      error: s.error,
      googleSignup: s.googleSignup,
      reset: s.reset,
    })),
  );

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameState, setUsernameState] = useState<UsernameState>({ kind: 'idle' });
  const [focusedField, setFocusedField] = useState<'username' | 'name' | null>(null);

  const checkSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === 'success') {
      reset();
      navigation.replace('Main');
    }
  }, [status]);

  const handleBack = useCallback(async () => {
    try {
      await GoogleSignin.signOut();
    } catch {
      // ignore
    }
    reset();
    // Login navigated here with `replace`, so there's nothing to pop back to —
    // route to Login explicitly instead of `goBack()`.
    navigation.replace('Login');
  }, [navigation, reset]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
    }, [handleBack]),
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleUsernameChange = (raw: string) => {
    const next = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    setUsername(next);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next.length === 0) {
      setUsernameState({ kind: 'idle' });
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
        setUsernameState({ kind: 'idle' });
      }
    }, CHECK_DEBOUNCE_MS);
  };

  const submitting = status === 'loading';
  const canSubmit = usernameState.kind === 'available' && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    Keyboard.dismiss();
    await googleSignup(idToken, username, displayName.trim() || undefined);
  };

  const usernameHasError =
    usernameState.kind === 'invalid' || usernameState.kind === 'unavailable';
  const usernameFocused = focusedField === 'username';
  // 'available' is signalled by the checkmark — don't paint the border when unfocused,
  // otherwise both fields look selected once focus moves to 이름.
  const usernameBorder = usernameHasError
    ? Colors.ratingAgain
    : usernameFocused
    ? Colors.primary
    : Colors.border;
  const usernameBorderWidth = usernameHasError || usernameFocused ? 1.5 : 1;
  const usernameIconColor = usernameFocused ? Colors.primary : Colors.textMuted;

  const nameFocused = focusedField === 'name';
  const nameBorder = nameFocused ? Colors.primary : Colors.border;
  const nameBorderWidth = nameFocused ? 1.5 : 1;
  const nameIconColor = nameFocused ? Colors.primary : Colors.textMuted;

  const usernameHint =
    usernameState.kind === 'invalid'
      ? REASON_HINT.INVALID_FORMAT
      : usernameState.kind === 'unavailable'
      ? REASON_HINT[usernameState.reason]
      : DEFAULT_HINT;
  const usernameHintColor =
    usernameState.kind === 'invalid' || usernameState.kind === 'unavailable'
      ? Colors.ratingAgain
      : Colors.textMuted;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.headerBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>계정 만들기</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <Field label="이메일" mutedLabel>
              <View style={[styles.inputBox, styles.inputDisabled]}>
                <Ionicons name="mail-outline" size={18} color={Colors.textMuted} />
                <Text style={styles.inputDisabledText} numberOfLines={1}>
                  {email ?? ''}
                </Text>
              </View>
            </Field>

            <Field label="username" required hint={usernameHint} hintColor={usernameHintColor}>
              <View
                style={[
                  styles.inputBox,
                  { borderColor: usernameBorder, borderWidth: usernameBorderWidth },
                ]}
              >
                <Ionicons name="at-outline" size={18} color={usernameIconColor} />
                <TextInput
                  value={username}
                  onChangeText={handleUsernameChange}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField((f) => (f === 'username' ? null : f))}
                  placeholder="username"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.inputText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  maxLength={20}
                />
                {usernameState.kind === 'checking' && (
                  <ActivityIndicator size="small" color={Colors.textMuted} />
                )}
                {usernameState.kind === 'available' && (
                  <Ionicons name="checkmark" size={18} color={Colors.ratingGood} />
                )}
                {(usernameState.kind === 'invalid' ||
                  usernameState.kind === 'unavailable') && (
                  <Ionicons name="alert-circle" size={18} color={Colors.ratingAgain} />
                )}
              </View>
            </Field>

            <Field label="이름" hint="카드와 프로필에 표시">
              <View
                style={[
                  styles.inputBox,
                  { borderColor: nameBorder, borderWidth: nameBorderWidth },
                ]}
              >
                <Ionicons name="person-outline" size={18} color={nameIconColor} />
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField((f) => (f === 'name' ? null : f))}
                  placeholder="이름을 입력하세요"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.inputText}
                  maxLength={100}
                />
              </View>
            </Field>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {error && status === 'error' && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              !canSubmit && styles.submitBtnDisabled,
              pressed && canSubmit && styles.submitBtnPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitLabel}>Kotonoha 시작하기</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </Pressable>

          <View style={styles.terms}>
            <Text style={styles.termsLine}>계속 진행하면 다음 사항에 동의하는 것입니다</Text>
            <Text style={styles.termsLink}>
              <Text style={styles.termsAnchor} onPress={() => Linking.openURL(TOS_URL)}>
                서비스 이용약관
              </Text>
              {' · '}
              <Text style={styles.termsAnchor} onPress={() => Linking.openURL(PRIVACY_URL)}>
                개인정보 처리방침
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  mutedLabel?: boolean;
  hint?: string;
  hintColor?: string;
  children: React.ReactNode;
}

function Field({ label, required, mutedLabel, hint, hintColor, children }: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, mutedLabel && styles.fieldLabelMuted]}>{label}</Text>
        {required && <Text style={styles.fieldRequired}>*</Text>}
      </View>
      {children}
      {hint && (
        <View style={styles.hintRow}>
          <Ionicons name="information-circle-outline" size={12} color={hintColor ?? Colors.textMuted} />
          <Text style={[styles.hintText, { color: hintColor ?? Colors.textMuted }]}>{hint}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },

  scroll: { flexGrow: 1, paddingHorizontal: 32, paddingTop: 8, paddingBottom: 16 },
  form: { gap: 18 },

  field: { gap: 8 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  fieldLabelMuted: { color: Colors.textMuted },
  fieldRequired: { fontSize: 13, fontWeight: '700', color: Colors.primary },

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
  inputDisabled: { backgroundColor: Colors.card },
  inputText: { flex: 1, fontSize: 15, color: Colors.textPrimary, padding: 0 },
  inputDisabledText: { flex: 1, fontSize: 15, color: Colors.textMuted },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  hintText: { fontSize: 11 },

  footer: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8, gap: 14 },
  error: { color: Colors.ratingAgain, textAlign: 'center', fontSize: 13 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 9999,
    backgroundColor: Colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  submitBtnDisabled: { backgroundColor: Colors.border, shadowOpacity: 0, elevation: 0 },
  submitBtnPressed: { opacity: 0.9 },
  submitLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  terms: { alignItems: 'center', marginTop: 6 },
  termsLine: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  termsLink: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  termsAnchor: { textDecorationLine: 'underline' },
});
