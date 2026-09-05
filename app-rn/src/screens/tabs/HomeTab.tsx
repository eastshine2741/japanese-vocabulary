import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HomeChrome, StudySource, StudyStack, useStudyStack } from '../../components/studyStack';
import { RootStackParamList, TabParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../theme/theme';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function HomeTab() {
  const navigation = useNavigation<Nav>();
  const stack = useStudyStack({ mode: 'home' });
  const visibleSongId = stack.visibleSource?.songId ?? null;

  const goSearch = useCallback(() => navigation.navigate('Search'), [navigation]);

  const openSource = useCallback(() => {
    if (visibleSongId == null) return;
    navigation.navigate('SongDetail', { songId: visibleSongId, origin: 'Home' });
  }, [navigation, visibleSongId]);

  const openRecommended = useCallback((recommended: StudySource) => {
    if (recommended.songId == null) return;
    navigation.navigate('SongDetail', { songId: recommended.songId, origin: 'Home' });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HomeChrome
        streak={stack.streak}
        progress={stack.session.progress}
        onSearch={goSearch}
      />
      <StudyStack
        stack={stack}
        onOpenSource={openSource}
        onSearch={goSearch}
        onSelectRecommended={openRecommended}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
