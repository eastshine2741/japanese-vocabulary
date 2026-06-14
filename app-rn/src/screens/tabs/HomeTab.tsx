import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import SpotlightHero from '../../components/SpotlightHero';
import StudyStatsHomeCard from '../../components/studyStats/StudyStatsHomeCard';
import WordReviewSection from '../../components/WordReviewSection';
import RecentSongsSection from '../../components/RecentSongsSection';
import { Colors, Dimens } from '../../theme/theme';
import { TabParamList } from '../../navigation/AppNavigator';

type Nav = BottomTabNavigationProp<TabParamList>;

export default function HomeTab() {
  const navigation = useNavigation<Nav>();
  const goSearch = useCallback(() => navigation.navigate('Search'), [navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.appBar}>
        <Text style={styles.wordmark}>Kotonoha</Text>
        <Pressable onPress={goSearch} hitSlop={8}>
          <Feather name="search" size={22} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Each section self-loads and renders null when it has nothing to show. */}
        <SpotlightHero />
        <StudyStatsHomeCard />
        <WordReviewSection />
        <RecentSongsSection />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  appBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Dimens.screenPadding,
  },
  wordmark: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: Colors.textPrimary,
  },
  content: {
    // No horizontal padding here: each section pads itself so horizontal
    // scrollers (recent-songs carousel, deck pager) can bleed to the screen edge.
    paddingTop: 8,
    paddingBottom: Dimens.bottomBarHeight + 40,
    gap: 24,
  },
});
