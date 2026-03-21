import React, { useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettingsStore } from '../../stores/settingsStore';
import { tokenStorage } from '../../utils/tokenStorage';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MyPageTab() {
  const navigation = useNavigation<Nav>();
  const {
    status, requestRetention, showIntervals, isSaving, saveSuccess,
    loadSettings, setRetention, setShowIntervals, save,
  } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, []);

  const handleLogout = async () => {
    await tokenStorage.clearToken();
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }),
    );
  };

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Study Settings</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Target Retention Rate</Text>
          <Text style={styles.settingValue}>{Math.round(requestRetention * 100)}%</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0.7}
          maximumValue={0.99}
          step={0.01}
          value={requestRetention}
          onValueChange={setRetention}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.cardBorder}
          thumbTintColor={Colors.primary}
        />

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Show Intervals</Text>
          <Switch
            value={showIntervals}
            onValueChange={setShowIntervals}
            trackColor={{ true: Colors.primary, false: Colors.cardBorder }}
            thumbColor={Colors.surface}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.buttonDisabled]}
          onPress={save}
          disabled={isSaving}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>
              {saveSuccess ? 'Saved!' : 'Save Settings'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { padding: Dimens.screenPadding },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Dimens.cardCornerRadius,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: { fontSize: 15, color: Colors.textPrimary },
  settingValue: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  slider: { marginBottom: 16 },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  logoutButton: {
    borderWidth: 1,
    borderColor: Colors.ratingAgain,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  logoutText: { color: Colors.ratingAgain, fontWeight: '600', fontSize: 16 },
});
