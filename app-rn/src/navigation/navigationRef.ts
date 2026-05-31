import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './AppNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pending: { screen: keyof RootStackParamList; params?: any } | null = null;

export function navigate<K extends keyof RootStackParamList>(
  screen: K,
  params?: RootStackParamList[K],
) {
  if (navigationRef.isReady()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigationRef.navigate(screen as any, params as any);
  } else {
    pending = { screen, params };
  }
}

export function flushPending() {
  if (pending && navigationRef.isReady()) {
    const { screen, params } = pending;
    pending = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigationRef.navigate(screen as any, params as any);
  }
}
