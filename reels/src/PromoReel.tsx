import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {CSSProperties} from 'react';

import {convertLineReading, convertReading} from '../../app-rn/src/utils/readingConverter';
import {SCORE_DREAM_FAMILY, useScoreDream} from './fonts/scoreDream';
import type {LyricToken, PartOfSpeech, PromoLine, PromoReelData, VocabularyWord} from './types';

export const PROMO_FPS = 30;
// 엔드카드 7초. 앱 목업이 시트 → 단어 탭 → 복습 → rating → 다음 단어까지 흐르고, 스토어 검색 큐를 읽을 시간이다.
// 바꾸면 admin-web reelEditor.ts 의 END_CARD_MS 도 같이 바꾼다.
export const END_CARD_DURATION_IN_FRAMES = 210;

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
  useScoreDream();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const lines = data.lyricLines.length > 0 ? data.lyricLines : [emptyLine];
  const lyricsEndFrame = Math.max(1, data.lyricsEndFrame);
  // 지금 프레임에 시작해 있는 마지막 줄이 현재 줄이다. MV 타임라인과 같은 기준(startFrame)이다.
  // 첫 줄보다 앞이면(어드민이 클립 시작을 첫 줄 앞에 둔 경우) 가사 없이 MV 만 흐른다.
  const activeIndex = lines.reduce((found, line, index) => (line.startFrame <= frame ? index : found), -1);
  const activeLine = lines[Math.max(0, activeIndex)];
  const localFrame = Math.max(0, frame - activeLine.startFrame);
  // 줄 진입은 짧은 직선 이동이다 — 스프링처럼 감속하지 않고 6프레임에 끝난다. 첫 줄도 같다.
  const entry = (delay: number) => linear(localFrame - delay, 0, ENTRY_FRAMES);
  const lyricEntry = entry(0);
  const wordsEntry = entry(4);

  return (
    <AbsoluteFill style={styles.canvas}>
      <AbsoluteFill>
        <OffthreadVideo
          muted={false}
          src={assetSrc(data.song.mvAsset)}
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

      {frame < lyricsEndFrame + END_CARD_FADE_FRAMES && (
        <div style={styles.activeLayer}>
          <Header data={data} />
          {activeIndex >= 0 && (
            <section style={styles.content}>
              <div style={{...styles.lyricBlock, ...entryStyle(lyricEntry)}}>
                <JapaneseLine line={activeLine} />
                <p style={styles.korean}>{activeLine.koreanLyrics}</p>
              </div>
              {activeLine.vocabulary.length > 0 && (
                <div style={entryStyle(wordsEntry)}>
                  <Vocabulary words={topWords(activeLine.vocabulary)} />
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <EndCard data={data} line={lines[lines.length - 1]} lineCount={lines.length} startFrame={lyricsEndFrame} />
    </AbsoluteFill>
  );
};

const ENTRY_FRAMES = 6;
const END_CARD_FADE_FRAMES = 6;

// 0→1 직선 진행. 스프링 없이 짧게 움직이고 끝난다.
const linear = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

// 목업 안 화면 전환용 — 앱처럼 감속(ease-out)한다. 가사·엔드카드 전환은 linear 를 쓴다.
const eased = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

const entryStyle = (progress: number): CSSProperties => ({
  opacity: progress,
  transform: `translateY(${interpolate(progress, [0, 1], [14, 0])}px)`,
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
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;
  // 가사 레이어를 6프레임 직선 페이드로 덮고, 제목은 같은 길이만큼 올라온다.
  const enter = linear(localFrame, 0, END_CARD_FADE_FRAMES);
  const typedLength = Math.max(0, Math.min(SEARCH_QUERY.length, Math.floor((localFrame - TYPING_START) / TYPING_FRAMES_PER_CHAR) + 1));
  const typingDone = localFrame >= TYPING_START + SEARCH_QUERY.length * TYPING_FRAMES_PER_CHAR;
  // 입력 중엔 커서가 켜져 있고, 다 친 뒤에만 깜빡인다.
  const caretOn = !typingDone || Math.floor(localFrame / 15) % 2 === 0;
  const artwork = data.song.artworkAsset.trim() === '' ? null : assetSrc(data.song.artworkAsset);

  return (
    <AbsoluteFill style={{...styles.endCardLayer, opacity: enter}}>
      {artwork && <div style={{...styles.endBackdropArt, backgroundImage: `url("${artwork}")`}} />}
      <div style={styles.endBackdropScrim} />
      <div style={styles.ambientGlow} />
      <div style={{...styles.endTitleBlock, transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`}}>
        <div style={styles.endTitle}>전체 단어는</div>
        <div style={styles.endTitle}>
          <span style={styles.endTitleBrand}>코토노하</span> 앱에서
        </div>
      </div>
      <AppMockup data={data} line={line} lineCount={lineCount} artwork={artwork} frame={localFrame} />
      <div style={styles.ctaBlock}>
        <div style={styles.searchCue}>
          <SearchIcon />
          <span style={styles.searchInput}>
            <span style={styles.searchQuery}>{SEARCH_QUERY.slice(0, typedLength)}</span>
            <span style={{...styles.searchCaret, opacity: caretOn ? 1 : 0}} />
          </span>
        </div>
        <div style={styles.storeRow}>
          <span style={styles.storeItem}><GooglePlayIcon /> Google Play</span>
          <span style={styles.storeItem}><AppleIcon /> App Store</span>
        </div>
        <div style={styles.profileLink}>프로필 링크에서 설치</div>
      </div>
    </AbsoluteFill>
  );
};

const SEARCH_QUERY = '코토노하';
const TYPING_START = 30;
const TYPING_FRAMES_PER_CHAR = 9;

// ─── 앱 목업 ───────────────────────────────────────────────────────────────────
// SongDetailScreen(hero 360 · 홈/단어 탭 · 홈 탭 본문 · MV 바)을 460×860 폰 안에 그리고,
// CurrentPlayingWordsSheet 가 MV 바를 핸들 삼아 올라온다. 첫 단어를 누르면 SongReviewScreen 이
// 폰을 덮고, 앞면 탭 → rating → 위로 스와이프 → 다음 단어까지 이어진다. 타이포는 실제 비율보다
// 1.2배 크다 — 릴스에서 축소돼 보이므로 실제 스케일 그대로 두면 안 읽힌다.

const PHONE_WIDTH = 460;
const PHONE_HEIGHT = 860;
const SHEET_PEEK_HEIGHT = 80;
const SHEET_EXPANDED_TOP = 64;

// 엔드카드 안 목업 타임라인(엔드카드 시작 기준 프레임). 전환은 전부 하드컷이고 움직임은 시트·스와이프 둘뿐이다.
const MOCK_T = {
  sheetRise: 10,
  wordTap: 40,
  reviewOpen: 48,
  frontTap: 84,
  reveal: 90,
  ratingTap: 126,
  affordance: 132,
  swipeStart: 156,
};
const TAP_FRAMES = 8;
// 화면 전환 길이. 프로덕션(260ms 안팎)처럼 ease-out 으로 감속한다.
const PUSH_FRAMES = 10;
const REVEAL_FRAMES = 10;
const AFFORDANCE_FRAMES = 8;
const SWIPE_FRAMES = 12;

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
  // gorhom BottomSheet 의 스프링 감속
  const rise = spring({config: {damping: 20, mass: 0.8, stiffness: 120}, fps, frame: Math.max(0, frame - MOCK_T.sheetRise)});
  const sheetTop = interpolate(rise, [0, 1], [PHONE_HEIGHT - SHEET_PEEK_HEIGHT, SHEET_EXPANDED_TOP]);
  const words = mockWords(line);
  const wordCount = data.wordCount ?? uniqueWordCount(data.lyricLines);
  const wordPressed = frame >= MOCK_T.wordTap && frame < MOCK_T.reviewOpen;

  return (
    <div style={styles.phone}>
      <SongDetailPage data={data} artwork={artwork} wordCount={wordCount} />
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
              <MockWordRow
                key={`${word.japanese}-${word.korean}`}
                pressed={index === 0 && wordPressed}
                showDivider={index < words.length - 1}
                word={word}
              />
            ))}
          </div>
        </div>
      </div>
      {wordPressed && frame < MOCK_T.wordTap + TAP_FRAMES && <TapDot x={PHONE_WIDTH / 2} y={SHEET_EXPANDED_TOP + 330} dark />}
      {frame >= MOCK_T.reviewOpen && words.length > 0 && (
        <ReviewMock data={data} line={line} words={words} wordCount={wordCount} artwork={artwork} frame={frame} />
      )}
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

const MockWordRow = ({word, pressed, showDivider}: {word: VocabularyWord; pressed: boolean; showDivider: boolean}) => {
  const pos = word.partOfSpeech ?? '';
  const posLabel = word.partOfSpeechLabel ?? posLabels[pos] ?? '';
  const posColor = posAppColors[pos] ?? app.textMuted;
  const jlptColor = word.jlpt ? (jlptColors[word.jlpt] ?? app.textMuted) : app.textMuted;
  return (
    <div
      style={{
        ...styles.mockWordRow,
        borderBottom: showDivider ? `1px solid ${app.border}` : 'none',
        // SongDetailWordRow 의 TouchableOpacity activeOpacity 0.7
        opacity: pressed ? 0.7 : 1,
      }}
    >
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
      <ChevronRightIcon color={app.textMuted} size={23} />
    </div>
  );
};

const Badge = ({color, label, bold}: {color: string; label: string; bold?: boolean}) => (
  <span style={{...styles.mockBadge, color, backgroundColor: `${color}20`, fontWeight: bold ? 700 : 600}}>{label}</span>
);

// 손가락이 닿은 자리. 몇 프레임 켜졌다 꺼진다.
const TapDot = ({x, y, dark}: {x: number; y: number; dark?: boolean}) => (
  <div style={{...styles.tapDot, left: x - 24, top: y - 24, backgroundColor: dark ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.38)'}} />
);

// ─── 복습 화면 목업 ───────────────────────────────────────────────────────────
// SongReviewScreen = CardStage(아트워크 + 틴트 + 스크림 2겹) + StackReviewOverlay(뒤로 · n/N · 진행 바)
// + SourceHeader + WordFront/WordBack. rating 줄은 프로덕션처럼 화면 맨 아래(paddingBottom 22 + 하단 inset)에
// 붙고, 어포던스가 뜨면 그만큼 위로 밀린다. 폰 마스크는 그 아래 60px 만 녹인다.

const REVIEW_CONTENT_TOP = 104;
const REVIEW_CONTENT_BOTTOM = PHONE_HEIGHT - 50;
const REVIEW_STACK_TOP = REVIEW_CONTENT_TOP + 46 + 14;
const REVIEW_STACK_HEIGHT = REVIEW_CONTENT_BOTTOM - REVIEW_STACK_TOP;

const REVIEW_AFFORDANCE_HEIGHT = 58;

const ratings = [
  {rating: 1, label: '다시', interval: '10분', color: '#EF4444'},
  {rating: 2, label: '어려움', interval: '1일', color: '#F97316'},
  {rating: 3, label: '알고 있음', interval: '3일', color: '#10B981'},
  {rating: 4, label: '쉬움', interval: '7일', color: '#3B82F6'},
];
const PICKED_RATING = 3;

const ReviewMock = ({
  data,
  line,
  words,
  wordCount,
  artwork,
  frame,
}: {
  data: PromoReelData;
  line: PromoLine;
  words: VocabularyWord[];
  wordCount: number;
  artwork: string | null;
  frame: number;
}) => {
  // native-stack push — 오른쪽에서 밀려 들어온다.
  const push = eased(frame, MOCK_T.reviewOpen, MOCK_T.reviewOpen + PUSH_FRAMES);
  // WordLayer.revealProgress — 앞면 표제어가 줄며 올라가고 뒷면이 아래서 올라온다.
  const reveal = eased(frame, MOCK_T.reveal, MOCK_T.reveal + REVEAL_FRAMES);
  const rated = frame >= MOCK_T.ratingTap;
  const affordance = eased(frame, MOCK_T.affordance, MOCK_T.affordance + AFFORDANCE_FRAMES);
  const swipe = eased(frame, MOCK_T.swipeStart, MOCK_T.swipeStart + SWIPE_FRAMES);
  const current = words[0];
  const next = words[1] ?? null;
  const swiped = next !== null && swipe >= 1;
  const position = swiped ? 2 : 1;
  const total = Math.max(wordCount, words.length, 1);
  // WordLayer 와 같은 규칙 — 드래그 80% 지점에서 크로스페이드가 끝난다.
  const crossfade = next === null ? 0 : Math.min(1, swipe / 0.8);
  const frontTapDot = frame >= MOCK_T.frontTap && frame < MOCK_T.frontTap + TAP_FRAMES;
  const ratingTapDot = frame >= MOCK_T.ratingTap && frame < MOCK_T.ratingTap + TAP_FRAMES;
  const ratingIndex = ratings.findIndex((item) => item.rating === PICKED_RATING);
  const ratingWidth = (PHONE_WIDTH - 2 * 24 - 3 * 10) / 4;
  const ratingRowCenterY = REVIEW_CONTENT_BOTTOM - affordance * REVIEW_AFFORDANCE_HEIGHT - 28;

  return (
    <div style={{...styles.review, transform: `translateX(${(1 - push) * PHONE_WIDTH}px)`}}>
      {artwork
        ? <div style={{...styles.reviewArt, backgroundImage: `url("${artwork}")`}} />
        : <div style={{...styles.reviewArt, backgroundColor: '#16242A'}} />}
      <div style={styles.reviewTint} />
      <div style={styles.reviewSideScrim} />
      <div style={styles.reviewVerticalScrim} />

      <div style={styles.reviewContent}>
        <div style={styles.reviewSourceRow}>
          {artwork
            ? <div style={{...styles.reviewThumb, backgroundImage: `url("${artwork}")`}} />
            : <div style={{...styles.reviewThumb, backgroundColor: 'rgba(82,183,136,0.24)'}} />}
          <div style={styles.reviewSourceText}>
            <span style={styles.reviewSourceTitle}>{data.song.title}</span>
            <span style={styles.reviewSourceSub}>{data.song.artist}</span>
          </div>
          <ChevronRightIcon color="rgba(255,255,255,0.6)" size={19} />
        </div>
        <div style={styles.reviewStack}>
          {next && !swiped && (
            <div style={{...styles.reviewLayer, opacity: crossfade}}>
              <ReviewFront word={next} />
            </div>
          )}
          {swiped && next ? (
            <div style={styles.reviewLayer}><ReviewFront word={next} /></div>
          ) : (
            <div style={{...styles.reviewLayer, opacity: 1 - crossfade, transform: `translateY(${-swipe * REVIEW_STACK_HEIGHT}px)`}}>
              {reveal > 0 && (
                <div style={styles.reviewLayer}>
                  <ReviewBack data={data} line={line} word={current} rated={rated} reveal={reveal} affordance={affordance} />
                </div>
              )}
              {reveal < 1 && (
                <div style={styles.reviewLayer}>
                  <ReviewFront word={current} reveal={reveal} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={styles.reviewChrome}>
        <div style={styles.reviewAppBar}>
          <div style={styles.reviewBackButton}><ChevronLeftIcon /></div>
          <span style={styles.reviewCounter}>{position} / {total}</span>
        </div>
        <div style={styles.reviewProgressTrack}>
          <div style={{...styles.reviewProgressFill, width: `${((position - 1) / total) * 100}%`}} />
        </div>
      </div>

      {frontTapDot && <TapDot x={PHONE_WIDTH / 2} y={REVIEW_STACK_TOP + REVIEW_STACK_HEIGHT / 2} />}
      {ratingTapDot && <TapDot x={24 + ratingWidth * ratingIndex + ratingWidth / 2 + 10 * ratingIndex} y={ratingRowCenterY} />}
    </div>
  );
};

// reveal: WordFront 의 revealProgress 스타일 — 표제어는 왼쪽 기준으로 0.69배로 줄며 올라가고, 힌트는 먼저 사라진다.
const ReviewFront = ({word, reveal = 0}: {word: VocabularyWord; reveal?: number}) => (
  <div style={styles.reviewFront}>
    <span
      style={{
        ...styles.reviewFrontHeadword,
        opacity: interpolate(reveal, [0, 0.72, 1], [1, 1, 0]),
        transform: `translateY(${reveal * -108}px) scale(${interpolate(reveal, [0, 1], [1, 0.69])})`,
        transformOrigin: 'left center',
      }}
    >
      {word.japanese}
    </span>
    <div
      style={{
        ...styles.reviewHint,
        opacity: interpolate(reveal, [0, 0.28], [1, 0], {extrapolateRight: 'clamp'}),
        transform: `translateY(${reveal * 12}px)`,
      }}
    >
      <TouchIcon /><span>떠올린 후 탭해서 뜻 보기</span>
    </div>
  </div>
);

// 뒷면 그룹이 아래서 올라오는 구간(WordBack 의 revealProgress interpolate 와 같은 값).
const rise = (progress: number, from: number, distance: number): CSSProperties => ({
  opacity: interpolate(progress, [from, 1], [0, 1], {extrapolateLeft: 'clamp'}),
  transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
});

const ReviewBack = ({
  data,
  line,
  word,
  rated,
  reveal,
  affordance,
}: {
  data: PromoReelData;
  line: PromoLine;
  word: VocabularyWord;
  rated: boolean;
  reveal: number;
  affordance: number;
}) => {
  const pos = word.partOfSpeech ?? '';
  const posLabel = word.partOfSpeechLabel ?? posLabels[pos] ?? '';
  const hitIndex = line.originalText.indexOf(word.japanese);
  const hasHit = hitIndex >= 0;
  return (
    <div style={styles.reviewBack}>
      <div style={styles.reviewBackCenter}>
        <div style={{...styles.reviewQuestion, ...rise(reveal, 0.62, 21)}}>
          <span style={styles.reviewBackHeadword}>{word.japanese}</span>
          <div style={styles.reviewReadingRow}>
            {word.reading && <span style={styles.reviewReading}>{convertReading(word.reading, 'KOREAN')}</span>}
            {posLabel && <span style={{...styles.reviewMetaPos, color: posAppColors[pos] ?? app.textMuted}}>{posLabel}</span>}
            {posLabel && word.jlpt && <span style={styles.reviewMetaDot}>·</span>}
            {word.jlpt && <span style={{...styles.reviewMetaJlpt, color: jlptColors[word.jlpt] ?? app.textMuted}}>{word.jlpt}</span>}
          </div>
        </div>
        <div style={{...styles.reviewAnswer, ...rise(reveal, 0.32, 28)}}>
          <span style={styles.reviewMeaning}>{word.korean}</span>
          <div style={styles.reviewExample}>
            <div style={styles.reviewExampleSource}>
              <span style={styles.reviewExampleSourceTitle}>{data.song.title}</span>
              <ChevronRightIcon color="rgba(255,255,255,0.45)" size={14} />
            </div>
            <span style={styles.reviewExampleJp}>
              {hasHit ? (
                <>
                  {line.originalText.slice(0, hitIndex)}
                  <span style={styles.reviewExampleHit}>{word.japanese}</span>
                  {line.originalText.slice(hitIndex + word.japanese.length)}
                </>
              ) : line.originalText}
            </span>
            {line.koreanLyrics && <span style={styles.reviewExampleKr}>{line.koreanLyrics}</span>}
          </div>
        </div>
      </div>
      <div style={{...styles.reviewRatingRow, ...rise(reveal, 0.54, 24)}}>
        {ratings.map((item) => {
          const selected = rated && item.rating === PICKED_RATING;
          const dimmed = rated && !selected;
          return (
            <div
              key={item.rating}
              style={{
                ...styles.reviewRatingButton,
                ...(selected
                  ? {backgroundColor: item.color, border: 'none', boxShadow: `0 2px 14px ${item.color}73`}
                  : {border: `1px solid ${item.color}66`}),
                opacity: dimmed ? 0.42 : 1,
              }}
            >
              <span style={{...styles.reviewRatingLabel, color: selected ? '#FFFFFF' : item.color, fontWeight: selected ? 700 : 600}}>{item.label}</span>
              <span style={{...styles.reviewRatingInterval, color: selected ? 'rgba(255,255,255,0.8)' : item.color}}>{item.interval}</span>
            </div>
          );
        })}
      </div>
      {affordance > 0 && (
        <div style={{...styles.reviewAffordance, height: affordance * REVIEW_AFFORDANCE_HEIGHT}}>
          <div style={{...styles.reviewAffordanceContent, ...rise(affordance, 0, 30)}}>
            <div style={styles.reviewAffordanceLabel}><ChevronUpIcon /><span>위로 쓸어올려 다음 단어</span></div>
            <div style={styles.reviewGrabber} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 아이콘 ────────────────────────────────────────────────────────────────────

const svgProps = {fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round'} as const;

const ChevronLeftIcon = () => (
  <svg height={24} viewBox="0 0 24 24" width={24} {...svgProps} strokeWidth={2.4}><path d="M15 18l-6-6 6-6" /></svg>
);
const ChevronRightIcon = ({color, size}: {color: string; size: number}) => (
  <svg height={size} style={{color, flexShrink: 0}} viewBox="0 0 24 24" width={size} {...svgProps} strokeWidth={2.2}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
const ChevronUpIcon = () => (
  <svg height={18} viewBox="0 0 24 24" width={18} {...svgProps} strokeWidth={2.4}><path d="M18 15l-6-6-6 6" /></svg>
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
// MaterialIcons touch-app(WordFront 의 탭 힌트)
const TouchIcon = () => (
  <svg fill="currentColor" height={19} viewBox="0 0 24 24" width={19}>
    <path d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74c-3.6-.76-3.54-.75-3.67-.75-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z" />
  </svg>
);
// 스토어 마크는 Simple Icons(CC0) 의 정식 path 다. 선으로 흉내 내지 않는다.
const GooglePlayIcon = () => (
  <svg fill="currentColor" height={34} viewBox="0 0 24 24" width={34}>
    <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
  </svg>
);
const AppleIcon = () => (
  <svg fill="currentColor" height={36} style={{marginTop: -4}} viewBox="0 0 24 24" width={36}>
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
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

// 렌더는 public/ 아래 파일명을, 어드민 미리보기는 admin-api 가 스트리밍하는 URL 을 넘긴다.
const assetSrc = (asset: string): string =>
  (asset.startsWith('http') || asset.startsWith('/') ? asset : staticFile(asset));

const emptyLine: PromoLine = {
  startFrame: 0,
  originalText: '',
  koreanLyrics: '',
  tokens: [],
  vocabulary: [],
};

// 앱 목업이 쓰는 폰트 — 실제 앱 화면과 같아야 해서 릴스 폰트를 따르지 않는다.
const appFontStack =
  '"Noto Sans CJK KR", "Noto Sans CJK JP", "Noto Sans KR", "Noto Sans JP", "Apple SD Gothic Neo", "Hiragino Sans", sans-serif';
// 릴스 폰트. 에스코어 드림에 없는 일본어는 뒤의 Noto CJK 가 맡는다.
const reelFontStack = `"${SCORE_DREAM_FAMILY}", ${appFontStack}`;

const styles = {
  canvas: {
    backgroundColor: night,
    color: ink,
    fontFamily: reelFontStack,
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
    top: 150,
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
    // 2줄 이상일 때 답답하지 않게 — Pen Reel v2 의 줄 박스(1.16) + gap 20 과 같은 1.5 배
    lineHeight: 1.5,
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
    boxSizing: 'border-box',
    display: 'flex',
    gap: 22,
    height: 96,
    padding: '0 44px',
    width: 372,
  },
  // 커서는 마지막 글자 바로 오른쪽에 붙는다. 칸 폭은 고정이라 글자가 늘어도 상자는 안 움직인다.
  searchInput: {
    alignItems: 'center',
    display: 'flex',
    gap: 3,
  },
  searchQuery: {
    color: night,
    fontSize: 46,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'pre',
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
    fontFamily: appFontStack,
    height: PHONE_HEIGHT,
    left: 310,
    // 폰 아래쪽은 배경으로 녹아든다. 테두리·그림자까지 같이 사라져야 해서 별도 fade 사각형이 아니라 mask 다.
    // 복습 화면의 rating 줄이 아래 60px 위에 오므로 그보다 아래만 녹인다.
    maskImage: 'linear-gradient(180deg, #000 0%, #000 93%, transparent 100%)',
    overflow: 'hidden',
    position: 'absolute',
    top: 400,
    WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 93%, transparent 100%)',
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
  tapDot: {
    borderRadius: 999,
    height: 48,
    position: 'absolute',
    width: 48,
    zIndex: 5,
  },

  // ─── 복습 화면 목업 ───
  review: {
    backgroundColor: '#14181C',
    color: '#FFFFFF',
    inset: 0,
    overflow: 'hidden',
    position: 'absolute',
    zIndex: 3,
  },
  reviewArt: {
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    filter: 'blur(10px)',
    inset: 0,
    position: 'absolute',
    transform: 'scale(1.18)',
  },
  reviewTint: {
    backgroundColor: 'rgba(20,24,28,0.30)',
    inset: 0,
    position: 'absolute',
  },
  reviewSideScrim: {
    background: 'linear-gradient(90deg, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.22) 50%, rgba(0,0,0,0) 100%)',
    inset: 0,
    position: 'absolute',
  },
  reviewVerticalScrim: {
    background: 'linear-gradient(180deg, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.07) 42%, rgba(0,0,0,0.88) 100%)',
    inset: 0,
    position: 'absolute',
  },
  reviewChrome: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 14,
  },
  reviewAppBar: {
    alignItems: 'center',
    display: 'flex',
    height: 60,
    justifyContent: 'space-between',
    padding: '0 18px',
  },
  reviewBackButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderRadius: 999,
    color: '#FFFFFF',
    display: 'flex',
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  reviewCounter: {
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderRadius: 999,
    color: 'rgba(255,255,255,0.90)',
    fontSize: 15,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    padding: '8px 14px',
  },
  reviewProgressTrack: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: 999,
    height: 5,
    margin: '10px 18px 0',
    overflow: 'hidden',
  },
  reviewProgressFill: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 999,
    height: 5,
  },
  reviewContent: {
    bottom: PHONE_HEIGHT - REVIEW_CONTENT_BOTTOM,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    left: 24,
    position: 'absolute',
    right: 24,
    top: REVIEW_CONTENT_TOP,
  },
  reviewSourceRow: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: 12,
    height: 46,
  },
  reviewThumb: {
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 9,
    flexShrink: 0,
    height: 46,
    width: 46,
  },
  reviewSourceText: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  reviewSourceTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 700,
  },
  reviewSourceSub: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 13,
    fontWeight: 500,
  },
  reviewStack: {
    flex: 1,
    position: 'relative',
  },
  reviewLayer: {
    display: 'flex',
    flexDirection: 'column',
    inset: 0,
    position: 'absolute',
  },
  reviewFront: {
    alignItems: 'flex-start',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 20,
    justifyContent: 'center',
  },
  reviewFrontHeadword: {
    color: '#FFFFFF',
    fontSize: 74,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  reviewHint: {
    alignItems: 'center',
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    fontSize: 14,
    fontWeight: 600,
    gap: 6,
  },
  reviewBack: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    paddingTop: 60,
  },
  reviewBackCenter: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 28,
    justifyContent: 'center',
  },
  reviewQuestion: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  reviewBackHeadword: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  reviewReadingRow: {
    alignItems: 'center',
    display: 'flex',
    gap: 8,
  },
  reviewReading: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 17,
    marginRight: 2,
  },
  reviewMetaPos: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  reviewMetaDot: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 13,
    fontWeight: 600,
  },
  reviewMetaJlpt: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  reviewAnswer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  reviewMeaning: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  reviewExample: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  reviewExampleSource: {
    alignItems: 'center',
    display: 'flex',
    gap: 6,
  },
  reviewExampleSourceTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: 600,
  },
  reviewExampleJp: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 17,
    lineHeight: '26px',
  },
  reviewExampleHit: {
    color: '#FFFFFF',
    fontWeight: 700,
  },
  reviewExampleKr: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 14,
  },
  reviewRatingRow: {
    display: 'flex',
    flexShrink: 0,
    gap: 10,
    height: 56,
  },
  reviewRatingButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF0D',
    borderRadius: 18,
    boxSizing: 'border-box',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 3,
    height: 56,
    justifyContent: 'center',
  },
  reviewRatingLabel: {
    fontSize: 14,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  reviewRatingInterval: {
    fontSize: 12,
    lineHeight: 1,
  },
  reviewAffordance: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  reviewAffordanceContent: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingTop: 18,
  },
  reviewAffordanceLabel: {
    alignItems: 'center',
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    fontSize: 14,
    fontWeight: 600,
    gap: 5,
  },
  reviewGrabber: {
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderRadius: 4,
    height: 7,
    width: 132,
  },
} satisfies Record<string, CSSProperties>;
