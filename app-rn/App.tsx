import React, { useEffect, useState } from 'react';
import { StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AppNavigator, { RootStackParamList } from './src/navigation/AppNavigator';
import { tokenStorage } from './src/utils/tokenStorage';
import { isJwtExpired } from './src/utils/jwt';
import { initBaseURL } from './src/api/client';
import { useSettingsStore } from './src/stores/settingsStore';
import SplashScreen from './src/screens/SplashScreen';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID ?? '',
});

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    initBaseURL().then(() =>
      tokenStorage.getToken().then((token) => {
        const valid = !!token && !isJwtExpired(token);
        if (valid) {
          useSettingsStore.getState().loadSettings();
        }
        setInitialRoute(valid ? 'Main' : 'Login');
      }),
    );
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        {!initialRoute ? (
          <SplashScreen />
        ) : (
          <NavigationContainer>
            <AppNavigator initialRoute={initialRoute} />
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
