import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SearchDiscoverySections from '../components/searchDiscovery/SearchDiscoverySections';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const openSearchInput = useCallback(() => {
    navigation.navigate('SearchInput');
  }, [navigation]);

  const openSong = useCallback(
    (songId: number) => {
      navigation.navigate('SongDetail', { songId, origin: 'Home' });
    },
    [navigation],
  );

  const openKaraokeNewSongs = useCallback(() => {
    navigation.navigate('KaraokeNewSongs');
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.searchRow}>
        <TouchableOpacity style={styles.searchField} onPress={openSearchInput} activeOpacity={0.72}>
          <SearchIcon />
          <Text style={styles.placeholder}>노래, 아티스트 검색</Text>
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        <SearchDiscoverySections
          onSelectSong={openSong}
          onPressKaraokeNewSongs={openKaraokeNewSongs}
        />
      </ScrollView>
    </View>
  );
}

function SearchIcon() {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={Colors.textMuted}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={11} cy={11} r={8} />
      <Path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Dimens.screenPadding,
    gap: 12,
  },
  searchField: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  placeholder: {
    flex: 1,
    fontSize: 15,
    color: Colors.textMuted,
  },
});
