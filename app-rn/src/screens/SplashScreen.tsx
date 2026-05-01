import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/theme';
import BrandMark from '../components/BrandMark';

export default function SplashScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <BrandMark size={128} />
        <View style={styles.nameStack}>
          <Text style={styles.title}>Kotonoha</Text>
          <Text style={styles.kanji}>言の葉</Text>
        </View>
        <Text style={styles.tagline}>노래로 배우는 일본어</Text>
      </View>
      <View style={styles.footer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  nameStack: { alignItems: 'center', marginTop: 36 },
  title: { fontSize: 38, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 },
  kanji: { fontSize: 18, fontWeight: '500', color: Colors.textSecondary, letterSpacing: 2, marginTop: 8 },
  tagline: { fontSize: 14, fontWeight: '500', color: Colors.textMuted, marginTop: 24 },
  footer: { alignItems: 'center', paddingBottom: 40 },
});
