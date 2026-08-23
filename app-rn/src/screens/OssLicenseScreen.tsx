import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Dimens } from '../theme/theme';
import { EXTERNAL_SERVICES, FRONTEND_OSS, ICON_ASSETS, OssEntry } from '../data/ossList';
import { AppBar } from '../components/AppBar';

function Row({ entry }: { entry: OssEntry }) {
  return (
    <View>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={() => Linking.openURL(entry.url)}
      >
        <Text style={styles.rowName} numberOfLines={1}>{entry.name}</Text>
        <Text style={styles.rowLicense}>{entry.license}</Text>
        <Feather name="external-link" size={14} color={Colors.textMuted} />
      </TouchableOpacity>
      {entry.notice ? <Text style={styles.notice}>{entry.notice}</Text> : null}
    </View>
  );
}

export default function OssLicenseScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <AppBar title="오픈소스 라이선스" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>외부 서비스 / 데이터 출처</Text>
          <View>
            {EXTERNAL_SERVICES.map((entry) => (
              <Row key={entry.name} entry={entry} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>프론트엔드 라이브러리</Text>
          <View>
            {FRONTEND_OSS.map((entry) => (
              <Row key={entry.name} entry={entry} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>앱 아이콘</Text>
          <View>
            {ICON_ASSETS.map((entry) => (
              <Row key={entry.name} entry={entry} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40, gap: 28 },

  section: { gap: 8 },
  sectionLabel: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  rowName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  rowLicense: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },

  notice: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textMuted,
    backgroundColor: Colors.card,
    borderRadius: Dimens.smallCornerRadius,
    padding: 12,
    marginBottom: 4,
  },
});
