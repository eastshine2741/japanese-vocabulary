import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import RecentSearchList from '../components/searchDiscovery/RecentSearchList';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSearchHistoryStore } from '../stores/searchHistoryStore';
import { Colors } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SearchInput'>;

export default function SearchInputScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const loadTerms = useSearchHistoryStore((s) => s.load);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  // Each search opens its own results screen; back steps through past searches.
  const runSearch = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      Keyboard.dismiss();
      navigation.navigate('SongSearch', { query: trimmed });
    },
    [navigation],
  );

  const handleSubmit = useCallback(() => runSearch(query), [query, runSearch]);
  const handleClear = useCallback(() => setQuery(''), []);
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.searchRow}>
        <TouchableOpacity onPress={handleBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <SearchIcon />
          <TextInput
            style={styles.input}
            placeholder="노래, 아티스트 검색"
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={handleClear} hitSlop={8}>
              <Ionicons name="close" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <RecentSearchList onSelectTerm={runSearch} />
      </ScrollView>
    </SafeAreaView>
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
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  inputWrapper: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  content: {
    paddingTop: 4,
    paddingBottom: 8,
  },
});
