import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/authStore';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import ServerURLDialog from '../components/ServerURLDialog';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const { status, error, login, signup, reset } = useAuthStore(
    useShallow(s => ({ status: s.status, error: s.error, login: s.login, signup: s.signup, reset: s.reset })),
  );

  useEffect(() => {
    if (status === 'success') {
      reset();
      navigation.replace('Main');
    }
  }, [status]);

  const handleSubmit = () => {
    if (!name.trim() || !password.trim()) return;
    if (isSignup) {
      signup(name.trim(), password);
    } else {
      login(name.trim(), password);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>うたことば</Text>
        <Pressable onLongPress={() => setShowServerModal(true)}>
          <Text style={styles.subtitle}>Learn Japanese through songs</Text>
        </Pressable>

        <ServerURLDialog visible={showServerModal} onClose={() => setShowServerModal(false)} />

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={Colors.textTertiary}
          value={name}
          onChangeText={setName}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, status === 'loading' && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={status === 'loading'}
          activeOpacity={0.7}
        >
          {status === 'loading' ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>{isSignup ? 'Sign Up' : 'Log In'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setIsSignup(!isSignup); reset(); }}>
          <Text style={styles.toggle}>
            {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Dimens.smallCornerRadius,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  error: { color: Colors.ratingAgain, textAlign: 'center', marginBottom: 12, fontSize: 13 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  toggle: { color: Colors.primary, textAlign: 'center', marginTop: 20, fontSize: 14 },
});
