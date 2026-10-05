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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer, type NavigationState } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AppNavigator, { RootStackParamList } from './src/navigation/AppNavigator';
import { AnalysisPillOverlay } from './src/components/analysisPill';
import { StreakCelebrationHost } from './src/components/streak';
import { navigationRef, flushPending } from './src/navigation/navigationRef';
import { tokenStorage } from './src/utils/tokenStorage';
import { isJwtExpired, getJwtUserId } from './src/utils/jwt';
import { ScreenViewParams, setAnalyticsUserId, trackScreenView } from './src/services/analytics';
import { initBaseURL } from './src/api/client';
import { useSettingsStore } from './src/stores/settingsStore';
import SplashScreen from './src/screens/SplashScreen';
import { registerNotificationHandlers, requestPermissionAndRegisterToken } from './src/services/pushNotifications';
import { applyGlobalTypography } from './src/theme/typography';
import { useHomeChromeStore } from './src/stores/homeChromeStore';
import { useAndroidNavigationBarStyle } from './src/hooks/useAndroidNavigationBarStyle';
import { scheduleOtaUpdateCheck } from './src/services/otaUpdates';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID ?? '',
});

type NavigationMode = 'default' | 'homeImmerse' | 'songReview';

type ActiveRoute = NavigationState['routes'][number];

function getActiveRoute(state: NavigationState): ActiveRoute {
  let route = state.routes[state.index];
  while (route.state) {
    const child = route.state as NavigationState;
    route = child.routes[child.index ?? 0];
  }
  return route;
}

// 곡 탐색 퍼널의 마지막 단계(가사 열람)를 SongDetail screen_view 로, 가사에서 복습으로 넘어간
// 경로를 SongReview screen_view 의 trigger 로 본다.
function getScreenViewParams(route: ActiveRoute): ScreenViewParams | undefined {
  if (route.name === 'SongDetail') {
    const params = route.params as RootStackParamList['SongDetail'] | undefined;
    return {
      ...(params?.songId != null && { song_id: params.songId }),
      origin: params?.origin ?? 'unknown',
    };
  }
  if (route.name === 'SongReview') {
    const params = route.params as RootStackParamList['SongReview'] | undefined;
    return {
      ...(params?.source.songId != null && { song_id: params.source.songId }),
      trigger: params?.trigger ?? 'unknown',
    };
  }
  return undefined;
}

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

  useAndroidNavigationBarStyle(usesDarkSystemBars ? 'dark' : 'light');

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
  // RN 은 Activity 하나를 공유해 GA4 자동 screen_view 가 안 찍히므로 직접 찍는다.
  // 이름이 아니라 route key 로 거른다. SongDetail -> SongDetail 이동도 찍혀야 한다.
  const lastRouteKeyRef = useRef<string | null>(null);
  const handleNavigationState = useCallback((state: NavigationState | null | undefined) => {
    setNavigationState(state ?? null);
    if (!state) return;
    const route = getActiveRoute(state);
    if (route.key === lastRouteKeyRef.current) return;
    lastRouteKeyRef.current = route.key;
    trackScreenView(route.name, getScreenViewParams(route));
  }, []);
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
    scheduleOtaUpdateCheck();
    initBaseURL().then(() =>
      tokenStorage.getToken().then((token) => {
        const valid = !!token && !isJwtExpired(token);
        setAnalyticsUserId(valid ? getJwtUserId(token!) : null);
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
                handleNavigationState(navigationRef.getRootState());
              }}
              onStateChange={handleNavigationState}
            >
              <AndroidSystemBarController navigationState={navigationState} />
              <AppNavigator initialRoute={initialRoute} />
              <AnalysisPillOverlay />
              <StreakCelebrationHost />
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
