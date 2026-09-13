import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { Colors } from '../theme/theme';

const DEFAULT_NAVIGATION_BAR_COLOR = Colors.surface;
const DEFAULT_NAVIGATION_BAR_BUTTON_STYLE = 'dark';

type NavigationBarButtonStyle = 'light' | 'dark';

interface AndroidNavigationBarColorOptions {
  active: boolean;
  color: string;
  buttonStyle: NavigationBarButtonStyle;
}

async function applyNavigationBarColor(color: string, buttonStyle: NavigationBarButtonStyle) {
  if (Platform.OS !== 'android') return;

  NavigationBar.setStyle(buttonStyle === 'light' ? 'dark' : 'light');
  await Promise.all([
    NavigationBar.setBackgroundColorAsync(color),
    NavigationBar.setButtonStyleAsync(buttonStyle),
  ]);
}

export function useAndroidNavigationBarColor({
  active,
  color,
  buttonStyle,
}: AndroidNavigationBarColorOptions) {
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const nextColor = active ? color : DEFAULT_NAVIGATION_BAR_COLOR;
    const nextButtonStyle = active ? buttonStyle : DEFAULT_NAVIGATION_BAR_BUTTON_STYLE;

    applyNavigationBarColor(nextColor, nextButtonStyle).catch(() => undefined);

    return undefined;
  }, [active, buttonStyle, color]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    return () => {
      applyNavigationBarColor(
        DEFAULT_NAVIGATION_BAR_COLOR,
        DEFAULT_NAVIGATION_BAR_BUTTON_STYLE,
      ).catch(() => undefined);
    };
  }, []);
}
