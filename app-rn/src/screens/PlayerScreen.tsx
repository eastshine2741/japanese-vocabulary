import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import YoutubePlayer from 'react-native-youtube-iframe';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSearchStore } from '../stores/searchStore';
import { useVocabularyStore } from '../stores/vocabularyStore';
import AppTopBar from '../components/AppTopBar';
import WordAnalysisSheet from '../components/WordAnalysisSheet';
import { Token, StudyUnit } from '../types/song';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

export default function PlayerScreen({ navigation }: Props) {
  const { studyData, resetAnalyze } = useSearchStore();
  const vocabStore = useVocabularyStore();

  const [currentMs, setCurrentMs] = useState(0);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedLine, setSelectedLine] = useState('');
  const bottomSheetRef = useRef<BottomSheet>(null);
  const flatListRef = useRef<FlatList>(null);

  if (!studyData) return null;

  const { song, studyUnits, youtubeUrl } = studyData;
  const isSynced = song.lyricType === 'SYNCED';
  const videoId = youtubeUrl ? extractVideoId(youtubeUrl) : null;

  const handleBack = () => {
    resetAnalyze();
    navigation.goBack();
  };

  const handleTokenPress = (token: Token, lineText: string) => {
    setSelectedToken(token);
    setSelectedLine(lineText);
    vocabStore.resetLookup();
    vocabStore.lookupWord(token.baseForm);
    vocabStore.getWord(token.baseForm);
    bottomSheetRef.current?.expand();
  };

  const handleAddWord = () => {
    if (vocabStore.definition) {
      vocabStore.addWord(vocabStore.definition, song.id, selectedLine);
    }
  };

  const onStateChange = useCallback((state: string) => {
    // YouTube player state changes
  }, []);

  const currentLineIndex = isSynced
    ? studyUnits.reduce((acc, unit, idx) => {
        if (unit.startTimeMs != null && unit.startTimeMs <= currentMs) return idx;
        return acc;
      }, 0)
    : -1;

  const renderLyricLine = ({ item, index }: { item: StudyUnit; index: number }) => {
    const isActive = isSynced && index === currentLineIndex;
    return (
      <View style={[styles.lyricLine, isActive && styles.activeLine]}>
        <View style={styles.tokensRow}>
          {item.tokens.length > 0
            ? item.tokens.map((token, ti) => (
                <TouchableOpacity
                  key={ti}
                  onPress={() => handleTokenPress(token, item.originalText)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.tokenText, isActive && styles.activeTokenText]}>
                    {token.surface}
                  </Text>
                </TouchableOpacity>
              ))
            : (
              <Text style={[styles.plainText, isActive && styles.activeTokenText]}>
                {item.originalText}
              </Text>
            )}
        </View>
        {item.koreanLyrics && (
          <Text style={styles.koreanText}>{item.koreanLyrics}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppTopBar title={song.title} onBack={handleBack} />

      {videoId && (
        <YoutubePlayer
          height={220}
          videoId={videoId}
          onChangeState={onStateChange}
          onProgress={(data: { currentTime: number }) => setCurrentMs(data.currentTime * 1000)}
        />
      )}

      <FlatList
        ref={flatListRef}
        data={studyUnits}
        keyExtractor={(item) => String(item.index)}
        renderItem={renderLyricLine}
        contentContainerStyle={styles.lyricsList}
      />

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['50%']}
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={{ backgroundColor: Colors.textTertiary }}
      >
        <BottomSheetView>
          {selectedToken && (
            <WordAnalysisSheet
              token={selectedToken}
              lookupStatus={vocabStore.lookupStatus}
              definition={vocabStore.definition}
              lookupError={vocabStore.lookupError}
              addStatus={vocabStore.addStatus}
              getWordStatus={vocabStore.getWordStatus}
              existingWord={vocabStore.existingWord}
              songId={song.id}
              lyricLine={selectedLine}
              onAddWord={handleAddWord}
            />
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  lyricsList: { padding: Dimens.screenPadding, paddingBottom: 100 },
  lyricLine: { marginBottom: 12 },
  activeLine: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
    padding: 8,
    marginHorizontal: -8,
  },
  tokensRow: { flexDirection: 'row', flexWrap: 'wrap' },
  tokenText: { fontSize: 18, color: Colors.textPrimary, lineHeight: 28 },
  activeTokenText: { color: Colors.primary, fontWeight: '600' },
  plainText: { fontSize: 18, color: Colors.textPrimary, lineHeight: 28 },
  koreanText: { fontSize: 13, color: Colors.textTertiary, marginTop: 2 },
  sheetBg: { backgroundColor: Colors.surface },
});
