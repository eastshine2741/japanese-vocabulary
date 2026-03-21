import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSearchStore } from '../stores/searchStore';
import { useVocabularyStore } from '../stores/vocabularyStore';
import ArtworkImage from '../components/ArtworkImage';
import YouTubePlayer from '../components/YouTubePlayer';
import WordAnalysisSheet from '../components/WordAnalysisSheet';
import { Token, StudyUnit } from '../types/song';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

const PARTICLE_POS = ['助詞', '助動詞', '記号'];

function getUnderlineColor(pos: string): string | null {
  if (PARTICLE_POS.includes(pos)) return null;
  if (pos === '動詞') return Colors.posVerb;
  if (pos === '形容詞') return Colors.posAdjective;
  if (pos === '副詞') return Colors.posAdverb;
  return Colors.posNoun;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerScreen({ navigation }: Props) {
  const { studyData, resetAnalyze } = useSearchStore();
  const vocabStore = useVocabularyStore();

  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedLine, setSelectedLine] = useState('');
  const bottomSheetRef = useRef<BottomSheet>(null);
  const flatListRef = useRef<FlatList>(null);

  if (!studyData) return null;

  const { song, studyUnits, youtubeUrl } = studyData;
  const isSynced = song.lyricType === 'SYNCED';
  const videoId = youtubeUrl ? extractVideoId(youtubeUrl) : null;

  const handleTimeChange = useCallback((seconds: number) => {
    setCurrentMs(seconds * 1000);
  }, []);

  const handleDurationChange = useCallback((seconds: number) => {
    if (seconds > 0) setDurationMs(seconds * 1000);
  }, []);

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

  const currentLineIndex = isSynced
    ? studyUnits.reduce((acc, unit, idx) => {
        if (unit.startTimeMs != null && unit.startTimeMs <= currentMs) return idx;
        return acc;
      }, 0)
    : -1;

  // Auto-scroll to the current active lyric line
  const prevLineRef = useRef(-1);
  useEffect(() => {
    if (currentLineIndex >= 0 && currentLineIndex !== prevLineRef.current) {
      prevLineRef.current = currentLineIndex;
      flatListRef.current?.scrollToIndex({
        index: currentLineIndex,
        animated: true,
        viewOffset: 80,
      });
    }
  }, [currentLineIndex]);

  const progress = durationMs > 0 ? currentMs / durationMs : 0;

  const renderToken = (token: Token, ti: number, isActive: boolean, lineText: string) => {
    const underlineColor = getUnderlineColor(token.partOfSpeech);
    const isParticle = underlineColor === null;
    const textStyle = isActive ? styles.tokenTextActive : styles.tokenTextInactive;

    if (isParticle) {
      return (
        <Text key={ti} style={textStyle}>{token.surface}</Text>
      );
    }

    return (
      <TouchableOpacity
        key={ti}
        onPress={() => handleTokenPress(token, lineText)}
        activeOpacity={0.6}
      >
        <View style={styles.tokenWithUnderline}>
          <Text style={textStyle}>{token.surface}</Text>
          <View style={[styles.underline, { backgroundColor: underlineColor }]} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderLyricLine = ({ item, index }: { item: StudyUnit; index: number }) => {
    const isActive = isSynced && index === currentLineIndex;
    return (
      <View style={[styles.lineContainer, isActive ? styles.lineGapActive : styles.lineGapInactive]}>
        <View style={styles.tokensRow}>
          {item.tokens.length > 0
            ? item.tokens.map((token, ti) => renderToken(token, ti, isActive, item.originalText))
            : (
              <Text style={isActive ? styles.tokenTextActive : styles.tokenTextInactive}>
                {item.originalText}
              </Text>
            )}
        </View>
        {item.koreanPronounciation && (
          <Text style={isActive ? styles.pronActive : styles.pronInactive}>
            {item.koreanPronounciation}
          </Text>
        )}
        {item.koreanLyrics && (
          <Text style={isActive ? styles.translationActive : styles.translationInactive}>
            {item.koreanLyrics}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* MV Area */}
      <View style={styles.mvArea}>
        {videoId ? (
          <YouTubePlayer
            videoId={videoId}
            height={220}
            onTimeChange={handleTimeChange}
            onDurationChange={handleDurationChange}
          />
        ) : (
          <View style={styles.mvPlaceholder} />
        )}
        {/* Song info overlay at bottom-left */}
        <View style={styles.songInfoOverlay} pointerEvents="none">
          <ArtworkImage url={null} size={40} cornerRadius={14} />
          <View style={styles.songTexts}>
            <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.songArtist} numberOfLines={1}>{song.artist}</Text>
          </View>
        </View>
      </View>

      {/* Lyrics section */}
      <View style={styles.lyricsWrapper}>
        <FlatList
          ref={flatListRef}
          data={studyUnits}
          keyExtractor={(item) => String(item.index)}
          renderItem={renderLyricLine}
          contentContainerStyle={styles.lyricsList}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          }}
        />
        {/* Fade gradient at bottom of lyrics */}
        <View style={styles.fadeGradient} pointerEvents="none">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: `rgba(255,255,255,${(i / 7) * (i / 7)})`,
              }}
            />
          ))}
        </View>
      </View>

      {/* Mini player */}
      <View style={styles.miniPlayer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentMs)}</Text>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>
      </View>

      {/* Bottom sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['50%']}
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={{ backgroundColor: Colors.textMuted, width: 36 }}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // MV Area
  mvArea: {
    height: 220,
    backgroundColor: '#1A1A1A',
  },
  mvPlaceholder: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  songInfoOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  songTexts: {
    gap: 2,
  },
  songTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: '#000000AA',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  songArtist: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    textShadowColor: '#000000AA',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // Lyrics
  lyricsWrapper: {
    flex: 1,
  },
  lyricsList: {
    padding: 24,
    paddingBottom: 100,
  },
  fadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },

  // Line
  lineContainer: {
    marginBottom: 20,
  },
  lineGapActive: {
    gap: 6,
  },
  lineGapInactive: {
    gap: 4,
  },

  // Tokens
  tokensRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 3,
  },
  tokenTextActive: {
    fontSize: 22,
    fontWeight: '800',
    color: '#18181B',
  },
  tokenTextInactive: {
    fontSize: 18,
    fontWeight: '800',
    color: '#A1A1AA',
  },
  tokenWithUnderline: {
    gap: 2,
  },
  underline: {
    height: 2,
    borderRadius: 1,
    width: '100%',
  },

  // Pronunciation
  pronActive: {
    fontSize: 12,
    color: '#71717A',
  },
  pronInactive: {
    fontSize: 12,
    color: '#A1A1AA',
  },

  // Translation
  translationActive: {
    fontSize: 14,
    fontWeight: '500',
    color: '#18181B',
  },
  translationInactive: {
    fontSize: 13,
    color: '#71717A',
  },

  // Mini player
  miniPlayer: {
  },
  progressTrack: {
    height: 2,
    backgroundColor: '#D4D4D8',
  },
  progressFill: {
    height: 2,
    backgroundColor: '#4F46E5',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
  },

  // Sheet
  sheetBg: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});
