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
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/theme';
import { EXTERNAL_SERVICES, FRONTEND_OSS, OssEntry } from '../data/ossList';

function Row({ entry }: { entry: OssEntry }) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.6}
      onPress={() => Linking.openURL(entry.url)}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>{entry.name}</Text>
        <Text style={styles.rowLicense}>{entry.license}</Text>
      </View>
      {entry.note && <Text style={styles.rowNote}>{entry.note}</Text>}
      <Feather name="external-link" size={14} color={Colors.textMuted} style={styles.rowIcon} />
    </TouchableOpacity>
  );
}

export default function OssLicenseScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>오픈소스 라이선스</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>외부 서비스 / 데이터 출처</Text>
        <Text style={styles.sectionDesc}>이 앱이 사용하는 외부 데이터·API 출처입니다.</Text>
        <View style={styles.card}>
          {EXTERNAL_SERVICES.map((entry, i) => (
            <View key={entry.name}>
              {i > 0 && <View style={styles.divider} />}
              <Row entry={entry} />
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>프론트엔드 오픈소스</Text>
        <Text style={styles.sectionDesc}>이 앱이 사용하는 오픈소스 라이브러리 목록입니다.</Text>
        <View style={styles.card}>
          {FRONTEND_OSS.map((entry, i) => (
            <View key={entry.name}>
              {i > 0 && <View style={styles.divider} />}
              <Row entry={entry} />
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          백엔드 서버 측 오픈소스(Spring Boot, Kotlin 등)는 사용자 단말에 배포되지 않아 별도 표기하지 않습니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.card },
  scrollView: { flex: 1 },
  content: { padding: 12, paddingBottom: 40, gap: 4 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.card,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
    marginLeft: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 4,
    marginBottom: 8,
    lineHeight: 16,
  },

  card: { backgroundColor: Colors.background, borderRadius: 16, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 16 },

  row: { paddingVertical: 14, paddingHorizontal: 16 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 22 },
  rowName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  rowLicense: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  rowNote: { fontSize: 12, color: Colors.textMuted, marginTop: 4, lineHeight: 16, paddingRight: 22 },
  rowIcon: { position: 'absolute', right: 14, top: 16 },

  footer: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 24,
    paddingHorizontal: 8,
    lineHeight: 15,
  },
});
