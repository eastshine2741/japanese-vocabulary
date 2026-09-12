import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {CSSProperties} from 'react';

import {convertLineReading, convertReading} from '../../app-rn/src/utils/readingConverter';
import type {LyricToken, PartOfSpeech, PromoLine, PromoReelData, VocabularyWord} from './types';

export const PROMO_FPS = 30;
export const PROMO_DURATION_IN_FRAMES = 990;

const ENDCARD_START_FRAME = 840;

const paper = '#F4F1EA';
const ink = '#FAFAF6';
const green = '#52B788';
const night = '#111012';
const appText = '#1A1A1A';
const appMuted = '#666666';
const appBorder = '#E5E5E5';
const appElevated = '#EEEEEE';

const posColors: Record<PartOfSpeech | string, string> = {
  NOUN: '#5BA9FF',
  VERB: '#3FE0A1',
  ADJECTIVE: '#FFB347',
  NA_ADJECTIVE: '#FF8FB3',
  ADVERB: '#C49BFF',
  PARTICLE: ink,
  PRONOUN: ink,
  ADNOMINAL: ink,
  CONJUNCTION: ink,
  AUXILIARY_VERB: ink,
  INTERJECTION: ink,
  PREFIX: ink,
  SUFFIX: ink,
  EXPRESSION: ink,
  FILLER: ink,
  OTHER: ink,
  SYMBOL: ink,
  SUPPLEMENTARY_SYMBOL: ink,
  WHITESPACE: ink,
};

const posAppColors: Record<string, string> = {
  NOUN: '#5B8FCC',
  VERB: '#4A9D7A',
  ADJECTIVE: '#E89B3E',
  NA_ADJECTIVE: '#E89B3E',
  ADVERB: '#9D7AC4',
  PARTICLE: '#E07595',
};

const jlptColors: Record<string, string> = {
  N1: '#EF4444',
  N2: '#F97316',
  N3: '#EAB308',
  N4: '#14B8A6',
  N5: '#3B82F6',
};

type TextRun = {
  color: string;
  text: string;
};

export const PromoReel = ({data}: {data: PromoReelData}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lines = data.lyricLines.length > 0 ? data.lyricLines : [emptyLine];
  const lineDuration = ENDCARD_START_FRAME / lines.length;
  const activeIndex = Math.min(lines.length - 1, Math.floor(Math.min(frame, ENDCARD_START_FRAME - 1) / lineDuration));
  const activeLine = lines[activeIndex] ?? lines[0];
  const localFrame = Math.max(0, frame - activeIndex * lineDuration);
  const lineEntry = activeIndex === 0 && frame < lineDuration
    ? 1
    : spring({
      config: {damping: 18, mass: 0.7, stiffness: 110},
      fps,
      frame: localFrame,
    });
  const activeOpacity = interpolate(frame, [ENDCARD_START_FRAME - 8, ENDCARD_START_FRAME + 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordCount = data.wordCount ?? uniqueWordCount(lines);

  return (
    <AbsoluteFill style={styles.canvas}>
      <AbsoluteFill>
        <OffthreadVideo
          muted={false}
          src={staticFile(data.song.mvAsset)}
          startFrom={data.sourceStartFrame}
          style={styles.fullVideo}
          volume={0.72}
        />
      </AbsoluteFill>
      <div style={styles.videoBottomScrim} />
      <div style={styles.videoTopScrim} />

      <div style={{...styles.activeLayer, opacity: activeOpacity}}>
        <Header data={data} wordCount={wordCount} />
        <section
          style={{
            ...styles.content,
            opacity: interpolate(lineEntry, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(lineEntry, [0, 1], [20, 0])}px)`,
          }}
        >
          <JapaneseLine line={activeLine} />
          <p style={styles.korean}>{activeLine.koreanLyrics}</p>
          <Vocabulary words={topWords(activeLine.vocabulary)} />
        </section>
      </div>

      <EndCard data={data} activeLine={activeLine} frame={frame} />
    </AbsoluteFill>
  );
};

const Header = ({data, wordCount}: {data: PromoReelData; wordCount: number}) => {
  return (
    <header style={styles.header}>
      <div style={styles.brandSong}>
        <div style={styles.logoTile}>K</div>
        <div style={styles.songText}>
          <span style={styles.title}>{data.song.title}</span>
          <span style={styles.artist}>{data.song.artist}</span>
        </div>
      </div>
      <div style={styles.wordCountChip}>단어 {wordCount}개</div>
      <div style={styles.watermark}>{normalizeHandle(data.instagramHandle)}</div>
    </header>
  );
};

const JapaneseLine = ({line}: {line: PromoLine}) => {
  return (
    <p style={styles.japanese}>
      {buildTextRuns(line).map((run, index) => (
        <span key={`${run.text}-${index}`} style={{color: run.color}}>
          {run.text}
        </span>
      ))}
    </p>
  );
};

const Vocabulary = ({words}: {words: VocabularyWord[]}) => {
  return (
    <div style={styles.wordsBlock}>
      <div style={styles.sectionRule} />
      <div style={styles.wordList}>
        {words.map((word) => {
          const color = posColors[word.partOfSpeech ?? 'OTHER'] ?? ink;
          return (
            <div key={`${word.japanese}-${word.reading}-${word.korean}`} style={styles.wordRow}>
              <div style={styles.wordLeft}>
                <span style={{...styles.wordJapanese, color}}>{word.japanese}</span>
                {word.reading && <span style={styles.wordReading}>{convertReading(word.reading, 'KOREAN')}</span>}
              </div>
              <span style={styles.wordKorean}>{word.korean}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EndCard = ({data, activeLine, frame}: {data: PromoReelData; activeLine: PromoLine; frame: number}) => {
  const {fps} = useVideoConfig();
  const localFrame = frame - ENDCARD_START_FRAME;
  const progress = spring({
    config: {damping: 21, mass: 0.85, stiffness: 120},
    fps,
    frame: Math.max(0, localFrame),
  });
  const opacity = interpolate(frame, [ENDCARD_START_FRAME - 4, ENDCARD_START_FRAME + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const typedLength = Math.min('코토노하'.length, Math.floor(interpolate(localFrame, [18, 82], [0, 4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })));
  const selectedWord = firstWord(data.lyricLines) ?? fallbackWord;

  return (
    <AbsoluteFill style={{...styles.endCardLayer, opacity}}>
      <div style={styles.endBackdrop} />
      <div style={styles.ambientGlow} />
      <div style={{...styles.endTitleBlock, transform: `translateY(${interpolate(progress, [0, 1], [30, 0])}px)`}}>
        <div style={styles.endTitle}>나머지 단어는</div>
        <div style={styles.endTitle}>
          <span style={styles.endTitleBrand}>코토노하</span> 앱에서
        </div>
      </div>
      <AppMockup data={data} activeLine={activeLine} selectedWord={selectedWord} frame={localFrame} />
      <div style={styles.ctaBlock}>
        <div style={styles.searchCue}>
          <span style={styles.searchIcon} />
          <span style={styles.searchQuery}>{'코토노하'.slice(0, typedLength)}</span>
          <span style={{...styles.searchCaret, opacity: Math.floor(localFrame / 12) % 2 === 0 ? 1 : 0}} />
        </div>
        <div style={styles.storeRow}>
          <span style={styles.storeItem}>▷ Google Play</span>
          <span style={styles.storeItem}>Apple App Store</span>
        </div>
        <div style={styles.profileLink}>프로필 링크에서 설치</div>
      </div>
    </AbsoluteFill>
  );
};

const AppMockup = ({
  data,
  activeLine,
  selectedWord,
  frame,
}: {
  data: PromoReelData;
  activeLine: PromoLine;
  selectedWord: VocabularyWord;
  frame: number;
}) => {
  const sheetProgress = interpolate(frame, [18, 52], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const reviewProgress = interpolate(frame, [54, 78], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const revealProgress = interpolate(frame, [92, 114], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const sheetY = interpolate(sheetProgress, [0, 1], [600, 365]);
  const reviewX = interpolate(reviewProgress, [0, 1], [460, 0]);
  const songX = interpolate(reviewProgress, [0, 1], [0, -120]);

  return (
    <div style={styles.phone}>
      <div style={{...styles.phonePage, transform: `translateX(${songX}px)`}}>
        <div style={{...styles.mockHero, ...mockHeroArtwork(data.song.artworkAsset)}}>
          <div style={styles.mockHeroScrim} />
          <div style={styles.mockBack}>{'<'}</div>
          <div style={styles.mockHeroText}>
            <span style={styles.mockSongTitle}>{data.song.title}</span>
            <span style={styles.mockSongArtist}>{data.song.artist}</span>
          </div>
        </div>
        <div style={styles.mockTabs}>
          <span style={styles.mockTabActive}>홈</span>
          <span style={styles.mockTab}>단어</span>
        </div>
        <LyricSheet line={activeLine} words={topWords(activeLine.vocabulary)} y={sheetY} />
      </div>
      <div style={{...styles.reviewPage, transform: `translateX(${reviewX}px)`}}>
        <ReviewMockup word={selectedWord} revealed={revealProgress > 0.55} />
      </div>
    </div>
  );
};

const LyricSheet = ({line, words, y}: {line: PromoLine; words: VocabularyWord[]; y: number}) => {
  return (
    <div style={{...styles.lyricSheet, transform: `translateY(${y}px)`}}>
      <div style={styles.grabber} />
      <div style={styles.sheetMeta}>
        <span>3 / 12</span>
        <span style={styles.syncChip}>싱크 ON</span>
      </div>
      <div style={styles.sheetLyricCard}>
        <p style={styles.sheetJapanese}>{line.originalText}</p>
        <p style={styles.sheetReading}>{convertLineReading(line.originalText, readingTokens(line.tokens), 'KOREAN')}</p>
        <p style={styles.sheetKorean}>{line.koreanLyrics}</p>
      </div>
      <div style={styles.sheetRows}>
        {words.map((word) => <MockWordRow key={`${word.japanese}-${word.korean}`} word={word} />)}
      </div>
    </div>
  );
};

const MockWordRow = ({word}: {word: VocabularyWord}) => {
  const posColor = posAppColors[word.partOfSpeech ?? 'OTHER'] ?? appMuted;
  const jlptColor = word.jlpt ? (jlptColors[word.jlpt] ?? appMuted) : appMuted;
  return (
    <div style={styles.mockWordRow}>
      <div style={styles.mockWordTop}>
        <span style={styles.mockWordJapanese}>{word.japanese}</span>
        <span style={styles.mockWordReading}>{convertReading(word.reading, 'KOREAN')}</span>
        <span style={styles.mockSaveButton}>+</span>
      </div>
      <div style={styles.mockMeaningRow}>
        <span style={styles.mockMeaning}>{word.korean}</span>
        {word.jlpt && <span style={{...styles.mockBadge, color: jlptColor, backgroundColor: `${jlptColor}20`}}>{word.jlpt}</span>}
        {word.partOfSpeechLabel && (
          <span style={{...styles.mockBadge, color: posColor, backgroundColor: `${posColor}20`}}>{word.partOfSpeechLabel}</span>
        )}
      </div>
    </div>
  );
};

const ReviewMockup = ({word, revealed}: {word: VocabularyWord; revealed: boolean}) => {
  return (
    <div style={styles.reviewScreen}>
      <div style={styles.reviewNav}>
        <span>{'<'}</span>
        {revealed && <span>↗</span>}
      </div>
      <div style={styles.reviewCardArea}>
        <div style={styles.reviewKanji}>{word.japanese}</div>
        {revealed && (
          <div style={styles.reviewBack}>
            <span style={styles.reviewReading}>{convertReading(word.reading, 'KOREAN')}</span>
            <div style={styles.reviewBadges}>
              {word.partOfSpeechLabel && <span style={styles.reviewBadge}>{word.partOfSpeechLabel}</span>}
              {word.jlpt && <span style={styles.reviewBadge}>{word.jlpt}</span>}
            </div>
            <span style={styles.reviewMeaning}>{word.korean}</span>
          </div>
        )}
      </div>
      <div style={styles.reviewProgress}>
        <span>1 / 1</span>
        <div style={styles.reviewTrack}><div style={styles.reviewFill} /></div>
      </div>
      {revealed ? (
        <div style={styles.ratingRow}>
          {['다시', '어려움', '보통', '쉬움'].map((label) => <span key={label} style={styles.rating}>{label}</span>)}
        </div>
      ) : (
        <div style={styles.reviewHint}>탭하여 뒷면 보기</div>
      )}
    </div>
  );
};

const buildTextRuns = (line: PromoLine): TextRun[] => {
  const runs: TextRun[] = [];
  let cursor = 0;

  for (const token of [...line.tokens].sort((a, b) => a.charStart - b.charStart)) {
    if (token.charStart > cursor) {
      runs.push({color: ink, text: line.originalText.slice(cursor, token.charStart)});
    }
    runs.push({
      color: posColors[token.partOfSpeech] ?? ink,
      text: line.originalText.slice(token.charStart, token.charEnd),
    });
    cursor = Math.max(cursor, token.charEnd);
  }

  if (cursor < line.originalText.length) {
    runs.push({color: ink, text: line.originalText.slice(cursor)});
  }

  return runs.filter((run) => run.text.length > 0);
};

const topWords = (words: VocabularyWord[]) => words.slice(0, 2);

const uniqueWordCount = (lines: PromoLine[]) => {
  const keys = new Set<string>();
  for (const line of lines) {
    for (const word of line.vocabulary) {
      keys.add(word.japanese);
    }
  }
  return keys.size;
};

const firstWord = (lines: PromoLine[]) => lines.flatMap((line) => line.vocabulary)[0];

const readingTokens = (tokens: LyricToken[]) => tokens.map((token) => ({
  surface: token.surface,
  reading: token.reading ?? token.baseFormReading ?? token.surface,
  charStart: token.charStart,
  charEnd: token.charEnd,
  partOfSpeech: token.partOfSpeech,
}));

const normalizeHandle = (handle: string) => handle === '@kotonoha.music' ? '@kotonoha.app' : handle;

const mockHeroArtwork = (artworkAsset: string): CSSProperties => {
  if (artworkAsset.trim() === '') return {};
  const url = artworkAsset.startsWith('http') ? artworkAsset : staticFile(artworkAsset);
  return {
    backgroundImage: `linear-gradient(180deg, rgba(20,20,20,0.1), rgba(0,0,0,0.86)), url("${url}")`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  };
};

const emptyLine: PromoLine = {
  startFrame: 0,
  originalText: '',
  koreanLyrics: '',
  tokens: [],
  vocabulary: [],
};

const fallbackWord: VocabularyWord = {
  japanese: '言葉',
  reading: 'コトバ',
  korean: '말, 단어',
  partOfSpeech: 'NOUN',
  partOfSpeechLabel: '명사',
  jlpt: 'N3',
};

const fontStack =
  '"Noto Sans CJK KR", "Noto Sans CJK JP", "Apple SD Gothic Neo", "Hiragino Sans", sans-serif';

const styles = {
  canvas: {
    backgroundColor: night,
    color: ink,
    fontFamily: fontStack,
    overflow: 'hidden',
  },
  fullVideo: {
    height: '100%',
    objectFit: 'cover',
    width: '100%',
  },
  videoTopScrim: {
    background: 'linear-gradient(180deg, rgba(17,16,18,0.95) 0%, rgba(17,16,18,0) 100%)',
    height: 300,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  videoBottomScrim: {
    background:
      'linear-gradient(180deg, rgba(17,16,18,0) 0%, rgba(17,16,18,0.72) 20%, rgba(17,16,18,0.91) 32%, rgba(17,16,18,0.95) 55%, rgba(17,16,18,0.95) 100%)',
    bottom: 0,
    height: 1300,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 620,
  },
  activeLayer: {
    inset: 0,
    position: 'absolute',
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    height: 96,
    left: 72,
    position: 'absolute',
    right: 72,
    top: 118,
    zIndex: 4,
  },
  brandSong: {
    alignItems: 'center',
    display: 'flex',
    gap: 22,
  },
  logoTile: {
    alignItems: 'center',
    backgroundColor: green,
    borderRadius: 20,
    color: ink,
    display: 'flex',
    fontSize: 44,
    fontWeight: 900,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  songText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  title: {
    color: ink,
    fontSize: 50,
    fontWeight: 800,
    lineHeight: 1,
  },
  artist: {
    color: 'rgba(250,250,246,0.78)',
    fontSize: 29,
    fontWeight: 500,
    lineHeight: 1,
  },
  wordCountChip: {
    backgroundColor: 'rgba(244,241,234,0.14)',
    border: '1px solid rgba(244,241,234,0.22)',
    borderRadius: 999,
    color: paper,
    fontSize: 25,
    fontWeight: 800,
    marginLeft: 22,
    padding: '10px 16px',
  },
  watermark: {
    color: 'rgba(250,250,246,0.35)',
    fontSize: 28,
    fontWeight: 500,
    marginLeft: 'auto',
  },
  content: {
    left: 160,
    position: 'absolute',
    right: 160,
    textAlign: 'center',
    top: 1030,
    zIndex: 4,
  },
  japanese: {
    color: ink,
    fontSize: 58,
    fontWeight: 700,
    lineHeight: 1.18,
    margin: 0,
  },
  korean: {
    color: 'rgba(250,250,246,0.85)',
    fontSize: 38,
    fontWeight: 500,
    lineHeight: 1.28,
    margin: '20px 0 0',
  },
  wordsBlock: {
    margin: '80px auto 0',
    width: 600,
  },
  sectionRule: {
    backgroundColor: 'rgba(244,241,234,0.20)',
    height: 2,
    marginBottom: 40,
    width: '100%',
  },
  wordList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 36,
  },
  wordRow: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  wordLeft: {
    alignItems: 'baseline',
    display: 'flex',
    gap: 12,
    minWidth: 0,
  },
  wordJapanese: {
    fontSize: 48,
    fontWeight: 700,
    lineHeight: 1,
  },
  wordReading: {
    color: 'rgba(250,250,246,0.50)',
    fontSize: 24,
    fontWeight: 500,
  },
  wordKorean: {
    color: 'rgba(250,250,246,0.90)',
    fontSize: 36,
    fontWeight: 600,
    lineHeight: 1,
    maxWidth: 270,
    textAlign: 'right',
  },
  endCardLayer: {
    overflow: 'hidden',
    zIndex: 10,
  },
  endBackdrop: {
    background: 'linear-gradient(180deg, rgba(17,16,18,0.22) 0%, rgba(17,16,18,0.62) 40%, #111012 100%)',
    inset: 0,
    position: 'absolute',
  },
  ambientGlow: {
    background: 'radial-gradient(circle, rgba(239,212,99,0.18) 0%, rgba(239,212,99,0) 62%)',
    height: 900,
    left: 90,
    position: 'absolute',
    top: 250,
    width: 900,
  },
  endTitleBlock: {
    left: 60,
    position: 'absolute',
    right: 60,
    textAlign: 'center',
    top: 150,
  },
  endTitle: {
    color: paper,
    fontSize: 92,
    fontWeight: 800,
    lineHeight: 1.14,
  },
  endTitleBrand: {
    color: green,
  },
  phone: {
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(244,241,234,0.24)',
    borderRadius: 46,
    boxShadow: '0 34px 90px rgba(0,0,0,0.48)',
    height: 860,
    left: 310,
    overflow: 'hidden',
    position: 'absolute',
    top: 400,
    width: 460,
  },
  phonePage: {
    height: 860,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 460,
  },
  mockHero: {
    background: `linear-gradient(180deg, rgba(20,20,20,0.1), rgba(0,0,0,0.86)), ${green}`,
    height: 300,
    overflow: 'hidden',
    position: 'relative',
    width: 460,
  },
  mockHeroScrim: {
    background: 'radial-gradient(circle at 55% 35%, rgba(244,241,234,0.45), rgba(244,241,234,0) 32%)',
    inset: 0,
    position: 'absolute',
  },
  mockBack: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 400,
    left: 22,
    position: 'absolute',
    top: 18,
  },
  mockHeroText: {
    bottom: 38,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    left: 22,
    position: 'absolute',
  },
  mockSongTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: 800,
  },
  mockSongArtist: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 20,
    fontWeight: 500,
  },
  mockTabs: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottom: `2px solid ${appBorder}`,
    display: 'flex',
    gap: 28,
    height: 52,
    paddingLeft: 22,
  },
  mockTabActive: {
    borderBottom: `4px solid ${green}`,
    color: green,
    fontSize: 22,
    fontWeight: 700,
    paddingBottom: 6,
  },
  mockTab: {
    color: appMuted,
    fontSize: 22,
    fontWeight: 700,
    paddingBottom: 10,
  },
  lyricSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: '26px 26px 0 0',
    height: 595,
    left: 0,
    padding: '12px 18px 0',
    position: 'absolute',
    top: 0,
    width: 460,
  },
  grabber: {
    backgroundColor: '#D8D8D8',
    borderRadius: 999,
    height: 5,
    margin: '0 auto 15px',
    width: 44,
  },
  sheetMeta: {
    alignItems: 'center',
    color: appMuted,
    display: 'flex',
    fontSize: 17,
    fontWeight: 500,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  syncChip: {
    backgroundColor: 'rgba(82,183,136,0.13)',
    border: `1px solid ${green}`,
    borderRadius: 999,
    color: green,
    fontSize: 16,
    fontWeight: 700,
    padding: '5px 12px 6px',
  },
  sheetLyricCard: {
    backgroundColor: appElevated,
    borderRadius: 12,
    padding: '22px 12px 18px',
    textAlign: 'center',
  },
  sheetJapanese: {
    color: appText,
    fontSize: 23,
    fontWeight: 700,
    lineHeight: 1.25,
    margin: 0,
  },
  sheetReading: {
    color: appMuted,
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 1.25,
    margin: '12px 0 0',
  },
  sheetKorean: {
    color: appText,
    fontSize: 19,
    fontWeight: 600,
    lineHeight: 1.25,
    margin: '8px 0 0',
  },
  sheetRows: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: 18,
  },
  mockWordRow: {
    borderBottom: `1px solid ${appBorder}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 92,
    padding: '13px 0 12px',
  },
  mockWordTop: {
    alignItems: 'center',
    display: 'flex',
    gap: 9,
  },
  mockWordJapanese: {
    color: appText,
    fontSize: 27,
    fontWeight: 700,
  },
  mockWordReading: {
    color: appMuted,
    fontSize: 16,
    fontWeight: 500,
  },
  mockSaveButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(82,183,136,0.13)',
    borderRadius: 14,
    color: green,
    display: 'flex',
    fontSize: 17,
    fontWeight: 700,
    height: 28,
    justifyContent: 'center',
    marginLeft: 'auto',
    width: 28,
  },
  mockMeaningRow: {
    alignItems: 'center',
    display: 'flex',
    gap: 6,
  },
  mockMeaning: {
    color: appMuted,
    fontSize: 19,
    fontWeight: 500,
    marginRight: 6,
    maxWidth: 220,
  },
  mockBadge: {
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    padding: '5px 9px',
  },
  reviewPage: {
    backgroundColor: '#FFFFFF',
    height: 860,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 460,
  },
  reviewScreen: {
    backgroundColor: '#FFFFFF',
    color: appText,
    display: 'flex',
    flexDirection: 'column',
    height: 860,
    padding: '20px 20px 24px',
  },
  reviewNav: {
    alignItems: 'center',
    color: appMuted,
    display: 'flex',
    fontSize: 30,
    height: 46,
    justifyContent: 'space-between',
  },
  reviewCardArea: {
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: 0,
  },
  reviewKanji: {
    color: appText,
    fontSize: 56,
    fontWeight: 700,
    lineHeight: 1,
  },
  reviewBack: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 34,
    textAlign: 'center',
  },
  reviewReading: {
    color: appMuted,
    fontSize: 20,
  },
  reviewBadges: {
    display: 'flex',
    gap: 8,
  },
  reviewBadge: {
    backgroundColor: 'rgba(82,183,136,0.13)',
    borderRadius: 999,
    color: green,
    fontSize: 14,
    fontWeight: 700,
    padding: '6px 10px',
  },
  reviewMeaning: {
    color: appText,
    fontSize: 22,
    fontWeight: 600,
  },
  reviewProgress: {
    alignItems: 'center',
    color: appMuted,
    display: 'flex',
    flexDirection: 'column',
    fontSize: 13,
    gap: 20,
  },
  reviewTrack: {
    backgroundColor: appElevated,
    borderRadius: 2,
    height: 4,
    width: '100%',
  },
  reviewFill: {
    backgroundColor: green,
    borderRadius: 2,
    height: 4,
    width: '100%',
  },
  reviewHint: {
    color: '#888888',
    fontSize: 13,
    height: 48,
    marginTop: 20,
    textAlign: 'center',
  },
  ratingRow: {
    display: 'flex',
    gap: 8,
    height: 48,
    marginTop: 20,
  },
  rating: {
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    color: '#10B981',
    display: 'flex',
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    justifyContent: 'center',
  },
  ctaBlock: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    left: 60,
    position: 'absolute',
    right: 60,
    top: 1320,
  },
  searchCue: {
    alignItems: 'center',
    backgroundColor: paper,
    borderRadius: 34,
    display: 'flex',
    height: 96,
    padding: '0 44px',
    width: 351,
  },
  searchIcon: {
    border: `4px solid ${night}`,
    borderRadius: 999,
    display: 'block',
    height: 30,
    marginRight: 32,
    width: 30,
  },
  searchQuery: {
    color: night,
    fontSize: 46,
    fontWeight: 700,
    lineHeight: 1,
    minWidth: 170,
  },
  searchCaret: {
    backgroundColor: night,
    borderRadius: 3,
    display: 'block',
    height: 48,
    width: 5,
  },
  storeRow: {
    color: 'rgba(250,250,246,0.78)',
    display: 'flex',
    fontSize: 30,
    fontWeight: 600,
    gap: 44,
    marginTop: 20,
  },
  storeItem: {
    whiteSpace: 'nowrap',
  },
  profileLink: {
    color: 'rgba(250,250,246,0.78)',
    fontSize: 28,
    fontWeight: 500,
    marginTop: 20,
  },
} satisfies Record<string, CSSProperties>;
