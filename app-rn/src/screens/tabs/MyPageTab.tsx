import React, { useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, BackHandler } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { AppBottomSheetModal, AppBottomSheetModalRef } from '../../components/bottomSheet';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import StudyStatsProfileSection from '../../components/studyStats/StudyStatsProfileSection';
import HeatmapSection from '../../components/studyStats/HeatmapSection';
import FreezeInfoSheet from '../../components/studyStats/FreezeInfoSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MyPageTab() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const username = useAuthStore((s) => s.username);
  const userName = useAuthStore((s) => s.userName);
  const loadProfile = useAuthStore((s) => s.loadProfile);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const freezeSheetRef = useRef<AppBottomSheetModalRef>(null);
  const freezeOpenRef = useRef(false);

  const handleOpenFreeze = useCallback(() => {
    freezeOpenRef.current = true;
    freezeSheetRef.current?.present();
  }, []);

  const handleCloseFreeze = useCallback(() => {
    freezeOpenRef.current = false;
    freezeSheetRef.current?.dismiss();
  }, []);

  const handleFreezeSheetChange = useCallback((index: number) => {
    freezeOpenRef.current = index >= 0;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (freezeOpenRef.current) {
          freezeOpenRef.current = false;
          freezeSheetRef.current?.dismiss();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

  const handle = username ? `@${username}` : '@user';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: Dimens.bottomBarHeight + insets.bottom + 40 }]}
      >
        {/* profHeader */}
        <View style={styles.profHeader}>
          <Text style={styles.handle}>{handle}</Text>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <Feather name="menu" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* profileCard */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={Colors.textMuted} />
          </View>
          <View style={styles.nameRow}>
            {userName && <Text style={styles.profName}>{userName}</Text>}
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('ProfileEdit')}
            activeOpacity={0.7}
          >
            <Feather name="edit-2" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <StudyStatsProfileSection />
        <HeatmapSection onPressFreeze={handleOpenFreeze} />
      </ScrollView>

      <AppBottomSheetModal
        ref={freezeSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        onChange={handleFreezeSheetChange}
      >
        <BottomSheetView>
          <FreezeInfoSheet onConfirm={handleCloseFreeze} />
        </BottomSheetView>
      </AppBottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  scrollView: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    gap: 24,
  },

  profHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  handle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flex: 1,
    flexDirection: 'column',
    gap: 3,
  },
  profName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
