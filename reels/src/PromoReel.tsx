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
// 엔드카드 5초. 앱 목업 + 스토어 검색 큐를 읽을 시간이다.
export const END_CARD_DURATION_IN_FRAMES = 150;

// 릴스 팔레트 — japanese-vocabulary.pen 의 Reel v2 프레임 변수와 같은 값
const night = '#111012';
const paper = '#F4F1EA';
const ink = '#FAFAF6';
const softInk = '#FAFAF6C7';
const green = '#52B788';
const glow = '#EFD463';

// 앱 테마(app-rn/src/theme/theme.ts, 라이트). 엔드카드 목업은 실제 앱 화면을 그린다.
const app = {
  primary: '#52B788',
  primaryBg: '#52B78820',
  background: '#FFFFFF',
  elevated: '#EEEEEE',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#888888',
  border: '#E5E5E5',
  track: '#F6F6F6',
  studying: '#FABD23',
  newIndicator: '#D2D2D2',
  furigana: '#777777',
};

// 가사 강조색. 내용어 다섯 품사만 색을 갖고 나머지는 흰색이다(앱 Spotlight 와 같은 규칙).
const spotlightColors: Partial<Record<PartOfSpeech | string, string>> = {
  NOUN: '#5BA9FF',
  VERB: '#3FE0A1',
  ADJECTIVE: '#FFB347',
  NA_ADJECTIVE: '#FF8FB3',
  ADVERB: '#C49BFF',
};

// 앱 안 품사색(types/pos.ts). 목업의 밑줄·배지에 쓴다.
const posAppColors: Record<string, string> = {
  NOUN: '#5B8FCC',
  VERB: '#4A9D7A',
  ADJECTIVE: '#E89B3E',
  NA_ADJECTIVE: '#E89B3E',
  ADVERB: '#9D7AC4',
  PRONOUN: '#5B8FCC',
  ADNOMINAL: '#5B8FCC',
  CONJUNCTION: '#5B8FCC',
  AUXILIARY_VERB: '#4A9D7A',
  PARTICLE: '#E07595',
  INTERJECTION: '#5B8FCC',
  PREFIX: '#5B8FCC',
  SUFFIX: '#5B8FCC',
  EXPRESSION: '#5B8FCC',
};

const posLabels: Record<string, string> = {
  NOUN: '명사',
  VERB: '동사',
  ADJECTIVE: '형용사',
  NA_ADJECTIVE: '형용동사',
  ADVERB: '부사',
  PRONOUN: '대명사',
  ADNOMINAL: '연체사',
  CONJUNCTION: '접속사',
  AUXILIARY_VERB: '조동사',
  PARTICLE: '조사',
  INTERJECTION: '감동사',
  PREFIX: '접두사',
  SUFFIX: '접미사',
  EXPRESSION: '표현',
};

const jlptColors: Record<string, string> = {
  N1: '#EF4444',
  N2: '#F97316',
  N3: '#EAB308',
  N4: '#14B8A6',
  N5: '#3B82F6',
};

const NO_UNDERLINE_POS = new Set(['SYMBOL', 'SUPPLEMENTARY_SYMBOL', 'WHITESPACE']);
const NON_WORD_POS = new Set(['PARTICLE', 'AUXILIARY_VERB', 'SYMBOL', 'SUPPLEMENTARY_SYMBOL', 'WHITESPACE']);
const KANJI_RE = /[一-鿿]/;

type TextRun = {
  color: string;
  text: string;
};

export const PromoReel = ({data}: {data: PromoReelData}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const lines = data.lyricLines.length > 0 ? data.lyricLines : [emptyLine];
  const lyricsEndFrame = Math.max(1, data.lyricsEndFrame);
  // 지금 프레임에 시작해 있는 마지막 줄이 현재 줄이다. MV 타임라인과 같은 기준(startFrame)이다.
  const activeIndex = lines.reduce((found, line, index) => (line.startFrame <= frame ? index : found), 0);
  const activeLine = lines[activeIndex];
  const localFrame = Math.max(0, frame - activeLine.startFrame);
  // 첫 줄은 진입 애니메이션 없이 정지 상태로 시작한다 — 릴스 첫 0.5초가 비면 그대로 넘긴다.
  const entry = (delay: number) => (activeIndex === 0
    ? 1
    : spring({
      config: {damping: 18, mass: 0.7, stiffness: 110},
      fps,
      frame: Math.max(0, localFrame - delay),
    }));
  const lyricEntry = entry(0);
  const wordsEntry = entry(4);
  const activeOpacity = interpolate(frame, [lyricsEndFrame - 8, lyricsEndFrame + 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={styles.canvas}>
      <AbsoluteFill>
        <OffthreadVideo
          muted={false}
          src={staticFile(data.song.mvAsset)}
          startFrom={data.sourceStartFrame}
          style={styles.fullVideo}
          volume={(f) => interpolate(f, [durationInFrames - 36, durationInFrames - 1], [0.72, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}
        />
      </AbsoluteFill>
      <div style={styles.videoBottomScrim} />
      <div style={styles.videoTopScrim} />

      <div style={{...styles.activeLayer, opacity: activeOpacity}}>
        <Header data={data} />
        <section style={styles.content}>
          <div style={{...styles.lyricBlock, ...entryStyle(lyricEntry)}}>
            <JapaneseLine line={activeLine} />
            <p style={styles.korean}>{activeLine.koreanLyrics}</p>
          </div>
          <div style={entryStyle(wordsEntry)}>
            <Vocabulary words={topWords(activeLine.vocabulary)} />
          </div>
        </section>
      </div>

      <EndCard data={data} line={lines[lines.length - 1]} lineCount={lines.length} startFrame={lyricsEndFrame} />
    </AbsoluteFill>
  );
};

const entryStyle = (progress: number): CSSProperties => ({
  opacity: interpolate(progress, [0, 1], [0, 1]),
  transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`,
});

const Header = ({data}: {data: PromoReelData}) => {
  return (
    <header style={styles.header}>
      <div style={styles.songText}>
        <span style={styles.title}>{data.song.title}</span>
        <span style={styles.artist}>{data.song.artist}</span>
      </div>
      <div style={styles.watermark}>{normalizeHandle(data.instagramHandle)}</div>
    </header>
  );
};

const JapaneseLine = ({line}: {line: PromoLine}) => {
  return (
    <p style={{...styles.japanese, fontSize: japaneseFontSize(line.originalText)}}>
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
          const color = spotlightColors[word.partOfSpeech ?? ''] ?? ink;
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

const EndCard = ({
  data,
  line,
  lineCount,
  startFrame,
}: {
  data: PromoReelData;
  line: PromoLine;
  lineCount: number;
  startFrame: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const localFrame = frame - startFrame;
  if (localFrame < -4) return null;
  const progress = spring({
    config: {damping: 21, mass: 0.85, stiffness: 120},
    fps,
    frame: Math.max(0, localFrame),
  });
  const opacity = interpolate(localFrame, [-4, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const typedLength = Math.floor(interpolate(localFrame, [24, 72], [0, 4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));
  const artwork = artworkUrl(data.song.artworkAsset);

  return (
    <AbsoluteFill style={{...styles.endCardLayer, opacity}}>
      {artwork && <div style={{...styles.endBackdropArt, backgroundImage: `url("${artwork}")`}} />}
      <div style={styles.endBackdropScrim} />
      <div style={styles.ambientGlow} />
      <div style={{...styles.endTitleBlock, transform: `translateY(${interpolate(progress, [0, 1], [30, 0])}px)`}}>
        <div style={styles.endTitle}>전체 단어는</div>
        <div style={styles.endTitle}>
          <span style={styles.endTitleBrand}>코토노하</span> 앱에서
        </div>
      </div>
      <AppMockup data={data} line={line} lineCount={lineCount} artwork={artwork} frame={localFrame} />
      <div style={styles.ctaBlock}>
        <div style={styles.searchCue}>
          <SearchIcon />
          <span style={styles.searchQuery}>{'코토노하'.slice(0, typedLength)}</span>
          <span style={{...styles.searchCaret, opacity: Math.floor(localFrame / 14) % 2 === 0 ? 1 : 0}} />
        </div>
        <div style={styles.storeRow}>
          <span style={styles.storeItem}><GooglePlayIcon /> Google Play</span>
          <span style={styles.storeItem}><AppStoreIcon /> App Store</span>
        </div>
        <div style={styles.profileLink}>프로필 링크에서 설치</div>
      </div>
    </AbsoluteFill>
  );
};

// ─── 앱 목업 ───────────────────────────────────────────────────────────────────
// SongDetailScreen(hero 360 · 홈/단어 탭 · 홈 탭 본문 · MV 바)을 460×860 폰 안에 그리고,
// CurrentPlayingWordsSheet 가 MV 바를 핸들 삼아 올라온다. 타이포는 실제 비율보다 1.2배 크다 —
// 릴스에서 축소돼 보이므로 실제 스케일 그대로 두면 안 읽힌다.

const PHONE_WIDTH = 460;
const PHONE_HEIGHT = 860;
const SHEET_PEEK_HEIGHT = 80;
const SHEET_EXPANDED_TOP = 64;

const AppMockup = ({
  data,
  line,
  lineCount,
  artwork,
  frame,
}: {
  data: PromoReelData;
  line: PromoLine;
  lineCount: number;
  artwork: string | null;
  frame: number;
}) => {
  const {fps} = useVideoConfig();
  const rise = spring({
    config: {damping: 24, mass: 1, stiffness: 60},
    fps,
    frame: Math.max(0, frame - 26),
  });
  const sheetTop = interpolate(rise, [0, 1], [PHONE_HEIGHT - SHEET_PEEK_HEIGHT, SHEET_EXPANDED_TOP]);
  const words = mockWords(line);

  return (
    <div style={styles.phone}>
      <SongDetailPage data={data} artwork={artwork} wordCount={data.wordCount ?? uniqueWordCount(data.lyricLines)} />
      <div style={{...styles.sheet, top: sheetTop, height: PHONE_HEIGHT - SHEET_EXPANDED_TOP}}>
        <div style={styles.sheetGrabber} />
        <MvBar data={data} />
        <div style={styles.syncRow}>
          <span style={styles.pageStatus}>{line.lineNumber ?? lineCount}/{data.totalLineCount ?? lineCount}</span>
          <span style={styles.syncChip}>싱크 ON</span>
        </div>
        <div style={styles.sheetPage}>
          <LyricBlock line={line} />
          <div style={styles.mockWordList}>
            {words.map((word, index) => (
              <MockWordRow key={`${word.japanese}-${word.korean}`} word={word} showDivider={index < words.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SongDetailPage = ({data, artwork, wordCount}: {data: PromoReelData; artwork: string | null; wordCount: number}) => {
  const majorWords = data.lyricLines.flatMap((line) => line.vocabulary).filter(uniqueByJapanese()).slice(0, 3);
  return (
    <div style={styles.phonePage}>
      <div style={styles.mockHero}>
        {artwork
          ? <div style={{...styles.mockHeroArt, backgroundImage: `url("${artwork}")`}} />
          : <div style={{...styles.mockHeroArt, backgroundColor: app.textPrimary}} />}
        <div style={styles.mockHeroScrim} />
        <div style={styles.mockHeroBottomScrim} />
        <div style={styles.mockBackButton}><ChevronLeftIcon /></div>
        <div style={styles.mockHeroInfo}>
          <span style={styles.mockSongTitle}>{data.song.title}</span>
          <span style={styles.mockSongArtist}>{data.song.artist}</span>
          <div style={styles.mockDeckButton}><LayersIcon /><span>학습 시작</span></div>
        </div>
      </div>
      <div style={styles.mockTabBar}>
        <div style={styles.mockTab}><span style={styles.mockTabLabelActive}>홈</span><div style={styles.mockTabIndicator} /></div>
        <div style={styles.mockTab}><span style={styles.mockTabLabel}>단어</span></div>
      </div>
      <div style={styles.mockHome}>
        <div style={styles.mockSectionHeader}>
          <span style={styles.mockSectionTitle}>나의 진도</span>
          <span style={styles.mockProgressCount}>{wordCount}개 중 0개</span>
        </div>
        <div style={styles.mockProgressTrack} />
        <div style={styles.mockLegend}>
          <Legend color={app.primary} label="아는 단어 0" />
          <Legend color={app.studying} label="익히는 중 0" />
          <Legend color={app.newIndicator} label={`아직 ${wordCount}`} />
        </div>
        <div style={{...styles.mockSectionHeader, marginTop: 30}}>
          <span style={styles.mockSectionTitle}>핵심 단어</span>
        </div>
        <span style={styles.mockSectionHint}>뜻을 보기 전에, 아는 단어인지 먼저 떠올려 보세요.</span>
        <div style={styles.mockCardRail}>
          {majorWords.map((word) => (
            <div key={word.japanese} style={styles.mockWordCard}>
              {word.jlpt && <Badge color={jlptColors[word.jlpt] ?? app.textMuted} label={word.jlpt} bold />}
              <span style={styles.mockCardKanji}>{word.japanese}</span>
              <div style={styles.mockRevealPill}>뜻 확인하기</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Legend = ({color, label}: {color: string; label: string}) => (
  <span style={styles.mockLegendItem}><span style={{...styles.mockLegendDot, backgroundColor: color}} />{label}</span>
);

const MvBar = ({data}: {data: PromoReelData}) => (
  <div style={styles.mvBar}>
    <div style={styles.mvThumb}><span style={styles.mvTag}>MV</span><PlayIcon /></div>
    <div style={styles.mvText}>
      <span style={styles.mvTitle}>{data.song.title}</span>
      <span style={styles.mvArtist}>{data.song.artist}</span>
    </div>
    <PauseIcon />
  </div>
);

const LyricBlock = ({line}: {line: PromoLine}) => {
  const tokens = buildMockLyricTokens(line);
  const fontSize = mockLyricFontSize(tokens, PHONE_WIDTH - 2 * 25);
  const readingSize = Math.max(6, Math.round(fontSize * 0.5));
  const pronunciation = convertLineReading(line.originalText, readingTokens(line.tokens), 'KOREAN');
  return (
    <div style={styles.mockLyricBlock}>
      <div style={styles.mockLyricTokens}>
        {tokens.map((token) => (
          <div key={token.key} style={styles.mockLyricToken}>
            <span style={{...styles.mockFurigana, fontSize: readingSize, lineHeight: `${readingSize + 2}px`}}>{token.reading}</span>
            <span style={{...styles.mockTokenText, fontSize, lineHeight: `${fontSize + 3}px`}}>{token.text}</span>
            <div style={{...styles.mockTokenUnderline, backgroundColor: token.underlineColor ?? 'transparent'}} />
          </div>
        ))}
      </div>
      {(pronunciation || line.koreanLyrics) && (
        <div style={styles.mockKorean}>
          {pronunciation && <span style={styles.mockPronunciation}>{pronunciation}</span>}
          {line.koreanLyrics && <span style={styles.mockTranslation}>{line.koreanLyrics}</span>}
        </div>
      )}
    </div>
  );
};

const MockWordRow = ({word, showDivider}: {word: VocabularyWord; showDivider: boolean}) => {
  const pos = word.partOfSpeech ?? '';
  const posLabel = word.partOfSpeechLabel ?? posLabels[pos] ?? '';
  const posColor = posAppColors[pos] ?? app.textMuted;
  const jlptColor = word.jlpt ? (jlptColors[word.jlpt] ?? app.textMuted) : app.textMuted;
  return (
    <div style={{...styles.mockWordRow, borderBottom: showDivider ? `1px solid ${app.border}` : 'none'}}>
      <div style={styles.mockWordInfo}>
        <div style={styles.mockWordJpRow}>
          <span style={styles.mockWordJapanese}>{word.japanese}</span>
          {word.reading && <span style={styles.mockWordReading}>{convertReading(word.reading, 'KOREAN')}</span>}
        </div>
        <div style={styles.mockMeaningRow}>
          <span style={styles.mockMeaning}>{word.korean}</span>
          <div style={styles.mockBadges}>
            {word.jlpt && <Badge color={jlptColor} label={word.jlpt} bold />}
            {posLabel && <Badge color={posColor} label={posLabel} />}
          </div>
        </div>
      </div>
      <ChevronRightIcon />
    </div>
  );
};

const Badge = ({color, label, bold}: {color: string; label: string; bold?: boolean}) => (
  <span style={{...styles.mockBadge, color, backgroundColor: `${color}20`, fontWeight: bold ? 700 : 600}}>{label}</span>
);

// ─── 아이콘 ────────────────────────────────────────────────────────────────────

const svgProps = {fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round'} as const;

const ChevronLeftIcon = () => (
  <svg height={24} viewBox="0 0 24 24" width={24} {...svgProps} strokeWidth={2.4}><path d="M15 18l-6-6 6-6" /></svg>
);
const ChevronRightIcon = () => (
  <svg height={23} style={{color: app.textMuted, flexShrink: 0}} viewBox="0 0 24 24" width={23} {...svgProps} strokeWidth={2.2}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
const LayersIcon = () => (
  <svg height={20} viewBox="0 0 24 24" width={20} {...svgProps} strokeWidth={2}>
    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
  </svg>
);
const PlayIcon = () => (
  <svg height={16} viewBox="0 0 24 24" width={16}><circle cx={12} cy={12} fill="#FFFFFF" r={11} /><path d="M10 8l6 4-6 4z" fill="#111111" /></svg>
);
const PauseIcon = () => (
  <svg height={26} viewBox="0 0 24 24" width={26}><rect fill={app.primary} height={16} rx={1.5} width={4} x={6} y={4} /><rect fill={app.primary} height={16} rx={1.5} width={4} x={14} y={4} /></svg>
);
const SearchIcon = () => (
  <svg height={44} style={{color: night}} viewBox="0 0 24 24" width={44} {...svgProps} strokeWidth={2.4}>
    <circle cx={11} cy={11} r={7} /><path d="M20 20l-3.5-3.5" />
  </svg>
);
const GooglePlayIcon = () => (
  <svg height={40} viewBox="0 0 24 24" width={40} {...svgProps} strokeWidth={1.8}>
    <path d="M4 3.5v17l9.5-8.5L4 3.5z" /><path d="M4 3.5l12.5 7L4 20.5" /><path d="M16.5 10.5l3.2 1.8-3.2 1.8" />
  </svg>
);
const AppStoreIcon = () => (
  <svg height={40} viewBox="0 0 24 24" width={40} {...svgProps} strokeWidth={1.8}>
    <path d="M8.5 20l7-12" /><path d="M15.5 20l-7-12" /><path d="M4 15h16" /><path d="M12 7l-1.5-2.5M12 7l1.5-2.5" />
  </svg>
);

// ─── 데이터 도우미 ───────────────────────────────────────────────────────────────

// 강조 단어(vocabulary)만 품사색을 갖고 나머지 토큰은 흰색이다.
const buildTextRuns = (line: PromoLine): TextRun[] => {
  const keyWords = new Set(line.vocabulary.map((word) => word.japanese));
  const runs: TextRun[] = [];
  let cursor = 0;

  for (const token of [...line.tokens].sort((a, b) => a.charStart - b.charStart)) {
    if (token.charStart > cursor) {
      runs.push({color: ink, text: line.originalText.slice(cursor, token.charStart)});
    }
    const isKeyWord = keyWords.has(token.baseForm) || keyWords.has(token.surface);
    runs.push({
      color: isKeyWord ? (spotlightColors[token.partOfSpeech] ?? ink) : ink,
      text: line.originalText.slice(token.charStart, token.charEnd),
    });
    cursor = Math.max(cursor, token.charEnd);
  }

  if (cursor < line.originalText.length) {
    runs.push({color: ink, text: line.originalText.slice(cursor)});
  }

  return runs.filter((run) => run.text.length > 0);
};

// 760px 폭에 58px 이면 한 줄 13자다. 긴 줄은 세 줄을 넘지 않게 줄인다.
const japaneseFontSize = (text: string) => {
  const length = text.replace(/\s+/g, '').length;
  if (length <= 26) return 58;
  if (length <= 40) return 48;
  return 42;
};

const topWords = (words: VocabularyWord[]) => words.slice(0, 2);

const uniqueByJapanese = () => {
  const seen = new Set<string>();
  return (word: VocabularyWord) => {
    if (seen.has(word.japanese)) return false;
    seen.add(word.japanese);
    return true;
  };
};

const uniqueWordCount = (lines: PromoLine[]) => lines.flatMap((line) => line.vocabulary).filter(uniqueByJapanese()).length;

// 시트의 단어 목록은 그 줄의 단어 전부다(릴스 강조 단어 2개가 아니라). 뜻 있는 내용어 토큰으로 만든다.
const mockWords = (line: PromoLine): VocabularyWord[] => {
  const fromTokens = line.tokens
    .filter((token) => !NON_WORD_POS.has(token.partOfSpeech) && (token.koreanText ?? '').trim() !== '')
    .map((token): VocabularyWord => ({
      japanese: token.baseForm || token.surface,
      reading: token.baseFormReading ?? token.reading ?? '',
      korean: token.koreanText ?? '',
      partOfSpeech: token.partOfSpeech,
      jlpt: token.jlpt,
    }))
    .filter(uniqueByJapanese());
  return (fromTokens.length > 0 ? fromTokens : line.vocabulary).slice(0, 5);
};

type MockLyricToken = {key: string; text: string; reading: string; underlineColor: string | null};

// CurrentPlayingWordsSheet.buildAnalyzedLyricTokens 와 같은 규칙 — 한자 토큰에만 후리가나, 기호엔 밑줄 없음.
const buildMockLyricTokens = (line: PromoLine): MockLyricToken[] => {
  const tokens: MockLyricToken[] = [];
  let cursor = 0;
  const push = (text: string, key: string, token?: LyricToken) => {
    if (text === '') return;
    const reading = token?.reading ?? token?.baseFormReading;
    tokens.push({
      key,
      text,
      reading: reading && KANJI_RE.test(text) ? reading : ' ',
      underlineColor: token && !NO_UNDERLINE_POS.has(token.partOfSpeech) ? (posAppColors[token.partOfSpeech] ?? app.textMuted) : null,
    });
  };
  [...line.tokens].sort((a, b) => a.charStart - b.charStart).forEach((token, index) => {
    if (token.charStart > cursor) push(line.originalText.slice(cursor, token.charStart), `gap-${index}`);
    push(line.originalText.slice(token.charStart, token.charEnd) || token.surface, `token-${index}`, token);
    cursor = Math.max(cursor, token.charEnd);
  });
  if (cursor < line.originalText.length) push(line.originalText.slice(cursor), 'tail');
  if (tokens.length === 0) push(line.originalText, 'fallback');
  return tokens;
};

const mockLyricFontSize = (tokens: MockLyricToken[], width: number) => {
  const gap = 5;
  const units = tokens.reduce((sum, token) => sum + Math.max(textWeight(token.text), textWeight(token.reading.trim()) * 0.5), 0);
  const fit = units > 0 ? ((width - (tokens.length - 1) * gap) / units) * 0.92 : 21;
  return Math.max(8, Math.min(21, fit));
};

const textWeight = (text: string) => Array.from(text).reduce((sum, char) => {
  if (char.trim() === '') return sum + 0.35;
  if (/^[ -~]$/.test(char)) return sum + 0.55;
  return sum + 1;
}, 0);

// 리딩 없는 토큰은 뺀다 — convertLineReading 이 안 덮인 자리를 공백으로 두지, 원문을 베끼지 않는다.
const readingTokens = (tokens: LyricToken[]) => tokens.flatMap((token) => {
  const reading = token.reading ?? token.baseFormReading;
  if (!reading) return [];
  return [{
    surface: token.surface,
    reading,
    charStart: token.charStart,
    charEnd: token.charEnd,
    partOfSpeech: token.partOfSpeech,
  }];
});

const normalizeHandle = (handle: string) => handle === '@kotonoha.music' ? '@kotonoha.app' : handle;

const artworkUrl = (artworkAsset: string): string | null => {
  if (artworkAsset.trim() === '') return null;
  return artworkAsset.startsWith('http') ? artworkAsset : staticFile(artworkAsset);
};

const emptyLine: PromoLine = {
  startFrame: 0,
  originalText: '',
  koreanLyrics: '',
  tokens: [],
  vocabulary: [],
};

const fontStack =
  '"Noto Sans CJK KR", "Noto Sans CJK JP", "Noto Sans KR", "Noto Sans JP", "Apple SD Gothic Neo", "Hiragino Sans", sans-serif';

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
  songText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  title: {
    color: ink,
    fontSize: 50,
    fontWeight: 800,
    lineHeight: 1,
  },
  artist: {
    color: softInk,
    fontSize: 29,
    fontWeight: 500,
    lineHeight: 1,
  },
  watermark: {
    color: 'rgba(250,250,246,0.35)',
    fontSize: 28,
    fontWeight: 500,
    marginLeft: 'auto',
  },
  content: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 80,
    left: 160,
    position: 'absolute',
    right: 160,
    textAlign: 'center',
    top: 1030,
    zIndex: 4,
  },
  lyricBlock: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    width: '100%',
  },
  japanese: {
    color: ink,
    fontWeight: 700,
    lineHeight: 1.16,
    margin: 0,
    // 어절(공백) 단위로만 줄을 바꾼다. 단어 한가운데서 꺾이면 안 읽힌다.
    overflowWrap: 'anywhere',
    wordBreak: 'keep-all',
  },
  korean: {
    color: 'rgba(250,250,246,0.85)',
    fontSize: 38,
    fontWeight: 500,
    letterSpacing: -0.8,
    lineHeight: 1.3,
    margin: 0,
  },
  wordsBlock: {
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
    letterSpacing: -0.6,
    lineHeight: 1.3,
    maxWidth: 300,
    textAlign: 'right',
  },

  // ─── 엔드카드 ───
  endCardLayer: {
    backgroundColor: night,
    overflow: 'hidden',
    zIndex: 10,
  },
  endBackdropArt: {
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    filter: 'blur(48px)',
    height: 2120,
    left: -100,
    opacity: 0.22,
    position: 'absolute',
    top: -100,
    width: 1280,
  },
  endBackdropScrim: {
    background: 'linear-gradient(180deg, rgba(17,16,18,0) 0%, #111012 75%)',
    height: 1420,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 500,
  },
  ambientGlow: {
    background: `radial-gradient(circle, ${glow}2E 0%, ${glow}00 62%)`,
    height: 900,
    left: 90,
    position: 'absolute',
    top: 250,
    width: 900,
  },
  endTitleBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
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
    lineHeight: 1.1,
  },
  endTitleBrand: {
    color: green,
  },
  ctaBlock: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
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
    gap: 22,
    height: 96,
    padding: '0 44px',
    width: 351,
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
    color: softInk,
    display: 'flex',
    fontSize: 30,
    fontWeight: 600,
    gap: 44,
  },
  storeItem: {
    alignItems: 'center',
    display: 'flex',
    gap: 12,
    whiteSpace: 'nowrap',
  },
  profileLink: {
    color: softInk,
    fontSize: 28,
    fontWeight: 500,
  },

  // ─── 앱 목업 ───
  phone: {
    backgroundColor: app.background,
    border: '3px solid rgba(244,241,234,0.24)',
    borderRadius: 46,
    boxShadow: '0 28px 80px rgba(0,0,0,0.6)',
    color: app.textPrimary,
    height: PHONE_HEIGHT,
    left: 310,
    // 폰 아래쪽은 배경으로 녹아든다. 테두리·그림자까지 같이 사라져야 해서 별도 fade 사각형이 아니라 mask 다.
    maskImage: 'linear-gradient(180deg, #000 0%, #000 72%, transparent 100%)',
    overflow: 'hidden',
    position: 'absolute',
    top: 400,
    WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 72%, transparent 100%)',
    width: PHONE_WIDTH,
  },
  phonePage: {
    height: PHONE_HEIGHT,
    left: 0,
    position: 'absolute',
    top: 0,
    width: PHONE_WIDTH,
  },
  mockHero: {
    height: 300,
    overflow: 'hidden',
    position: 'relative',
    width: PHONE_WIDTH,
  },
  mockHeroArt: {
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    inset: 0,
    position: 'absolute',
  },
  mockHeroScrim: {
    backgroundColor: '#00000080',
    inset: 0,
    position: 'absolute',
  },
  mockHeroBottomScrim: {
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)',
    bottom: 0,
    height: 190,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  mockBackButton: {
    alignItems: 'center',
    backgroundColor: '#0000002E',
    borderRadius: 999,
    color: '#FFFFFF',
    display: 'flex',
    height: 46,
    justifyContent: 'center',
    left: 14,
    position: 'absolute',
    top: 18,
    width: 46,
  },
  mockHeroInfo: {
    bottom: 26,
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
    left: 25,
    position: 'absolute',
    right: 25,
  },
  mockSongTitle: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 800,
    lineHeight: 1.15,
  },
  mockSongArtist: {
    color: '#FFFFFFCC',
    fontSize: 19,
    fontWeight: 600,
    lineHeight: 1.2,
    marginBottom: 10,
  },
  mockDeckButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    color: app.textPrimary,
    display: 'flex',
    fontSize: 18,
    fontWeight: 700,
    gap: 9,
    height: 54,
    justifyContent: 'center',
    width: '100%',
  },
  mockTabBar: {
    alignItems: 'stretch',
    backgroundColor: app.background,
    borderBottom: `1px solid ${app.border}`,
    display: 'flex',
    gap: 11,
    height: 50,
    paddingLeft: 18,
  },
  mockTab: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    position: 'relative',
    width: 62,
  },
  mockTabLabel: {
    color: app.textMuted,
    fontSize: 18,
    fontWeight: 700,
  },
  mockTabLabelActive: {
    color: app.textPrimary,
    fontSize: 18,
    fontWeight: 800,
  },
  mockTabIndicator: {
    backgroundColor: app.primary,
    bottom: 0,
    height: 2,
    left: 15,
    position: 'absolute',
    width: 32,
  },
  mockHome: {
    display: 'flex',
    flexDirection: 'column',
    padding: '27px 23px 0',
  },
  mockSectionHeader: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  },
  mockSectionTitle: {
    color: app.textPrimary,
    fontSize: 20,
    fontWeight: 700,
  },
  mockProgressCount: {
    color: app.textMuted,
    fontSize: 14,
    fontWeight: 600,
  },
  mockProgressTrack: {
    backgroundColor: app.track,
    borderRadius: 999,
    height: 7,
    marginTop: 15,
    width: '100%',
  },
  mockLegend: {
    color: app.textSecondary,
    display: 'flex',
    fontSize: 13,
    fontWeight: 500,
    gap: 14,
    marginTop: 12,
  },
  mockLegendItem: {
    alignItems: 'center',
    display: 'flex',
    gap: 6,
  },
  mockLegendDot: {
    borderRadius: 999,
    display: 'block',
    height: 8,
    width: 8,
  },
  mockSectionHint: {
    color: app.textSecondary,
    fontSize: 14,
    marginTop: 6,
  },
  mockCardRail: {
    display: 'flex',
    gap: 14,
    marginTop: 18,
  },
  mockWordCard: {
    alignItems: 'center',
    backgroundColor: app.background,
    border: `1px solid ${app.border}`,
    borderRadius: 18,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: 22,
    padding: '16px 14px 18px',
    width: 172,
  },
  mockCardKanji: {
    color: app.textPrimary,
    fontSize: 40,
    fontWeight: 800,
    lineHeight: 1,
  },
  mockRevealPill: {
    backgroundColor: app.track,
    borderRadius: 10,
    color: app.textSecondary,
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 0',
    textAlign: 'center',
    width: '100%',
  },
  sheet: {
    backgroundColor: app.background,
    borderRadius: '24px 24px 0 0',
    boxShadow: '0 -2px 14px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    width: PHONE_WIDTH,
  },
  sheetGrabber: {
    backgroundColor: app.newIndicator,
    borderRadius: 999,
    flexShrink: 0,
    height: 5,
    margin: '9px auto 2px',
    width: 41,
  },
  mvBar: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: 14,
    height: 64,
    padding: '0 18px',
  },
  mvThumb: {
    alignItems: 'center',
    backgroundColor: '#111111',
    border: '1px solid #FFFFFF33',
    borderRadius: 9,
    display: 'flex',
    flexShrink: 0,
    height: 34,
    justifyContent: 'center',
    position: 'relative',
    width: 69,
  },
  mvTag: {
    backgroundColor: '#E53935',
    borderRadius: 3,
    bottom: 3,
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: 800,
    left: 3,
    lineHeight: 1,
    padding: '2px 3px',
    position: 'absolute',
  },
  mvText: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  mvTitle: {
    color: app.textPrimary,
    fontSize: 15,
    fontWeight: 600,
  },
  mvArtist: {
    color: app.textSecondary,
    fontSize: 13,
  },
  syncRow: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    height: 32,
    justifyContent: 'space-between',
    margin: '12px 18px',
  },
  pageStatus: {
    color: app.textSecondary,
    fontSize: 14,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 500,
  },
  syncChip: {
    alignItems: 'center',
    backgroundColor: app.primaryBg,
    border: `1px solid ${app.primary}`,
    borderRadius: 999,
    color: app.primary,
    display: 'flex',
    fontSize: 14,
    fontWeight: 700,
    height: 32,
    padding: '0 12px',
  },
  sheetPage: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '0 25px',
  },
  mockLyricBlock: {
    alignItems: 'center',
    backgroundColor: app.elevated,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: 9,
    height: 126,
    justifyContent: 'center',
  },
  mockLyricTokens: {
    alignItems: 'flex-end',
    display: 'flex',
    gap: 5,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  mockLyricToken: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: 1,
  },
  mockFurigana: {
    color: app.furigana,
    whiteSpace: 'pre',
  },
  mockTokenText: {
    color: app.textPrimary,
    fontWeight: 800,
    whiteSpace: 'pre',
  },
  mockTokenUnderline: {
    height: 2,
    width: '100%',
  },
  mockKorean: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: '100%',
  },
  mockPronunciation: {
    color: app.textMuted,
    fontSize: 12,
    lineHeight: 1.3,
  },
  mockTranslation: {
    color: app.textSecondary,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.3,
  },
  mockWordList: {
    display: 'flex',
    flexDirection: 'column',
  },
  mockWordRow: {
    alignItems: 'center',
    display: 'flex',
    gap: 14,
    minHeight: 76,
    padding: '14px 0',
  },
  mockWordInfo: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  mockWordJpRow: {
    alignItems: 'center',
    display: 'flex',
    gap: 7,
  },
  mockWordJapanese: {
    color: app.textPrimary,
    fontSize: 21,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  mockWordReading: {
    color: app.textMuted,
    fontSize: 14,
  },
  mockMeaningRow: {
    alignItems: 'center',
    display: 'flex',
    gap: 14,
  },
  mockMeaning: {
    color: app.textSecondary,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.3,
  },
  mockBadges: {
    display: 'flex',
    gap: 4,
  },
  mockBadge: {
    alignItems: 'center',
    borderRadius: 999,
    display: 'flex',
    fontSize: 12,
    height: 21,
    lineHeight: 1,
    padding: '0 9px 1px',
  },
} satisfies Record<string, CSSProperties>;
