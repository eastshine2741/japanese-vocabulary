import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import ServerURLDialog from '../components/ServerURLDialog';
import BrandMark from '../components/BrandMark';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [showServerModal, setShowServerModal] = useState(false);
  const { status, error, googleLogin, reset } = useAuthStore(
    useShallow((s) => ({
      status: s.status,
      error: s.error,
      googleLogin: s.googleLogin,
      reset: s.reset,
    })),
  );

  useEffect(() => {
    if (status === 'success') {
      reset();
      navigation.replace('Main');
    }
  }, [status]);

  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();
      const idToken = (result as any)?.data?.idToken ?? (result as any)?.idToken;
      if (!idToken) return;
      await googleLogin(idToken);
    } catch {
      // user cancel or platform error — surface via store, retry available
    }
  };

  const loading = status === 'loading';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Pressable onLongPress={() => setShowServerModal(true)} style={styles.brandStack}>
          <BrandMark size={96} />
          <View style={styles.nameStack}>
            <Text style={styles.title}>Kotonoha</Text>
            <Text style={styles.kanji}>言の葉</Text>
          </View>
        </Pressable>

        <View style={styles.copy}>
          <Text style={styles.headline}>좋아하는 노래로</Text>
          <Text style={styles.headline}>일본어 단어를 모아보세요</Text>
          <Text style={styles.sub}>가사 속 단어를 잎사귀처럼 한 장씩</Text>
        </View>

        <ServerURLDialog visible={showServerModal} onClose={() => setShowServerModal(false)} />
      </View>

      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          onPress={loading ? undefined : handleGoogleLogin}
          disabled={loading}
          style={({ pressed }) => [styles.googleBtn, pressed && styles.googleBtnPressed]}
        >
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color="#4285F4" />
              <Text style={styles.googleLabel}>Google 계정으로 계속하기</Text>
            </>
          )}
        </Pressable>

        <View style={styles.terms}>
          <Text style={styles.termsLine}>계속 진행하면 다음 사항에 동의하는 것입니다</Text>
          <Text style={styles.termsLink}>서비스 이용약관 · 개인정보 처리방침</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  brandStack: { alignItems: 'center' },
  nameStack: { alignItems: 'center', marginTop: 24 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 },
  kanji: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginTop: 6,
  },
  copy: { alignItems: 'center', marginTop: 32 },
  headline: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 30,
  },
  sub: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 12,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  error: { color: Colors.ratingAgain, textAlign: 'center', fontSize: 13 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 52,
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  googleBtnPressed: { opacity: 0.85 },
  googleLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  terms: { alignItems: 'center', marginTop: 6 },
  termsLine: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  termsLink: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
});
