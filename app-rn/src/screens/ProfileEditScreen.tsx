import React, { useState } from 'react';
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
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

const NAME_MAX = 20;

export default function ProfileEditScreen({ navigation }: Props) {
  const { username, userName, setUserName } = useAuthStore(
    useShallow((s) => ({
      username: s.username,
      userName: s.userName,
      setUserName: s.setUserName,
    })),
  );

  const [name, setName] = useState(userName ?? '');
  const [nameFocused, setNameFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialName = userName ?? '';
  const trimmed = name.trim();
  const isDirty = trimmed !== initialName.trim();
  const canSave = isDirty && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const payload = trimmed === '' ? null : trimmed;
      const res = await userApi.updateName(payload);
      await setUserName(res.name);
      navigation.goBack();
    } catch (e: any) {
      setError(e.response?.data?.message || '저장에 실패했어요');
      setSaving(false);
    }
  };

  const nameBorder = nameFocused ? Colors.primary : Colors.border;
  const nameBorderWidth = nameFocused ? 1.5 : 1;
  const nameIconColor = nameFocused ? Colors.primary : Colors.textMuted;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>프로필 수정</Text>
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
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>유저네임</Text>
              <View style={[styles.inputBox, styles.inputBoxReadonly]}>
                <Ionicons name="at" size={18} color={Colors.textMuted} />
                <Text style={styles.readonlyText} numberOfLines={1}>
                  {username ?? ''}
                </Text>
                <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
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
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  placeholder="이름을 입력하세요"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.inputText}
                  maxLength={NAME_MAX}
                />
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.counter}>{`${name.length}/${NAME_MAX}`}</Text>
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
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  headerBtn: {
    minWidth: 56,
    height: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
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
  inputBoxReadonly: { backgroundColor: Colors.card },
  inputText: { flex: 1, fontSize: 15, color: Colors.textPrimary, padding: 0 },
  readonlyText: { flex: 1, fontSize: 15, color: Colors.textSecondary },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
  },
  counter: { fontSize: 12, color: Colors.textMuted },

  error: { fontSize: 13, color: Colors.ratingAgain, textAlign: 'center' },
});
