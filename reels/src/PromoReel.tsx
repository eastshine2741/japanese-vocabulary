import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {CSSProperties} from 'react';

import type {PartOfSpeech, PromoLine, PromoReelData, VocabularyWord} from './types';

export const PROMO_FPS = 30;
export const PROMO_DURATION_IN_FRAMES = 900;

const ENDCARD_START_FRAME = 810;

const paper = '#F4F1EA';
const ink = '#FAFAF6';
const softInk = 'rgba(250,250,246,0.78)';
const lemon = '#EFD463';
const night = '#111012';

const posColors: Record<PartOfSpeech, string> = {
  NOUN: '#5BA9FF',
  VERB: '#3FE0A1',
  ADJECTIVE: '#FFB347',
  NA_ADJECTIVE: '#FF8FB3',
  ADVERB: '#C49BFF',
  PARTICLE: ink,
  PRONOUN: ink,
  ADNOMINAL: ink,
  AUXILIARY_VERB: ink,
  SYMBOL: ink,
};

type TextRun = {
  color: string;
  text: string;
};

export const PromoReel = ({data}: {data: PromoReelData}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const activeFrame = Math.min(frame, ENDCARD_START_FRAME - 1);
  const activeIndex = data.lyricLines.reduce(
    (selectedIndex, line, index) => (line.startFrame <= activeFrame ? index : selectedIndex),
    0,
  );
  const activeLine = data.lyricLines[activeIndex] ?? data.lyricLines[0];
  const localFrame = Math.max(0, frame - activeLine.startFrame);
  const lineEntry = spring({
    config: {damping: 18, mass: 0.7, stiffness: 110},
    fps,
    frame: localFrame,
  });
  const lyricExit = interpolate(
    frame,
    [ENDCARD_START_FRAME - 18, ENDCARD_START_FRAME + 2],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const lyricOpacity = interpolate(lineEntry, [0, 1], [0, 1]) * lyricExit;
  const lyricY = interpolate(lineEntry, [0, 1], [28, 0]);

  return (
    <AbsoluteFill style={styles.canvas}>
      <AbsoluteFill style={styles.backgroundLayer}>
        <OffthreadVideo
          muted
          src={staticFile(data.song.mvAsset)}
          style={styles.backgroundVideo}
        />
      </AbsoluteFill>

      <AbsoluteFill style={styles.darkWash} />

      <div style={{opacity: lyricExit}}>
        <SongLabels data={data} />
        <Headline data={data} />
      </div>

      <div style={{...styles.videoFrame, opacity: lyricExit}}>
        <OffthreadVideo
          muted={false}
          src={staticFile(data.song.mvAsset)}
          style={styles.framedVideo}
          volume={0.72}
        />
        <div style={styles.handle}>{data.instagramHandle}</div>
      </div>

      <section
        style={{
          ...styles.lyricBlock,
          opacity: lyricOpacity,
          transform: `translateY(${lyricY}px)`,
        }}
      >
        <JapaneseLine line={activeLine} />
        <p style={styles.korean}>{activeLine.koreanLyrics}</p>
        <Vocabulary words={activeLine.vocabulary} />
      </section>

      <EndCard data={data} frame={frame} />
    </AbsoluteFill>
  );
};

const SongLabels = ({data}: {data: PromoReelData}) => {
  return (
    <header style={styles.songLabels}>
      <div style={styles.songCard}>
        <span style={styles.title}>{data.song.title}</span>
        <span style={styles.artist}>{data.song.artist}</span>
      </div>
    </header>
  );
};

const Headline = ({data}: {data: PromoReelData}) => {
  return <h1 style={styles.headline}>{data.headline}</h1>;
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
    <div style={styles.vocabRow}>
      <div style={styles.vocabList}>
        {words.map((word) => (
          <div key={`${word.japanese}-${word.reading}`} style={styles.vocabChip}>
            <div style={styles.wordMain}>
              <span style={styles.wordJapanese}>{word.japanese}</span>
              <span style={styles.wordReading}>{word.reading}</span>
            </div>
            <span style={styles.wordDivider} />
            <span style={styles.wordKorean}>{word.korean}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const EndCard = ({data, frame}: {data: PromoReelData; frame: number}) => {
  const {fps} = useVideoConfig();
  const localFrame = frame - ENDCARD_START_FRAME;
  const progress = spring({
    config: {damping: 20, mass: 0.85, stiffness: 120},
    fps,
    frame: Math.max(0, localFrame),
  });
  const opacity = interpolate(frame, [ENDCARD_START_FRAME - 6, ENDCARD_START_FRAME + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(progress, [0, 1], [44, 0]);
  const scale = interpolate(progress, [0, 1], [0.94, 1]);

  return (
    <AbsoluteFill style={{...styles.endCardFrame, opacity}}>
      <div style={{...styles.endCard, transform: `translateY(${y}px) scale(${scale})`}}>
        <Img src={staticFile('kotonoha-icon.png')} style={styles.logo} />
        <div style={styles.endBrand}>kotonoha</div>
        <div style={styles.endCopy}>{data.catchphrase}</div>
      </div>
    </AbsoluteFill>
  );
};

const buildTextRuns = (line: PromoLine): TextRun[] => {
  const runs: TextRun[] = [];
  let cursor = 0;

  for (const token of line.tokens) {
    if (token.charStart > cursor) {
      runs.push({
        color: ink,
        text: line.originalText.slice(cursor, token.charStart),
      });
    }

    runs.push({
      color: posColors[token.partOfSpeech],
      text: line.originalText.slice(token.charStart, token.charEnd),
    });
    cursor = token.charEnd;
  }

  if (cursor < line.originalText.length) {
    runs.push({
      color: ink,
      text: line.originalText.slice(cursor),
    });
  }

  return runs.filter((run) => run.text.length > 0);
};

const fontStack =
  '"Noto Sans CJK KR", "Noto Sans CJK JP", "Apple SD Gothic Neo", "Hiragino Sans", sans-serif';

const styles = {
  canvas: {
    backgroundColor: '#111012',
    color: ink,
    fontFamily: fontStack,
    overflow: 'hidden',
  },
  backgroundLayer: {
    filter: 'blur(24px)',
    transform: 'scale(1.12)',
  },
  backgroundVideo: {
    height: '100%',
    objectFit: 'cover',
    opacity: 0.34,
    width: '100%',
  },
  darkWash: {
    background:
      'linear-gradient(180deg, rgba(15,14,17,0.82) 0%, rgba(15,14,17,0.38) 35%, rgba(15,14,17,0.58) 64%, rgba(15,14,17,0.92) 100%)',
  },
  songLabels: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    left: 92,
    position: 'absolute',
    top: 132,
    zIndex: 3,
  },
  songCard: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(244,241,234,0.92)',
    borderLeft: `8px solid ${lemon}`,
    boxShadow: '0 18px 48px rgba(0,0,0,0.30)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '13px 18px 15px 17px',
  },
  title: {
    color: night,
    fontSize: 42,
    fontWeight: 1000,
    letterSpacing: -1.2,
    lineHeight: 1.06,
  },
  artist: {
    color: 'rgba(17,16,18,0.70)',
    fontSize: 25,
    fontWeight: 900,
    letterSpacing: -0.5,
    lineHeight: 1.04,
  },
  headline: {
    color: paper,
    fontSize: 64,
    fontWeight: 1000,
    left: 88,
    letterSpacing: -2.7,
    lineHeight: 1.12,
    margin: 0,
    position: 'absolute',
    right: 88,
    textAlign: 'center',
    textShadow: '0 8px 30px rgba(0,0,0,0.60)',
    top: 335,
    zIndex: 3,
  },
  videoFrame: {
    backgroundColor: 'rgba(244,241,234,0.04)',
    boxShadow: '0 30px 98px rgba(0,0,0,0.50)',
    height: 650,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 570,
  },
  framedVideo: {
    height: '100%',
    objectFit: 'cover',
    width: '100%',
  },
  handle: {
    backgroundColor: 'rgba(17,16,18,0.48)',
    color: 'rgba(250,250,246,0.82)',
    fontSize: 25,
    fontWeight: 900,
    letterSpacing: -0.4,
    padding: '7px 12px 8px',
    position: 'absolute',
    right: 26,
    top: 24,
  },
  lyricBlock: {
    left: 58,
    position: 'absolute',
    right: 82,
    textAlign: 'center',
    top: 1112,
    zIndex: 4,
  },
  japanese: {
    fontSize: 58,
    fontWeight: 900,
    letterSpacing: -1.6,
    lineHeight: 1.26,
    margin: 0,
    textShadow: '0 5px 22px rgba(0,0,0,0.78)',
  },
  korean: {
    color: ink,
    fontSize: 41,
    fontWeight: 900,
    letterSpacing: -1.1,
    lineHeight: 1.32,
    margin: '20px 0 0',
    textShadow: '0 5px 22px rgba(0,0,0,0.78)',
  },
  vocabRow: {
    marginTop: 28,
  },
  vocabList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'center',
  },
  vocabChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,16,18,0.66)',
    border: '1px solid rgba(244,241,234,0.20)',
    borderRadius: 9,
    boxShadow: '0 12px 34px rgba(0,0,0,0.36)',
    display: 'flex',
    gap: 15,
    padding: '13px 17px 14px',
  },
  wordMain: {
    alignItems: 'baseline',
    display: 'flex',
    gap: 10,
  },
  wordJapanese: {
    color: paper,
    fontSize: 39,
    fontWeight: 1000,
    letterSpacing: -0.9,
    lineHeight: 1,
  },
  wordReading: {
    color: lemon,
    fontSize: 25,
    fontWeight: 900,
    letterSpacing: -0.4,
    lineHeight: 1,
  },
  wordDivider: {
    backgroundColor: 'rgba(244,241,234,0.22)',
    display: 'block',
    height: 35,
    width: 1,
  },
  wordKorean: {
    color: ink,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: -0.6,
    lineHeight: 1,
  },
  endCardFrame: {
    alignItems: 'center',
    background: '#111012',
    display: 'flex',
    justifyContent: 'center',
    zIndex: 10,
  },
  endCard: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    padding: '0 86px',
    textAlign: 'center',
  },
  logo: {
    borderRadius: 32,
    height: 128,
    width: 128,
  },
  endBrand: {
    color: paper,
    fontSize: 58,
    fontWeight: 1000,
    letterSpacing: -2,
    marginTop: 28,
  },
  endCopy: {
    color: 'rgba(244,241,234,0.78)',
    fontSize: 34,
    fontWeight: 900,
    letterSpacing: -1,
    lineHeight: 1.34,
    marginTop: 22,
  },
} satisfies Record<string, CSSProperties>;
