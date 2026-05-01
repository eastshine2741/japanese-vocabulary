import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { GoogleSignin, GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '../stores/authStore';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import ServerURLDialog from '../components/ServerURLDialog';

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable onLongPress={() => setShowServerModal(true)}>
          <Text style={styles.title}>Kotonoha</Text>
          <Text style={styles.kanji}>言の葉</Text>
        </Pressable>

        <ServerURLDialog visible={showServerModal} onClose={() => setShowServerModal(false)} />

        {error && <Text style={styles.error}>{error}</Text>}

        {status === 'loading' ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <GoogleSigninButton
            style={styles.googleBtn}
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Light}
            onPress={handleGoogleLogin}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// Onboarding-specific brand palette derived from Pencil design (japanese-vocabulary.pen).
// Local-only on purpose — onboarding screens own their look.
const BRAND_BG = '#FAF8F2';
const BRAND_PRIMARY = '#2E5734';
const BRAND_MUTED = '#7A7A6E';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND_BG },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 28, fontWeight: '700', color: BRAND_PRIMARY, textAlign: 'center' },
  kanji: {
    fontSize: 19,
    color: BRAND_MUTED,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 120,
  },
  error: { color: Colors.ratingAgain, textAlign: 'center', marginBottom: 12, fontSize: 13 },
  googleBtn: { width: 240, height: 48 },
});
