import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/authStore';
import { vocApi } from '../api/vocApi';
import { apiErrorMessage } from '../api/errors';
import { collectDeviceInfo } from '../utils/deviceInfo';
import { Colors } from '../theme/theme';
import { AppBar } from '../components/AppBar';
import { PrimaryButton } from '../components/PrimaryButton';
import AppDialog from '../components/AppDialog';
import ErrorDialog from '../components/ErrorDialog';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Voc'>;

const CONTENT_MAX = 1000;

export default function VocScreen({ navigation }: Props) {
  const { username, email, loadProfile } = useAuthStore(
    useShallow((s) => ({ username: s.username, email: s.email, loadProfile: s.loadProfile })),
  );

  const [content, setContent] = useState('');
  const [contentFocused, setContentFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      await vocApi.create({ content: trimmed, ...collectDeviceInfo() });
      setSubmitted(true);
    } catch (e) {
      setError(apiErrorMessage(e, '전송에 실패했어요'));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, trimmed]);

  const handleDone = useCallback(() => {
    setSubmitted(false);
    navigation.goBack();
  }, [navigation]);

  const handleDismissError = useCallback(() => setError(null), []);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <AppBar title="개발자 괴롭히기" onBack={() => navigation.goBack()} />

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>유저네임</Text>
              <View style={[styles.inputBox, styles.inputBoxReadonly]}>
                <TextInput value={username ?? ''} editable={false} style={[styles.inputText, styles.inputTextReadonly]} />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>이메일</Text>
              <View style={[styles.inputBox, styles.inputBoxReadonly]}>
                <TextInput value={email ?? ''} editable={false} style={[styles.inputText, styles.inputTextReadonly]} />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>내용</Text>
              <View
                style={[
                  styles.inputBox,
                  styles.contentBox,
                  contentFocused && styles.inputBoxFocused,
                ]}
              >
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  onFocus={() => setContentFocused(true)}
                  onBlur={() => setContentFocused(false)}
                  placeholder="불편한 점, 바라는 점, 버그 무엇이든"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.inputText, styles.contentText]}
                  multiline
                  textAlignVertical="top"
                  maxLength={CONTENT_MAX}
                />
              </View>
              <View style={styles.metaRow}>
                <View />
                <Text style={styles.counter}>{`${content.length}/${CONTENT_MAX}`}</Text>
              </View>
            </View>

            <PrimaryButton
              label={submitting ? '보내는 중...' : '확인'}
              onPress={handleSubmit}
              disabled={!canSubmit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AppDialog
        visible={submitted}
        title="개발자에게 전달했어요"
        buttons={[{ label: '확인', onPress: handleDone }]}
      />
      <ErrorDialog message={error} onDismiss={handleDismissError} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  form: { gap: 24 },

  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputBoxReadonly: { backgroundColor: Colors.card, borderColor: Colors.card },
  inputBoxFocused: { borderColor: Colors.primary, borderWidth: 1.5 },
  contentBox: { alignItems: 'stretch', paddingVertical: 12 },

  inputText: { flex: 1, fontSize: 15, color: Colors.textPrimary, padding: 0 },
  inputTextReadonly: { color: Colors.textSecondary },
  contentText: { minHeight: 160, lineHeight: 22 },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  counter: { fontSize: 12, color: Colors.textMuted },
});
