import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
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
import { Colors } from '../theme/theme';
import { applyGlobalTypography } from '../theme/typography';

export interface PreviewCase {
  name: string;
  render: () => React.ReactNode;
}

// 케이스 파일(*.local.tsx)은 작업마다 새로 쓰고 커밋하지 않는다. 없어도 번들이 깨지지 않게 context 로 찾는다.
interface CaseContext {
  keys(): string[];
  (key: string): { default: PreviewCase[] };
}
const context = (require as unknown as { context(dir: string, deep: boolean, filter: RegExp): CaseContext }).context(
  './',
  false,
  /\.local\.tsx$/,
);
const CASES = context.keys().flatMap((key) => context(key).default);

/** preview 빌드의 루트. 로그인·API 없이 컴포넌트를 케이스별 props 로 그려 디자인을 본다. */
export default function PreviewApp() {
  const [interLoaded] = useInterFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [funnelSansLoaded] = useFunnelSansFonts({
    FunnelSans_400Regular,
    FunnelSans_500Medium,
    FunnelSans_600SemiBold,
    FunnelSans_700Bold,
    FunnelSans_800ExtraBold,
  });
  if (!interLoaded || !funnelSansLoaded) return null;
  applyGlobalTypography();

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <ScrollView contentContainerStyle={styles.content}>
            {CASES.length === 0 && <Text style={styles.name}>src/preview/*.local.tsx 없음</Text>}
            {CASES.map((c) => (
              <View key={c.name} style={styles.case} nativeID={`case-${c.name}`}>
                <Text style={styles.name}>{c.name}</Text>
                {c.render()}
              </View>
            ))}
          </ScrollView>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    gap: 28,
    padding: 16,
  },
  case: {
    gap: 8,
  },
  name: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
