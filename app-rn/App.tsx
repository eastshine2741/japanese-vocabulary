import * as Sentry from '@sentry/react-native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
  FunnelSans_400Regular,
  FunnelSans_500Medium,
  FunnelSans_600SemiBold,
  FunnelSans_700Bold,
  FunnelSans_800ExtraBold,
  useFonts as useFunnelSansFonts,
} from '@expo-google-fonts/funnel-sans';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
  tracesSampleRate: 0.1,
});

import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer, type NavigationState } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AppNavigator, { RootStackParamList } from './src/navigation/AppNavigator';
import { navigationRef, flushPending } from './src/navigation/navigationRef';
import { tokenStorage } from './src/utils/tokenStorage';
import { isJwtExpired } from './src/utils/jwt';
import { initBaseURL } from './src/api/client';
import { useSettingsStore } from './src/stores/settingsStore';
import SplashScreen from './src/screens/SplashScreen';
import { registerNotificationHandlers, requestPermissionAndRegisterToken } from './src/services/pushNotifications';
import { applyGlobalTypography } from './src/theme/typography';
import { useHomeChromeStore } from './src/stores/homeChromeStore';
import { useAndroidNavigationBarColor } from './src/hooks/useAndroidNavigationBarColor';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID ?? '',
});

const HOME_IMMERSE_NAVIGATION_BAR_COLOR = '#14181C';
const SONG_REVIEW_NAVIGATION_BAR_COLOR = '#000000';

type NavigationMode = 'default' | 'homeImmerse' | 'songReview';

function getAndroidNavigationMode(
  navigationState: NavigationState | null,
  homeIsDark: boolean,
): NavigationMode {
  const currentRootRoute = navigationState?.routes[navigationState.index];
  if (currentRootRoute?.name === 'SongReview') {
    const params = currentRootRoute.params as RootStackParamList['SongReview'] | undefined;
    return params?.origin === 'SongDetail' ? 'songReview' : 'default';
  }

  if (currentRootRoute?.name === 'Main') {
    const tabState = currentRootRoute.state as NavigationState | undefined;
    const activeTabRoute = tabState?.routes[tabState.index ?? 0];
    return activeTabRoute?.name === 'Home' && homeIsDark ? 'homeImmerse' : 'default';
  }

  return 'default';
}

function AndroidSystemBarController({ navigationState }: { navigationState: NavigationState | null }) {
  const homeIsDark = useHomeChromeStore((s) => s.isDark);
  const navigationMode = getAndroidNavigationMode(navigationState, homeIsDark);
  const usesDarkSystemBars = navigationMode !== 'default';

  useAndroidNavigationBarColor({
    active: usesDarkSystemBars,
    color:
      navigationMode === 'songReview'
        ? SONG_REVIEW_NAVIGATION_BAR_COLOR
        : HOME_IMMERSE_NAVIGATION_BAR_COLOR,
    buttonStyle: 'light',
  });

  return (
    <StatusBar
      barStyle={Platform.OS === 'android' && usesDarkSystemBars ? 'light-content' : 'dark-content'}
      backgroundColor="transparent"
      translucent
    />
  );
}

function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);
  const [interLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const [funnelSansLoaded] = useFunnelSansFonts({
    FunnelSans_400Regular,
    FunnelSans_500Medium,
    FunnelSans_600SemiBold,
    FunnelSans_700Bold,
    FunnelSans_800ExtraBold,
  });
  const fontsLoaded = interLoaded && funnelSansLoaded;

  if (fontsLoaded) applyGlobalTypography();

  useEffect(() => {
    registerNotificationHandlers();
    initBaseURL().then(() =>
      tokenStorage.getToken().then((token) => {
        const valid = !!token && !isJwtExpired(token);
        if (valid) {
          useSettingsStore.getState().loadSettings();
          requestPermissionAndRegisterToken();
        }
        setInitialRoute(valid ? 'Main' : 'Login');
      }),
    );
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          {!initialRoute || !fontsLoaded ? (
            <SplashScreen />
          ) : (
            <NavigationContainer
              ref={navigationRef}
              onReady={() => {
                flushPending();
                setNavigationState(navigationRef.getRootState());
              }}
              onStateChange={(state) => setNavigationState(state ?? null)}
            >
              <AndroidSystemBarController navigationState={navigationState} />
              <AppNavigator initialRoute={initialRoute} />
            </NavigationContainer>
          )}
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default Sentry.wrap(App);
