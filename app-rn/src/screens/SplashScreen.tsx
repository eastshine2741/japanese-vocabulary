import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/theme';
import BrandMark from '../components/BrandMark';

export default function SplashScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <BrandMark size={128} />
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
  footer: { alignItems: 'center', paddingBottom: 40 },
});
