import React, { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet, ActivityIndicator, View } from 'react-native';
import AppDialog from './AppDialog';
import { Colors } from '../theme/theme';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

const CONFIRM_PHRASE = '삭제';

type Step = 'warn' | 'confirm' | 'submitting';

export default function DeleteAccountDialog({ visible, onCancel, onConfirm }: Props) {
  const [step, setStep] = useState<Step>('warn');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStep('warn');
      setPhrase('');
      setError(null);
    }
  }, [visible]);

  const handleConfirm = async () => {
    setStep('submitting');
    setError(null);
    try {
      await onConfirm();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '계정 삭제에 실패했어요. 잠시 후 다시 시도해주세요.');
      setStep('confirm');
    }
  };

  if (step === 'warn') {
    return (
      <AppDialog
        key="warn"
        visible={visible}
        title="계정을 삭제할까요?"
        body={
          '계정과 모든 학습 기록(저장한 단어, 덱, 통계 등)이 삭제됩니다. ' +
          '되돌릴 수 없어요.'
        }
        buttons={[
          { label: '취소', onPress: onCancel, variant: 'secondary' },
          { label: '계속', onPress: () => setStep('confirm'), variant: 'danger' },
        ]}
      />
    );
  }

  const phraseMatches = phrase.trim() === CONFIRM_PHRASE;
  const submitting = step === 'submitting';

  return (
    <AppDialog
      key="confirm"
      visible={visible}
      title="마지막 확인"
      buttons={[
        {
          label: '취소',
          onPress: onCancel,
          variant: 'secondary',
          disabled: submitting,
        },
        {
          label: submitting ? '삭제 중...' : '계정 삭제',
          onPress: handleConfirm,
          variant: 'danger',
          disabled: submitting || !phraseMatches,
        },
      ]}
    >
      <Text style={styles.body}>
        계속하려면 아래에 <Text style={styles.phrase}>{CONFIRM_PHRASE}</Text>을(를) 입력해주세요.
      </Text>
      <TextInput
        style={styles.input}
        value={phrase}
        onChangeText={setPhrase}
        placeholder={CONFIRM_PHRASE}
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!submitting}
      />
      {submitting && (
        <View style={styles.spinnerRow}>
          <ActivityIndicator size="small" color={Colors.textMuted} />
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  phrase: { fontWeight: '700', color: Colors.accentRed },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  spinnerRow: { alignItems: 'center' },
  error: { fontSize: 12, color: Colors.accentRed, textAlign: 'center' },
});
