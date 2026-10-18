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

import {convertLineReading, convertReading, katakanaToHiragana} from '../../app-rn/src/utils/readingConverter';
import {SCORE_DREAM_FAMILY, useScoreDream} from './fonts/scoreDream';
import {parseHeadline} from './headline';
import type {LyricToken, MvCrop, MvFrame, MvKeyframe, PartOfSpeech, PromoLine, PromoReelData, VocabularyWord} from './types';

export const PROMO_FPS = 30;
// 엔드카드 7초. 앱 목업이 시트 → 단어 탭 → 복습 → rating → 다음 단어까지 흐르고, 스토어 검색 큐를 읽을 시간이다.
// 바꾸면 admin-web reelEditor.ts 의 END_CARD_MS 도 같이 바꾼다.
export const END_CARD_DURATION_IN_FRAMES = 210;
export const PROMO_WIDTH = 1080;
export const PROMO_HEIGHT = 1920;
// 인스타 릴스 UI 의 프로필 사진 바로 위. 가사·단어 블록은 이 위에서 끝나야 한다.
const PROFILE_CUE_TOP = 1576;
// 맨 위 헤드라인 띠의 높이. MV 는 이 아래에만 보인다.
export const HEADLINE_BAND_HEIGHT = 580;
// MV 기본 자리의 바닥. 그 아래는 인스타 프로필·캡션이 덮는 자리라 기본값으로는 비워 둔다.
// 어드민이 mvFrame 으로 옮기면 캔버스 끝까지 보인다.
export const MV_AREA_BOTTOM = 1560;
// 인스타 상단 UI(뒤로가기·탭) 바로 아래. 곡 표기는 썸네일에서 잘려도 되는 정보라 크롭선(240) 위에서 끝난다.
const SONG_LABEL_TOP = 152;
// 피드 미리보기(4:5)가 위아래 285 씩, 프로필 그리드(3:4)가 240 씩 잘라낸다. 계정명·헤드라인이 둘 다에서
// 남고 인스타 상단 UI(≈220)도 피하도록 띠 안 내용은 이 아래에서 시작한다.
const BAND_SAFE_TOP = 300;
// 가사 블록 좌우 여백과 그 안쪽 폭. 오른쪽은 인스타 좋아요·댓글 버튼 열을 피한다.
const CONTENT_SIDE = 150;
const LYRIC_WIDTH = PROMO_WIDTH - CONTENT_SIDE * 2;
// 내용이 짧을 때 가사 블록이 앉는 자리
const CONTENT_TOP = 1200;

// 가사 원문 한 행의 기본 치수. 한국어 번역이 주인공이라 원문은 그보다 작다. 긴 줄에서는 scale 로 같이 줄인다.
const TOKEN_FONT_SIZE = 34;
const TOKEN_GAP = 2;
// 원문 공백 자리. 행을 끊는 대신 이만큼 벌려 구(句)를 읽히게 한다.
const SPACE_GAP = 18;
const TOKEN_ROW_GAP = 4;
const KOREAN_FONT_SIZE = 46;
// 에스코어 드림엔 이탤릭이 없어 브라우저 합성 대신 직접 기울인다. 한글은 덜 기울여야 자연스럽다.
const KOREAN_SKEW = -8;

// 강조 단어 위에 얹는 뜻. 문장을 읽는 시선 안에서 단어가 읽히도록 따로 목록을 두지 않는다.
const GLOSS_FONT_SIZE = 28;
const GLOSS_GAP = 2;

const night = '#111012';
const paper = '#F4F1EA';
const ink = '#FAFAF6';
const softInk = '#FAFAF6C7';
// 헤드라인에서 <b> 로 감싼 구간 뒤에 깔리는 형광 초록
const highlight = '#1FF2A4';
// 강조 단어의 품사색. 앱 품사색(posAppColors)은 흰 배경용이라 MV 위에서 가라앉는다 — 상대 휘도를 모두 0.5 이상으로 올렸다.
// 동사는 헤드라인 형광 초록(highlight)과 겹치지 않게 연두 쪽으로 민다.
const spotlightColors: Partial<Record<string, string>> = {
  NOUN: '#66D9FF',
  VERB: '#A8FF78',
  ADJECTIVE: '#FFE45C',
  NA_ADJECTIVE: '#FFA3DA',
  ADVERB: '#E2A6FF',
};
const bandInk = '#000000';

// 배경과 무관하게 글자를 띄우는 얇은 검은 외곽선. text-stroke 는 글자 윤곽 가운데 정렬이라 두 배를 주고
// paint-order 로 획을 글자 뒤에 깐다.
const outline = (width: number): CSSProperties => ({
  paintOrder: 'stroke fill',
  WebkitTextStroke: `${width * 2}px #000000`,
});

// 앱 테마(app-rn/src/theme/theme.ts, 라이트). 엔드카드 목업은 실제 앱 화면을 그린다.
const app = {
  primary: '#16B364',
  primaryBg: '#16B36420',
  background: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#888888',
  border: '#E5E5E5',
  surfaceSubtle: '#F6F6F6',
  coverageAccent: '#E5A100',
  coverageTrack: '#F4EEDF',
  memoryLongTerm: '#16B364',
  memoryShortTerm: '#22B8CF',
  memoryRemaining: '#D2D2D2',
  tierTrack: '#EEEEEE',
};

// 앱 안 품사색(types/pos.ts). 목업의 품사 띠·메타에 쓴다.
const posAppColors: Record<string, string> = {
  NOUN: '#368EE8',
  VERB: '#299E67',
  ADJECTIVE: '#C47B1D',
  NA_ADJECTIVE: '#C47B1D',
  ADVERB: '#A276E0',
  PRONOUN: '#368EE8',
  ADNOMINAL: '#368EE8',
  CONJUNCTION: '#368EE8',
  AUXILIARY_VERB: '#299E67',
  PARTICLE: '#EB5587',
  INTERJECTION: '#368EE8',
  PREFIX: '#368EE8',
  SUFFIX: '#368EE8',
  EXPRESSION: '#368EE8',
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
  N1: '#E85E56',
  N2: '#D57031',
  N3: '#AD861D',
  N4: '#2A9B8D',
  N5: '#5388F3',
};

// 가사 다이얼에서 품사 띠를 두르지 않는 품사 — 조사·기호는 학습 대상이 아니다.
const MUTED_POS = new Set(['PARTICLE', 'SYMBOL', 'SUPPLEMENTARY_SYMBOL', 'WHITESPACE']);
// 곡 단계(word-tiers) 단어의 품사 — 목업의 복습 큐도 이 단어로 만든다.
const TIER_POS = new Set(['NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB']);
const KANJI_RE = /[一-鿿]/;

// 가사 원문 한 칸. 뜻은 어드민이 고른 강조 단어 칸에만 얹힌다.
type LyricRowToken = {
  key: string;
  text: string;
  spotlight: Spotlight | null;
  /** 원문에서 앞에 공백이 있던 칸. 행을 끊지 않고 앞쪽 여백만 넓힌다. */
  spaceBefore: boolean;
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
  // 줄 진입은 짧은 직선 이동이다 — 스프링처럼 감속하지 않고 3프레임에 끝난다. 첫 줄도 같다.
  const entry = (delay: number) => linear(localFrame - delay, 0, ENTRY_FRAMES);
  const lyricEntry = entry(0);
  const meaningEntry = entry(2);
  const mvFrame = activeMvFrame(data.mvFrame ?? null, data.mvKeyframes ?? [], frame);
  const overlay = data.renderLayer === 'overlay';

  return (
    <AbsoluteFill style={overlay ? styles.overlayCanvas : styles.canvas}>
      {/* MV 를 줄이거나 옮겨 생긴 빈 곳은 검은색 — MV 블러 배경은 헤드리스 Chrome 소프트웨어 렌더에서 너무 비싸다 */}
      {!overlay && <div style={styles.mvLayer}>
        <div style={styles.mvSlot}>
          <OffthreadVideo
            muted={false}
            src={assetSrc(data.song.mvAsset)}
            startFrom={data.sourceStartFrame}
            style={mvFrame ? framedVideoStyle(mvFrame) : styles.fullVideo}
            volume={(f) => interpolate(f, [durationInFrames - 36, durationInFrames - 1], [0.72, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}
          />
        </div>
      </div>}

      {/* 엔드카드가 덮은 뒤에도 그대로 둔다 — 엔드카드가 이 화면을 블러해 배경으로 쓴다(pen 의 Prev Frame + Blur Layer). */}
      {!(overlay && frame >= lyricsEndFrame) && <div style={styles.activeLayer}>
        <HeadlineBlock data={data} />
        <SongLabel song={data.song} />
        <PromoBanner data={data} />
        <ProfileCue />
        {activeIndex >= 0 && (
          <section style={{...styles.content, transform: `translateY(${data.lyricOffsetY ?? 0}px)`}}>
            <LyricBlockView
              line={activeLine}
              lyricEntry={lyricEntry}
              meaningEntry={meaningEntry}
              userScale={data.lyricScale ?? 1}
            />
            {/* 남는 높이를 먹는 스페이서. 내용이 짧으면 CONTENT_TOP 에 붙고, 길면 0 으로 줄어 위로 넘친다. */}
            <div style={styles.contentSpacer} />
          </section>
        )}
      </div>}

      <EndCard data={data} startFrame={lyricsEndFrame} backdrop={!overlay} />
    </AbsoluteFill>
  );
};

/** 이 프레임에 시작해 있는 마지막 키프레임의 배치. 키프레임 전이면 기본 배치다. */
export const activeMvFrame = (base: MvFrame | null, keyframes: MvKeyframe[], frame: number): MvFrame | null =>
  keyframes.reduce((found, keyframe) => (keyframe.startFrame <= frame ? keyframe.mvFrame : found), base);

// 폭만 정하고 높이는 MV 원래 비율을 따른다. objectFit 로 캔버스에 맞춰 자르지 않아야 MV 전체를 줄여 담을 수 있다.
const framedVideoStyle = ({scale, x, y, crop}: MvFrame): CSSProperties => ({
  ...cropStyle(crop),
  height: 'auto',
  left: '50%',
  maxWidth: 'none',
  position: 'absolute',
  top: '50%',
  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
  width: PROMO_WIDTH * scale,
});

// object-view-box 는 영상의 원래 크기 자체를 잘라낸 영역으로 바꾼다. 그래서 height:auto 와 objectFit:cover 가
// 둘 다 잘라낸 영역 비율로 계산되고, 블러 배경에도 검은 여백이 섞이지 않는다. (Chromium 전용 — 렌더 크롬·어드민 크롬 기준)
const cropStyle = (crop: MvCrop | null | undefined): CSSProperties => {
  if (!crop || (crop.top === 0 && crop.right === 0 && crop.bottom === 0 && crop.left === 0)) return {};
  const pct = (value: number) => `${(value * 100).toFixed(3)}%`;
  return {objectViewBox: `inset(${pct(crop.top)} ${pct(crop.right)} ${pct(crop.bottom)} ${pct(crop.left)})`} as CSSProperties;
};

const ENTRY_FRAMES = 3;
const END_CARD_FADE_FRAMES = 6;

// 0→1 직선 진행. 스프링 없이 짧게 움직이고 끝난다.
const linear = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

// 목업 안 화면 전환용 — 앱처럼 감속(ease-out)한다. 가사·엔드카드 전환은 linear 를 쓴다.
const eased = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

const entryStyle = (progress: number, skew = 0): CSSProperties => ({
  opacity: progress,
  transform: `translateY(${interpolate(progress, [0, 1], [14, 0])}px) skewX(${skew}deg)`,
});

// 화면 맨 위 띠. 계정명과 어드민이 쓴 헤드라인이 MV 와 겹치지 않는 바탕 위에 앉는다.
// 어드민이 옮기는 건 글자뿐이라 띠 높이는 그대로다.
const HeadlineBlock = ({data}: {data: PromoReelData}) => (
  <div style={styles.headlineBlock}>
    <div style={{...styles.headlineGroup, transform: `translateY(${data.headlineOffsetY ?? 0}px)`}}>
      <div style={styles.watermark}>{data.instagramHandle}</div>
      <Headline text={data.headline} fontSize={data.headlineFontSize ?? DEFAULT_HEADLINE_FONT_SIZE} onBand />
    </div>
  </div>
);

/** 어드민이 크기를 정하지 않았을 때의 헤드라인 글자 크기(px). */
export const DEFAULT_HEADLINE_FONT_SIZE = 76;

/** 헤드라인 한 덩어리. 줄바꿈이 줄을 나누고 `<b>…</b>` 로 감싼 구간에만 초록 배경이 깔린다. */
const Headline = ({
  text,
  fontSize = DEFAULT_HEADLINE_FONT_SIZE,
  onBand = false,
}: {
  text: string;
  fontSize?: number;
  /** 띠 위면 외곽선 없이, 엔드카드처럼 블러 배경 위면 얇은 외곽선을 둔다. */
  onBand?: boolean;
}) => {
  const lines = parseHeadline(text);
  if (lines.length === 0) return null;
  return (
    <div style={styles.headline}>
      {lines.map((segments, line) => (
        <div key={line} style={styles.headlineLine}>
          {segments.map((segment, at) => (
            <span
              key={at}
              style={{
                ...(segment.highlight ? styles.headlineHighlight : styles.headlinePlain),
                ...(!segment.highlight && !onBand ? outline(2) : null),
                fontSize,
              }}
            >
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

// 곡명·아티스트 두 줄을 왼쪽 초록 막대로 묶는다.
const SongLabel = ({song}: {song: PromoReelData['song']}) => (
  <div style={styles.songLabel}>
    <span style={styles.songTitle}>{song.title}</span>
    <span style={styles.songArtist}>{song.artist}</span>
  </div>
);

// 곡명 줄 오른쪽의 코토노하 광고 배너. 움직이는 배너 광고처럼 세 장면(단어 카드 → 무료 CTA → 이 곡 단어 수)이
// 영상 내내 돈다. 숫자와 카드 단어는 이 릴스의 실제 데이터라 아무 곡에나 붙는 광고로 보이지 않는다.
const BANNER_TOP = 142;
const BANNER_HEIGHT = 96;
const BANNER_RIGHT = 48;
const BANNER_WIDTH = 430;
const SCENE_FRAMES = 90;
// 장면 경계 앞뒤로 이만큼씩 초록 띠가 배너를 덮고 지나간다. 띠가 다 덮은 순간에 장면이 바뀐다.
const WIPE_FRAMES = 7;
const COUNT_FRAMES = 24;
const FLIP_START = 15;
const FLIP_FRAMES = 14;
const PRESS_START = 36;

const PromoBanner = ({data}: {data: PromoReelData}) => {
  const frame = useCurrentFrame();
  const scene = Math.floor(frame / SCENE_FRAMES) % 3;
  const local = frame % SCENE_FRAMES;
  const wipeIn = interpolate(local, [SCENE_FRAMES - WIPE_FRAMES, SCENE_FRAMES], [-100, 0], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wipeOut = interpolate(local, [0, WIPE_FRAMES], [0, 100], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 첫 프레임은 띠 없이 바로 보인다. 시청자 절반이 3초 안에 넘긴다.
  const wipe = frame < SCENE_FRAMES ? wipeIn : local < WIPE_FRAMES ? wipeOut : wipeIn;
  return (
    <div style={styles.banner}>
      {scene === 0 && <WordCardScene word={bannerWord(data.lyricLines, frame - local)} local={local} />}
      {scene === 1 && <CtaScene local={local} />}
      {scene === 2 && <WordCountScene total={data.wordCount ?? 0} local={local} />}
      {wipe > -100 && wipe < 100 && <div style={{...styles.bannerWipe, transform: `translateX(${wipe}%)`}} />}
    </div>
  );
};

const WordCountScene = ({total, local}: {total: number; local: number}) => {
  const count = Math.round(total * eased(local, WIPE_FRAMES, WIPE_FRAMES + COUNT_FRAMES));
  return (
    <div style={styles.bannerCopy}>
      <span style={{...styles.bannerTitle, fontSize: 40}}>
        이 곡 단어 <span style={styles.bannerNumber}>{count}</span>개
      </span>
    </div>
  );
};

// 장면이 시작할 때 화면에 떠 있던 줄의 강조 단어. 장면 도중 줄이 바뀌어도 뒤집히던 카드가 바뀌지 않는다.
const bannerWord = (lines: PromoLine[], sceneStart: number): VocabularyWord | null => {
  const words = (from: PromoLine[]) => from.flatMap((line) => line.vocabulary.filter((word) => word.korean !== ''));
  const shown = lines.filter((line) => line.startFrame <= sceneStart);
  return words(shown.slice(-1))[0] ?? words(lines)[0] ?? null;
};

const WordCardScene = ({word, local}: {word: VocabularyWord | null; local: number}) => {
  const flip = interpolate(local, [FLIP_START, FLIP_START + FLIP_FRAMES], [0, 180], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 뒤집히는 동안 카드가 살짝 들렸다 내려앉는다.
  const lift = 1 + 0.12 * Math.sin((flip / 180) * Math.PI);
  return (
    <div style={styles.bannerRow}>
      {word && (
        <div style={styles.flipStage}>
          <div style={{...styles.flipCard, transform: `scale(${lift}) rotateY(${flip}deg)`}}>
            <div style={{...styles.cardFace, ...styles.cardFront}}>
              <span style={styles.cardReading}>{katakanaToHiragana(word.reading)}</span>
              <span style={styles.cardJapanese}>{word.japanese}</span>
            </div>
            <div style={{...styles.cardFace, ...styles.cardBack}}>
              <span style={styles.cardKorean}>{word.korean}</span>
            </div>
          </div>
        </div>
      )}
      <div style={styles.bannerCopy}>
        <span style={styles.bannerTitle}>일본어 단어장 앱</span>
        <span style={styles.bannerSub}>이 노래 단어가 다 있어요</span>
      </div>
    </div>
  );
};

const CtaScene = ({local}: {local: number}) => {
  const press = interpolate(local, [PRESS_START, PRESS_START + 4, PRESS_START + 10], [1, 0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={styles.bannerRow}>
      <div style={styles.brandMark}>
        <LeafIcon />
      </div>
      <div style={styles.bannerCopy}>
        <span style={styles.bannerTitle}>코토노하</span>
        <span style={styles.bannerSub}>프로필 링크</span>
      </div>
      <span style={{...styles.ctaButton, transform: `scale(${press})`}}>무료로 시작</span>
    </div>
  );
};

// 인스타 릴스 UI 의 프로필 사진 바로 위. 화살표가 아바타(좌하단 x≈74~162)를 가리켜
// 프로필 링크로 스토어 진입을 유도한다. 위치·문구는 Pen Reel v2 의 Profile Cue 와 같다.
const ProfileCue = () => (
  <div style={styles.profileCue}>
    <ArrowDownIcon />
    <span style={styles.profileCueLabel}>노래로 배우는 일본어 앱 '코토노하'에서 다른 단어도 공부해요!</span>
  </div>
);

// 한 줄 전체를 토큰 단위로 펼친다. 행은 폭이 넘칠 때 어절(원문 공백) 사이에서만 꺾이고, 가장 긴 어절이 한 행에
// 들어가도록 글자를 줄인다. 아래에 그 줄의 번역을 붙인다(가사보다 4프레임 늦게 들어온다).
// 강조 단어 칸은 뜻을 위에 얹은 세로 칸이 되고, 행이 아래(flex-end)로 맞춰져 있어 원문 글자 높이는 그대로다.
const LyricBlockView = ({
  line,
  lyricEntry,
  meaningEntry,
  userScale,
}: {
  line: PromoLine;
  lyricEntry: number;
  meaningEntry: number;
  /** 어드민이 정한 가사 배율. 자동 축소 위에 곱해진다. */
  userScale: number;
}) => {
  const phrases = groupByPhrase(buildLyricTokens(line));
  const scale = lyricScale(phrases, userScale);
  return (
    <div style={styles.lyricBlock}>
      <div
        style={{
          ...styles.lyricRow,
          columnGap: TOKEN_GAP * scale,
          rowGap: TOKEN_ROW_GAP * scale,
          ...entryStyle(lyricEntry),
        }}
      >
        {phrases.map((phrase) => (
          <span
            key={phrase[0].key}
            style={{
              ...styles.lyricPhrase,
              columnGap: TOKEN_GAP * scale,
              rowGap: TOKEN_ROW_GAP * scale,
              marginLeft: phrase[0].spaceBefore ? SPACE_GAP * scale : 0,
            }}
          >
            {phrase.map((token) => {
              const text = (
                <span style={{...styles.token, color: token.spotlight?.color ?? softInk, fontSize: TOKEN_FONT_SIZE * scale}}>
                  {token.text}
                </span>
              );
              if (!token.spotlight) return <span key={token.key}>{text}</span>;
              return (
                <span key={token.key} style={{...styles.glossCell, gap: GLOSS_GAP * scale}}>
                  <span style={styles.glossTrack}>
                    <span style={{...styles.gloss, color: token.spotlight.color, fontSize: GLOSS_FONT_SIZE * scale}}>
                      {token.spotlight.gloss}
                    </span>
                  </span>
                  {text}
                </span>
              );
            })}
          </span>
        ))}
      </div>
      {line.koreanLyrics !== '' && (
        <p style={{...styles.korean, ...entryStyle(meaningEntry, KOREAN_SKEW)}}>{line.koreanLyrics}</p>
      )}
    </div>
  );
};

const EndCard = ({data, startFrame, backdrop}: {data: PromoReelData; startFrame: number; backdrop: boolean}) => {
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
    <AbsoluteFill style={{...styles.endCardLayer, ...(backdrop ? styles.endCardBackdrop : null), opacity: enter}}>
      <div style={styles.endWatermark}>{data.instagramHandle}</div>
      <div style={{...styles.endTitleBlock, transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`}}>
        <Headline text={END_CARD_HEADLINE} />
      </div>
      <AppMockup data={data} artwork={artwork} frame={localFrame} />
      {/* 스토어 큐가 앉는 바닥. 불투명한 띠 대신 블러 배경으로 녹아드는 그라데이션이다. */}
      <div style={styles.bottomScrim} />
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

// 엔드카드 헤드라인은 브랜드 CTA 라 어드민 입력이 아니라 여기 고정이다. 표기 규칙은 상단 헤드라인과 같다.
const END_CARD_HEADLINE = '전체 단어는\n<b>코토노하 앱에서</b>';
const SEARCH_QUERY = '코토노하';
const TYPING_START = 30;
const TYPING_FRAMES_PER_CHAR = 9;

// SongDetailScreen(히어로 · 홈/단어 탭 · 이해도 · 완곡까지 3단계 · MV 바)을 460×860 폰 안에 그리고,
// CurrentPlayingWordsSheet 가 MV 바를 핸들 삼아 올라와 가사 다이얼을 펼친다. 포커스 줄의 단어를 누르면
// SongReviewScreen 이 폰을 덮고, 앞면 탭 → pill 이 rating 넷으로 갈라짐 → rating 홀드 → 다음 단어로 이어진다.
// 곡 상세는 이 곡을 처음 연 사람의 화면이다(이해도 0%, 첫 단계가 펼쳐짐). 타이포는 실제 비율보다
// 1.2배 크다 — 릴스에서 축소돼 보이므로 실제 스케일 그대로 두면 안 읽힌다.

const PHONE_WIDTH = 460;
const PHONE_HEIGHT = 860;
// 폰 바닥. 스토어 큐(top 1350)와 80px 떨어뜨려 검색창이 폰에 붙어 보이지 않게 하고, 바닥 스크림도 여기서 시작한다.
const MOCKUP_BOTTOM = 1270;
// 실제(360)보다 낮다. 그대로 두면 첫 단계 CTA 가 접힌 MV 바 밑에 깔린다.
const MOCK_HERO_HEIGHT = 256;
// 접힌 시트는 MV 바(SONG_DETAIL_MV_BAR_HEIGHT)만 보인다.
const MV_BAR_HEIGHT = 67;
const SHEET_EXPANDED_TOP = 56;

// 엔드카드 안 목업 타임라인(엔드카드 시작 기준 프레임). 화면 전환은 하드컷, 움직임은 앱의 애니메이션 길이를 따른다.
const MOCK_T = {
  sheetRise: 10,
  wordTap: 40,
  reviewOpen: 48,
  frontTap: 84,
  reveal: 90,
  ratingTap: 126,
  // RATING_HOLD_MS(900ms) 동안 홀드 pill 로 머문 뒤 저절로 넘어간다.
  advance: 153,
};
const TAP_FRAMES = 8;
// 프로덕션 길이를 30fps 로 옮긴 값 — push 260ms, reveal 320ms, 갈라짐 720ms, 홀드 pill 160ms, 넘김 180ms.
const PUSH_FRAMES = 8;
const REVEAL_FRAMES = 10;
const SPLIT_FRAMES = 22;
const HOLD_ENTER_FRAMES = 5;
const ADVANCE_FRAMES = 6;

const AppMockup = ({data, artwork, frame}: {data: PromoReelData; artwork: string | null; frame: number}) => {
  const {fps} = useVideoConfig();
  // gorhom BottomSheet 의 스프링 감속
  const rise = spring({config: {damping: 20, mass: 0.8, stiffness: 120}, fps, frame: Math.max(0, frame - MOCK_T.sheetRise)});
  const sheetTop = interpolate(rise, [0, 1], [PHONE_HEIGHT - MV_BAR_HEIGHT, SHEET_EXPANDED_TOP]);
  const lines = data.lyricLines.length > 0 ? data.lyricLines : [emptyLine];
  // 다이얼은 포커스 위로 지난 줄이 한 줄 보인다 — 그래서 두 번째 줄부터 누를 단어가 있는 줄을 찾는다.
  const focusIndex = Math.max(0, lines.findIndex((line, index) => index >= Math.min(1, lines.length - 1) && mockWords(line).length > 0));
  const focusLine = lines[focusIndex];
  const queue = reviewQueue(lines, focusIndex);
  const tapping = frame >= MOCK_T.wordTap && frame < MOCK_T.wordTap + TAP_FRAMES;

  return (
    <div style={styles.phone}>
      <SongDetailPage data={data} artwork={artwork} tierWords={queue} />
      <div style={{...styles.sheet, top: sheetTop, height: PHONE_HEIGHT - SHEET_EXPANDED_TOP}}>
        <MvBar data={data} artwork={artwork} />
        <LyricsDial lines={lines} focusIndex={focusIndex} tappedWord={tapping ? (queue[0] ?? null) : null} />
        <div style={styles.sheetBottomFade} />
        <div style={styles.syncPill}><LocateIcon /><span>싱크 ON</span></div>
      </div>
      {frame >= MOCK_T.reviewOpen && queue.length > 0 && (
        <ReviewMock data={data} line={focusLine} words={queue} artwork={artwork} frame={frame} />
      )}
    </div>
  );
};

const TIERS = [
  {name: '따라 부르기', description: '자주 나오는 단어까지 알면 흥얼거리며 부를 수 있어요'},
  {name: '완곡', description: '여기까지 알면 이 곡을 완전히 마스터해요!'},
];

const SongDetailPage = ({data, artwork, tierWords}: {data: PromoReelData; artwork: string | null; tierWords: VocabularyWord[]}) => {
  const totalLines = data.totalLineCount ?? data.lyricLines.length;
  const tierCount = tierWords.length;
  return (
    <div style={styles.phonePage}>
      <div style={styles.mockHero}>
        {artwork
          ? <div style={{...styles.mockHeroArt, backgroundImage: `url("${artwork}")`}} />
          : <div style={{...styles.mockHeroArt, backgroundColor: app.textPrimary}} />}
        <div style={styles.mockHeroScrim} />
        <div style={{...styles.mockIconButton, left: 14}}><ChevronLeftIcon /></div>
        <div style={{...styles.mockIconButton, right: 14}}><InfoIcon /></div>
        <div style={styles.mockHeroInfo}>
          <span style={styles.mockSongTitle}>{data.song.title}</span>
          <span style={styles.mockSongArtist}>{data.song.artist}<ChevronRightIcon color="#FFFFFFCC" size={19} /></span>
          <div style={styles.mockDeckButton}><LayersIcon /><span>학습 시작</span></div>
        </div>
      </div>
      <div style={styles.mockTabBar}>
        <div style={styles.mockTab}><span style={styles.mockTabLabelActive}>홈</span><div style={styles.mockTabIndicator} /></div>
        <div style={styles.mockTab}><span style={styles.mockTabLabel}>단어</span></div>
      </div>
      <div style={styles.mockHome}>
        <div style={styles.coverage}>
          <div style={styles.coverageHead}>
            <div style={styles.coverageMeta}><span>전체 가사 중</span><HelpIcon /></div>
            <div style={styles.coverageStatement}>
              <span style={{color: app.coverageAccent}}>0%</span><span>를 이해하고 있어요</span>
            </div>
          </div>
          <div style={styles.coverageMeter}>
            <div style={styles.coverageTrack} />
            <div style={styles.coverageCounts}>
              <span style={{...styles.mockDot, backgroundColor: app.coverageAccent}} />
              <span style={styles.coverageCountLabel}>이해하는 가사</span>
              <span style={styles.coverageCountValue}>0 / {totalLines}줄</span>
            </div>
          </div>
        </div>
        <div style={styles.tierSection}>
          <span style={styles.tierSectionTitle}>완곡까지 3단계</span>
          <div style={styles.tierStep}>
            <div style={styles.tierRail}>
              <div style={styles.tierDotCurrent}><div style={styles.tierDotCurrentCore} /></div>
              <div style={styles.tierConnector} />
            </div>
            <div style={{...styles.tierBody, paddingBottom: 14}}>
              <div style={styles.tierCardExpanded}>
                <div style={styles.tierIntro}>
                  <span style={styles.tierExpandedTitle}>후렴 정복</span>
                  <span style={styles.tierExpandedDesc}>후렴에 나오는 핵심 단어 {tierCount}개부터 공부해요</span>
                </div>
                <div style={styles.tierProgress}>
                  <div style={{...styles.tierTrack, height: 7}} />
                  <div style={styles.tierStats}>
                    <TierStat color={app.memoryLongTerm} label="장기기억" value={0} />
                    <TierStat color={app.memoryShortTerm} label="단기기억" value={0} />
                    <TierStat color={app.memoryRemaining} label="남음" value={tierCount} muted />
                  </div>
                </div>
                <div style={styles.tierCta}>
                  <div style={styles.tierCtaCopy}>
                    <span style={styles.tierCtaLabel}>지금 학습할 단어 {tierCount}개</span>
                    <span style={styles.tierCtaTime}><ClockIcon />약 {studyMinutes(tierCount)}분</span>
                  </div>
                  <div style={styles.tierRoller}>
                    {tierWords.slice(0, 2).map((word, index) => (
                      <span key={word.japanese} style={{...styles.tierRollerWord, opacity: index === 0 ? 1 : 0.2}}>{word.japanese}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {TIERS.map((tier, index) => (
            <div key={tier.name} style={styles.tierStep}>
              <div style={styles.tierRail}>
                <div style={styles.tierDotTodo}><div style={styles.tierDotTodoCore} /></div>
                {index < TIERS.length - 1 && <div style={styles.tierConnector} />}
              </div>
              <div style={{...styles.tierBody, paddingBottom: index < TIERS.length - 1 ? 14 : 0}}>
                <div style={styles.tierCardCollapsed}>
                  <span style={styles.tierCollapsedTitle}>{tier.name}</span>
                  <span style={styles.tierCollapsedDesc}>{tier.description}</span>
                  <div style={{...styles.tierTrack, height: 6}} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TierStat = ({color, label, value, muted}: {color: string; label: string; value: number; muted?: boolean}) => (
  <span style={styles.tierStat}>
    <span style={{...styles.mockDot, backgroundColor: color}} />
    <span style={styles.tierStatLabel}>{label}</span>
    <span style={{...styles.tierStatValue, color: muted ? app.textMuted : app.textSecondary}}>{value}</span>
  </span>
);

// songDetailTier.estimateStudyMinutes — 카드 한 장 20초, 올림.
const studyMinutes = (count: number) => (count <= 0 ? 0 : Math.max(1, Math.ceil((count * 20) / 60)));

const MvBar = ({data, artwork}: {data: PromoReelData; artwork: string | null}) => (
  <div style={styles.mvBar}>
    <div style={{...styles.mvThumb, ...(artwork ? {backgroundImage: `url("${artwork}")`} : {})}} />
    <div style={styles.mvText}>
      <span style={styles.mvTitle}>{data.song.title}</span>
      <span style={styles.mvArtist}>{data.song.artist}</span>
    </div>
    <PauseIcon />
  </div>
);

// SongLyricsDial — 포커스 줄은 띠 위에 펼치고(후리가나·품사 띠·토큰 뜻·발음·번역), 나머지 줄은 원문만 거리만큼 흐리게 둔다.
// 포커스 띠의 가운데가 다이얼 높이의 FOCUS_CENTER_RATIO 에 온다.
const DIAL_TOP_PADDING = 41;
const DIAL_HEIGHT = PHONE_HEIGHT - SHEET_EXPANDED_TOP - MV_BAR_HEIGHT - DIAL_TOP_PADDING;
const FOCUS_CENTER_RATIO = 0.38;
const DIAL_LINE_GAP = 26;
const DISTANCE_OPACITY = [1, 0.44, 0.3, 0.23, 0.18, 0.15, 0.13];

const LyricsDial = ({lines, focusIndex, tappedWord}: {lines: PromoLine[]; focusIndex: number; tappedWord: VocabularyWord | null}) => {
  const restLine = (line: PromoLine, index: number) => (
    <span key={index} style={{...styles.dialRestLine, opacity: DISTANCE_OPACITY[Math.min(Math.abs(index - focusIndex), DISTANCE_OPACITY.length - 1)]}}>
      {line.originalText}
    </span>
  );
  return (
    <div style={styles.dial}>
      {/* 띠 높이를 재지 않고 가운데를 맞춘다 — 위·아래 줄은 띠 바깥에 붙여 쌓는다. */}
      <div style={{...styles.dialAnchor, top: DIAL_HEIGHT * FOCUS_CENTER_RATIO}}>
        <div style={{...styles.dialRest, bottom: `calc(100% + ${DIAL_LINE_GAP}px)`}}>
          {lines.slice(0, focusIndex).map((line, index) => restLine(line, index))}
        </div>
        <FocusedLine line={lines[focusIndex]} tappedWord={tappedWord} />
        <div style={{...styles.dialRest, top: `calc(100% + ${DIAL_LINE_GAP}px)`}}>
          {lines.slice(focusIndex + 1).map((line, index) => restLine(line, focusIndex + 1 + index))}
        </div>
      </div>
    </div>
  );
};

const FocusedLine = ({line, tappedWord}: {line: PromoLine; tappedWord: VocabularyWord | null}) => {
  const cells = buildDialCells(line);
  const tappedIndex = tappedWord ? cells.findIndex((cell) => cell.baseForm === tappedWord.japanese) : -1;
  const hasFurigana = cells.some((cell) => cell.furigana);
  const hasMeaning = cells.some((cell) => cell.meaning);
  const pronunciation = convertLineReading(line.originalText, readingTokens(line.tokens), 'KOREAN');
  return (
    <div style={styles.focusBand}>
      {cells.length > 0 ? (
        <div style={styles.focusTokens}>
          {cells.map((cell, index) => (
            <div key={cell.key} style={styles.focusCell}>
              {hasFurigana && <span style={styles.focusFurigana}>{cell.furigana ?? ' '}</span>}
              <span style={{...styles.focusToken, color: cell.barColor ? app.textPrimary : app.textSecondary}}>{cell.text}</span>
              <div style={{...styles.focusBar, backgroundColor: cell.barColor ?? 'transparent'}} />
              {hasMeaning && (
                <span style={{...styles.focusMeaning, color: cell.barColor ? app.textSecondary : app.textMuted}}>{cell.meaning ?? ' '}</span>
              )}
              {index === tappedIndex && <div style={styles.tapDotCentered} />}
            </div>
          ))}
        </div>
      ) : (
        <span style={styles.focusToken}>{line.originalText}</span>
      )}
      {(pronunciation || line.koreanLyrics) && (
        <div style={styles.focusLineMeaning}>
          {pronunciation && <span style={styles.focusPronunciation}>{pronunciation}</span>}
          {line.koreanLyrics && <span style={styles.focusKorean}>{line.koreanLyrics}</span>}
        </div>
      )}
    </div>
  );
};

// 손가락이 닿은 자리. 몇 프레임 켜졌다 꺼진다.
const TapDot = ({x, y}: {x: number; y: number}) => <div style={{...styles.tapDot, left: x - 24, top: y - 24}} />;

// SongReviewScreen = CardStage(블러 아트워크 + 틴트 + 스크림 2겹) + StackReviewOverlay(뒤로 · n/N · 진행 바)
// + SourceHeader + WordFront/WordBack. 앞면 하단 pill 과 뒷면 rating 줄은 같은 자리·같은 높이라,
// 뒤집힐 때 pill 이 그 자리에서 rating 버튼 넷으로 갈라진다.

const REVIEW_CONTENT_TOP = 110;
const REVIEW_CONTENT_BOTTOM = PHONE_HEIGHT - 50;
const REVIEW_SIDE = 24;
const PILL_HEIGHT = 64;
const PILL_CAP = PILL_HEIGHT / 2;
const RATING_GAP = 10;
const RATING_SLOT_WIDTH = PHONE_WIDTH - 2 * REVIEW_SIDE;
const RATING_WIDTH = (RATING_SLOT_WIDTH - 3 * RATING_GAP) / 4;
// 하단 블록(안내 문구 + pill)의 pill 가운데. 블록 아래 여백 5 를 뺀다.
const PILL_CENTER_Y = REVIEW_CONTENT_BOTTOM - 5 - PILL_CAP;
// 앞면 표제어가 뒷면 표제어 자리로 올라가는 거리와 배율(64 → 44).
const HEADWORD_SHIFT = -60;
const HEADWORD_SCALE = 0.69;
// SWIPE_OUT_DISTANCE(-420)
const SWIPE_OUT = -500;
const GLASS_FILL = 'rgba(255,255,255,0.14)';

const ratings = [
  {rating: 1, label: '다시', interval: '10분', color: '#EF4444'},
  {rating: 2, label: '어려움', interval: '1일', color: '#F97316'},
  {rating: 3, label: '알고 있음', interval: '3일', color: '#16B364'},
  {rating: 4, label: '쉬움', interval: '7일', color: '#3B82F6'},
];
const PICKED_RATING = 3;

const clampMap = (value: number, input: number[], output: number[]) =>
  interpolate(value, input, output, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

const ReviewMock = ({
  data,
  line,
  words,
  artwork,
  frame,
}: {
  data: PromoReelData;
  line: PromoLine;
  words: VocabularyWord[];
  artwork: string | null;
  frame: number;
}) => {
  // native-stack push — 오른쪽에서 밀려 들어온다.
  const push = eased(frame, MOCK_T.reviewOpen, MOCK_T.reviewOpen + PUSH_FRAMES);
  const reveal = eased(frame, MOCK_T.reveal, MOCK_T.reveal + REVEAL_FRAMES);
  // WordLayer 의 갈라짐 곡선 — 앞쪽에 몰아 둔 bezier.
  const split = interpolate(frame, [MOCK_T.reveal, MOCK_T.reveal + SPLIT_FRAMES], [0, 1], {
    easing: Easing.bezier(0.1, 0.7, 0.2, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hold = eased(frame, MOCK_T.ratingTap, MOCK_T.ratingTap + HOLD_ENTER_FRAMES);
  const current = words[0];
  const next = words[1] ?? null;
  const offset = next === null ? 0 : eased(frame, MOCK_T.advance, MOCK_T.advance + ADVANCE_FRAMES) * SWIPE_OUT;
  const advanced = next !== null && frame >= MOCK_T.advance + ADVANCE_FRAMES;
  // WordLayer 와 같은 규칙 — 넘김 거리의 80% 지점에서 크로스페이드가 끝난다.
  const opacity = clampMap(offset, [SWIPE_OUT * 0.8, 0], [0, 1]);
  const position = advanced ? 2 : 1;
  const total = words.length;
  const frontTapDot = frame >= MOCK_T.frontTap && frame < MOCK_T.frontTap + TAP_FRAMES;
  const ratingTapDot = frame >= MOCK_T.ratingTap && frame < MOCK_T.ratingTap + TAP_FRAMES;
  const ratingIndex = ratings.findIndex((item) => item.rating === PICKED_RATING);

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
          <Thumb artwork={artwork} size={48} radius={10} />
          <div style={styles.reviewSourceText}>
            <span style={styles.reviewSourceTitle}>{data.song.title}</span>
            <span style={styles.reviewSourceSub}>{data.song.artist}</span>
          </div>
          <ChevronRightIcon color="rgba(255,255,255,0.6)" size={19} />
        </div>
        <div style={styles.reviewStack}>
          {next && (
            <div style={{...styles.reviewLayer, opacity: advanced ? 1 : 1 - opacity}}>
              <ReviewFront word={next} />
            </div>
          )}
          {!advanced && (
            <div style={{...styles.reviewLayer, opacity, transform: `translateY(${offset}px)`}}>
              {reveal > 0 && (
                <div style={styles.reviewLayer}>
                  <ReviewBack data={data} line={line} word={current} artwork={artwork} reveal={reveal} split={split} hold={hold} />
                </div>
              )}
              {reveal < 1 && (
                <div style={styles.reviewLayer}>
                  <ReviewFront word={current} reveal={reveal} split={split} />
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

      {frontTapDot && <TapDot x={PHONE_WIDTH / 2} y={PILL_CENTER_Y} />}
      {ratingTapDot && <TapDot x={REVIEW_SIDE + ratingIndex * (RATING_WIDTH + RATING_GAP) + RATING_WIDTH / 2} y={PILL_CENTER_Y} />}
    </div>
  );
};

const Thumb = ({artwork, size, radius}: {artwork: string | null; size: number; radius: number}) => (
  <div
    style={{
      ...styles.reviewThumb,
      ...(artwork ? {backgroundImage: `url("${artwork}")`} : {backgroundColor: 'rgba(82,183,136,0.24)'}),
      borderRadius: radius,
      height: size,
      width: size,
    }}
  />
);

// WordFront — 표제어 하나가 가운데, 하단에 안내 문구와 뜻 확인 pill. reveal 이 오르면 안내 → pill 글자 → pill 채움 순으로
// 사라지고, 윤곽은 갈라짐 초반에 녹는다. 표제어는 뒷면 표제어 자리로 줄며 올라간다.
const ReviewFront = ({word, reveal = 0, split = 0}: {word: VocabularyWord; reveal?: number; split?: number}) => (
  <div style={styles.reviewFace}>
    <div style={styles.reviewFrontCenter}>
      <span
        style={{
          ...styles.reviewFrontHeadword,
          opacity: clampMap(reveal, [0, 0.72, 1], [1, 1, 0]),
          transform: `translateY(${reveal * HEADWORD_SHIFT}px) scale(${interpolate(reveal, [0, 1], [1, HEADWORD_SCALE])})`,
        }}
      >
        {word.japanese}
      </span>
    </div>
    <div style={styles.reviewBottomBlock}>
      <span style={{...styles.reviewPrompt, opacity: clampMap(reveal, [0, 0.28], [1, 0]), transform: `translateY(${reveal * 12}px)`}}>
        뜻을 먼저 떠올린 뒤 확인해 보세요
      </span>
      <div style={styles.reviewPillSlot}>
        <div style={{...styles.glassFill, opacity: clampMap(reveal, [0, 0.22], [1, 0])}} />
        <div style={{...styles.glassBorder, opacity: clampMap(split, [0.06, 0.26], [1, 0])}} />
        <div style={{...styles.revealPillContent, opacity: clampMap(reveal, [0, 0.12], [1, 0])}}><TouchIcon /><span>뜻 확인하기</span></div>
      </div>
    </div>
  </div>
);

// 뒷면 그룹이 아래서 올라오는 구간(WordBack 의 revealProgress interpolate 와 같은 값).
const rise = (progress: number, from: number, distance: number): CSSProperties => ({
  opacity: clampMap(progress, [from, 1], [0, 1]),
  transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
});

// 갈라짐 키프레임(WordBack). 이웃과 맞닿는 끝이 JUNCTION_REACH 만큼 뻗은 채 앞면 pill 과 겹쳐 있다가,
// 물러나며 경계마다 허리가 생기고 끊어진다. CSS 는 폭을 바꿔도 끝 반원이 유지돼 캡을 따로 그리지 않는다.
const JUNCTION_REACH = PILL_CAP + RATING_GAP / 2;
const SPLIT_KEYS = [0, 0.06, 0.2, 0.7, 1];
const SPLIT_TRAVEL = [0, 0, 0.5, (PILL_CAP * 2) / (PILL_CAP * 2 + RATING_GAP), 1];

const ReviewBack = ({
  data,
  line,
  word,
  artwork,
  reveal,
  split,
  hold,
}: {
  data: PromoReelData;
  line: PromoLine;
  word: VocabularyWord;
  artwork: string | null;
  reveal: number;
  split: number;
  hold: number;
}) => {
  const pos = word.partOfSpeech ?? '';
  const posLabel = word.partOfSpeechLabel ?? posLabels[pos] ?? '';
  const hitIndex = line.originalText.indexOf(word.japanese);
  const hasHit = hitIndex >= 0;
  const remaining = 1 - clampMap(split, SPLIT_KEYS, SPLIT_TRAVEL);
  const restOpacity = clampMap(split, [0.78, 1], [0, 1]);
  const contentOpacity = clampMap(split, [0.55, 0.9], [0, 1]);
  const picked = ratings.find((item) => item.rating === PICKED_RATING)!;
  return (
    <div style={styles.reviewBack}>
      <div style={styles.reviewBackCenter}>
        <div style={{...styles.reviewQuestion, ...rise(reveal, 0.62, 18)}}>
          <span style={styles.reviewBackHeadword}>{word.japanese}</span>
          <div style={styles.reviewReadingRow}>
            {word.reading && <span style={styles.reviewReading}>{convertReading(word.reading, 'KOREAN')}</span>}
            {posLabel && <span style={{...styles.reviewMetaPos, color: posAppColors[pos] ?? app.textMuted}}>{posLabel}</span>}
            {posLabel && word.jlpt && <span style={styles.reviewMetaDot}>·</span>}
            {word.jlpt && <span style={{...styles.reviewMetaJlpt, color: jlptColors[word.jlpt] ?? app.textMuted}}>{word.jlpt}</span>}
          </div>
        </div>
        <div style={{...styles.reviewAnswer, ...rise(reveal, 0.32, 24)}}>
          {/* 아직 안 담긴 단어의 미리보기 카드라 편집 버튼 없이 사전 링크만 있다. */}
          <div style={styles.reviewMeaningRow}>
            <span style={styles.reviewMeaning}>{word.korean}</span>
            <ExternalLinkIcon />
          </div>
          <div style={styles.reviewExample}>
            <div style={styles.reviewExampleSource}>
              <Thumb artwork={artwork} size={19} radius={5} />
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
      <div style={styles.reviewBottomBlock}>
        <span style={{...styles.reviewPrompt, ...rise(reveal, 0.54, 20)}}>얼마나 잘 기억했나요?</span>
        <div style={styles.reviewPillSlot}>
          <div style={{...styles.ratingLayer, opacity: 1 - hold}}>
            {/* 불투명 조각을 그룹째 반투명하게 합성해야 겹친 자리가 진해지지 않는다. */}
            <div style={{...styles.ratingLayer, opacity: clampMap(reveal, [0, 0.2], [0, 1]) * clampMap(split, [0.78, 1], [0.14, 0])}}>
              {ratings.map((item, index) => {
                const leftReach = index > 0 ? JUNCTION_REACH : 0;
                const rightReach = index < ratings.length - 1 ? JUNCTION_REACH : 0;
                return (
                  <div
                    key={item.rating}
                    style={{
                      ...styles.ratingShape,
                      left: index * (RATING_WIDTH + RATING_GAP) - leftReach * remaining,
                      width: RATING_WIDTH + (leftReach + rightReach) * remaining,
                    }}
                  />
                );
              })}
            </div>
            {ratings.map((item, index) => (
              <div key={item.rating} style={{...styles.ratingButton, left: index * (RATING_WIDTH + RATING_GAP)}}>
                <div style={{...styles.glassFill, ...styles.glassRest, opacity: restOpacity}} />
                <div style={{...styles.ratingContent, color: item.color, opacity: contentOpacity}}>
                  <span style={styles.ratingLabel}>{item.label}</span>
                  <span style={styles.ratingInterval}>{item.interval}</span>
                </div>
              </div>
            ))}
          </div>
          {hold > 0 && (
            <div
              style={{
                ...styles.holdPill,
                backgroundColor: picked.color,
                boxShadow: `0 2px 14px ${picked.color}73`,
                opacity: hold,
                transform: `scale(${interpolate(hold, [0, 1], [0.96, 1])})`,
              }}
            >
              {picked.interval} 뒤에 다시 만나요
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const svgProps = {fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round'} as const;

const ChevronLeftIcon = () => (
  <svg height={24} viewBox="0 0 24 24" width={24} {...svgProps} strokeWidth={2.4}><path d="M15 18l-6-6 6-6" /></svg>
);
const ChevronRightIcon = ({color, size}: {color: string; size: number}) => (
  <svg height={size} style={{color, flexShrink: 0}} viewBox="0 0 24 24" width={size} {...svgProps} strokeWidth={2.2}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
const LeafIcon = () => (
  <svg fill="#FFFFFF" height={34} viewBox="0 0 512 512" width={34}>
    <path d="M161.35 242a16 16 0 0122.62-.68c73.63 69.36 147.51 111.56 234.45 133.07 11.73-32 12.77-67.22 2.64-101.58-13.44-45.59-44.74-85.31-90.49-114.86-40.84-26.38-81.66-33.25-121.15-39.89-49.82-8.38-96.88-16.3-141.79-63.85-5-5.26-11.81-7.37-18.32-5.66-7.44 2-12.43 7.88-14.82 17.6-5.6 22.75-2 86.51 13.75 153.82 25.29 108.14 65.65 162.86 95.06 189.73 38 34.69 87.62 53.9 136.93 53.9a186 186 0 0027.77-2.04c41.71-6.32 76.43-27.27 96-57.75-89.49-23.28-165.94-67.55-242-139.16a16 16 0 01-.65-22.65zM467.43 384.19c-16.83-2.59-33.13-5.84-49-9.77a157.71 157.71 0 01-12.13 25.68c-.73 1.25-1.5 2.49-2.29 3.71a584.21 584.21 0 0058.56 12 16 16 0 104.87-31.62z" />
  </svg>
);
const ArrowDownIcon = () => (
  <svg height={36} style={{flexShrink: 0}} viewBox="0 0 24 24" width={36} {...svgProps}>
    {/* 글자 외곽선처럼 검은 획을 먼저 깔아 밝은 MV 위에서도 보이게 한다 */}
    <path d="M12 5v14M19 12l-7 7-7-7" stroke="#000000" strokeWidth={5} />
    <path d="M12 5v14M19 12l-7 7-7-7" strokeWidth={2.6} />
  </svg>
);
// 곡 상세 학습 버튼의 layers 아이콘(SongDetailScreen.LearningActionIcon)
const LayersIcon = () => (
  <svg height={22} viewBox="0 0 24 24" width={22} {...svgProps} strokeWidth={2}>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
  </svg>
);
const InfoIcon = () => (
  <svg height={26} viewBox="0 0 24 24" width={26} {...svgProps} strokeWidth={2}>
    <circle cx={12} cy={12} r={10} /><path d="M12 16v-4M12 8h.01" />
  </svg>
);
const HelpIcon = () => (
  <svg height={21} style={{color: app.textMuted}} viewBox="0 0 24 24" width={21} {...svgProps} strokeWidth={2}>
    <circle cx={12} cy={12} r={10} /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);
const ClockIcon = () => (
  <svg height={13} viewBox="0 0 24 24" width={13} {...svgProps} strokeWidth={2.4}>
    <circle cx={12} cy={12} r={10} /><path d="M12 6v6l4 2" />
  </svg>
);
const PauseIcon = () => (
  <svg height={26} viewBox="0 0 24 24" width={26}><rect fill={app.primary} height={16} rx={1.5} width={4} x={6} y={4} /><rect fill={app.primary} height={16} rx={1.5} width={4} x={14} y={4} /></svg>
);
// Ionicons locate — 가사 다이얼의 싱크 pill
const LocateIcon = () => (
  <svg height={18} viewBox="0 0 24 24" width={18} {...svgProps} strokeWidth={2.2}>
    <circle cx={12} cy={12} r={7} /><circle cx={12} cy={12} fill="currentColor" r={2.4} stroke="none" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg height={18} style={{color: 'rgba(255,255,255,0.40)', flexShrink: 0}} viewBox="0 0 24 24" width={18} {...svgProps} strokeWidth={2}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);
const SearchIcon = () => (
  <svg height={44} style={{color: night}} viewBox="0 0 24 24" width={44} {...svgProps} strokeWidth={2.4}>
    <circle cx={11} cy={11} r={7} /><path d="M20 20l-3.5-3.5" />
  </svg>
);
// MaterialIcons touch-app(WordFront 의 뜻 확인 pill)
const TouchIcon = () => (
  <svg fill="currentColor" height={24} viewBox="0 0 24 24" width={24}>
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

// 내용어 다섯 품사 밖의 단어를 골랐더라도 흰 원문과 구별되도록 명사색으로 칠한다.
const posColor = (pos: string | null | undefined) => spotlightColors[pos ?? ''] ?? spotlightColors.NOUN!;

type Spotlight = {color: string; gloss: string};

// 어드민이 고른 강조 단어를 가사 원문의 토큰 자리로 되돌린다. vocabulary 는 기본형만 들고 오므로
// admin-web 의 tokenIndexes 처럼, 줄 앞에서부터 아직 안 쓰인 토큰에 하나씩 맞춘다.
const spotlightByTokenIndex = (line: PromoLine, ordered: LyricToken[]): Map<number, Spotlight> => {
  const picked = new Map<number, Spotlight>();
  for (const word of line.vocabulary) {
    if (word.korean === '') continue;
    const found = ordered.findIndex(
      (token, index) => !picked.has(index) && (token.baseForm || token.surface) === word.japanese,
    );
    if (found >= 0) picked.set(found, {color: posColor(ordered[found].partOfSpeech), gloss: word.korean});
  }
  return picked;
};

// 각 토큰을 한 칸으로 만든다. 원문 공백은 칸이 되지 않고 다음 칸의 앞 여백으로만 남는다 — 행은 폭으로만 끊긴다.
// 토큰 순회는 buildMockLyricTokens 와 같은 규칙이다 — 토큰 사이의 빈 구간도 원문 그대로 살린다.
const buildLyricTokens = (line: PromoLine): LyricRowToken[] => {
  const row: LyricRowToken[] = [];
  let pendingSpace = false;
  const push = (text: string, key: string, spotlight: Spotlight | null = null) => {
    if (text === '') return;
    if (text.trim() === '') {
      if (row.length > 0) pendingSpace = true;
      return;
    }
    row.push({key, text, spotlight, spaceBefore: pendingSpace});
    pendingSpace = false;
  };

  const ordered = [...line.tokens].sort((a, b) => a.charStart - b.charStart);
  const spotlights = spotlightByTokenIndex(line, ordered);
  let cursor = 0;
  ordered.forEach((token, index) => {
    if (token.charStart > cursor) push(line.originalText.slice(cursor, token.charStart), `gap-${index}`);
    push(line.originalText.slice(token.charStart, token.charEnd) || token.surface, `token-${index}`, spotlights.get(index) ?? null);
    cursor = Math.max(cursor, token.charEnd);
  });
  if (cursor < line.originalText.length) push(line.originalText.slice(cursor), 'tail');
  if (row.length === 0) push(line.originalText, 'fallback');

  return row;
};

// 긴 줄은 기본 크기로 높이 예산을 넘으면 한 단계씩 줄인다.
const TOKEN_SCALES = [1, 0.86, 0.74, 0.64];
// 원문 34×1.2
const TOKEN_ROW_HEIGHT = 41;
// 뜻 28×1.2 + 간격. 뜻이 얹힌 행 하나만 그만큼 높아진다.
const GLOSS_ROW_HEIGHT = 36;
// 기본 크기로 세 행과 뜻 한 줄까지. 넘치면 위로 자라는데, 띠 아래 곡 표기(≈560)까지는 여유가 있다.
const LYRIC_HEIGHT_BUDGET = 171;

// 원문 공백으로 나뉜 어절. 행은 어절 사이에서만 꺾인다.
const groupByPhrase = (tokens: LyricRowToken[]) =>
  tokens.reduce<LyricRowToken[][]>((phrases, token) => {
    if (token.spaceBefore || phrases.length === 0) phrases.push([token]);
    else phrases[phrases.length - 1].push(token);
    return phrases;
  }, []);

// 어드민 배율을 먼저 곱하고, 높이 예산을 넘거나 가장 긴 어절이 한 행에 안 들어가면 자동 축소 단계를 한 칸씩 내린다.
const lyricScale = (phrases: LyricRowToken[][], userScale = 1) => {
  const fits = (scale: number) =>
    lyricRowHeight(phrases, scale) <= LYRIC_HEIGHT_BUDGET &&
    phrases.every((phrase) => phraseWidth(phrase, scale) <= LYRIC_WIDTH);
  const step = TOKEN_SCALES.find((scale) => fits(scale * userScale)) ?? TOKEN_SCALES[TOKEN_SCALES.length - 1];
  return step * userScale;
};

const lyricRowHeight = (phrases: LyricRowToken[][], scale: number) => {
  const count = rowCount(phrases, scale);
  const gloss = phrases.some((phrase) => phrase.some((token) => token.spotlight)) ? GLOSS_ROW_HEIGHT : 0;
  return (count * TOKEN_ROW_HEIGHT + gloss) * scale + (count - 1) * TOKEN_ROW_GAP * scale;
};

// 브라우저처럼 어절을 앞에서부터 채운다. 한 행보다 긴 어절은 그 안에서 꺾인다.
const rowCount = (phrases: LyricRowToken[][], scale: number) => {
  let rows = 1;
  let used = 0;
  for (const phrase of phrases) {
    const width = phraseWidth(phrase, scale);
    if (used > 0 && used + TOKEN_GAP * scale + width > LYRIC_WIDTH) {
      rows += 1;
      used = 0;
    }
    if (width > LYRIC_WIDTH) {
      rows += Math.ceil(width / LYRIC_WIDTH) - 1;
      used = width % LYRIC_WIDTH;
    } else {
      used += (used > 0 ? TOKEN_GAP * scale : 0) + width;
    }
  }
  return rows;
};

// CJK/한글 1자 = 1em 으로 어림한다. 원문 공백 자리의 여백도 같이 센다.
const phraseWidth = (phrase: LyricRowToken[], scale: number) =>
  phrase.reduce(
    (sum, token) => sum + scale * (textWeight(token.text) * TOKEN_FONT_SIZE + (token.spaceBefore ? SPACE_GAP : 0)),
    0,
  ) +
  Math.max(0, phrase.length - 1) * TOKEN_GAP * scale;

const uniqueByJapanese = () => {
  const seen = new Set<string>();
  return (word: VocabularyWord) => {
    if (seen.has(word.japanese)) return false;
    seen.add(word.japanese);
    return true;
  };
};
// 단계 단어와 같은 기준 — 내용어 다섯 품사이고 뜻이 있는 토큰.
const mockWords = (line: PromoLine): VocabularyWord[] =>
  line.tokens
    .filter((token) => TIER_POS.has(token.partOfSpeech) && (token.koreanText ?? '').trim() !== '')
    .map((token): VocabularyWord => ({
      japanese: token.baseForm || token.surface,
      reading: token.baseFormReading ?? token.reading ?? '',
      korean: token.koreanText ?? '',
      partOfSpeech: token.partOfSpeech,
      jlpt: token.jlpt,
    }))
    .filter(uniqueByJapanese());

// 누른 단어부터 시작하는 복습 큐. 포커스 줄 뒤의 줄들을 먼저 잇고, 앞의 줄은 그 뒤에 붙인다.
const reviewQueue = (lines: PromoLine[], focusIndex: number): VocabularyWord[] =>
  [...lines.slice(focusIndex), ...lines.slice(0, focusIndex)].flatMap(mockWords).filter(uniqueByJapanese());

type DialCell = {key: string; text: string; baseForm: string | null; furigana: string | null; meaning: string | null; barColor: string | null};

// songLyricsDial.buildTokenCells 와 같은 규칙 — 한자 토큰에만 히라가나 후리가나, 조사·기호엔 품사 띠 없음.
const buildDialCells = (line: PromoLine): DialCell[] => {
  const cells: DialCell[] = [];
  const plain = (text: string, key: string) => {
    if (text !== '') cells.push({key, text, baseForm: null, furigana: null, meaning: null, barColor: null});
  };
  let cursor = 0;
  [...line.tokens].sort((a, b) => a.charStart - b.charStart).forEach((token, index) => {
    if (token.charStart > cursor) plain(line.originalText.slice(cursor, token.charStart), `gap-${index}`);
    const text = line.originalText.slice(token.charStart, token.charEnd) || token.surface;
    cells.push({
      key: `token-${index}`,
      text,
      baseForm: token.baseForm || token.surface,
      furigana: token.reading && KANJI_RE.test(text) ? katakanaToHiragana(token.reading) : null,
      meaning: token.koreanText ?? null,
      barColor: MUTED_POS.has(token.partOfSpeech) ? null : (posAppColors[token.partOfSpeech] ?? app.textMuted),
    });
    cursor = Math.max(cursor, token.charEnd);
  });
  if (cursor < line.originalText.length && cells.length > 0) plain(line.originalText.slice(cursor), 'tail');
  return cells;
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
  overlayCanvas: {
    backgroundColor: 'transparent',
    color: ink,
    fontFamily: reelFontStack,
    overflow: 'hidden',
  },
  fullVideo: {
    height: '100%',
    objectFit: 'cover',
    width: '100%',
  },
  // 띠 아래부터 캔버스 끝까지 MV 가 보이는 창.
  mvLayer: {
    backgroundColor: '#000000',
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: HEADLINE_BAND_HEIGHT,
  },
  // MV 기본 자리(띠 아래 ~ MV_AREA_BOTTOM). mvFrame 이 없으면 여기를 cover 로 채우고,
  // 있으면 x/y 가 이 자리 가운데 기준이다. 넘친 MV 는 잘리지 않고 mvLayer 끝까지 보인다.
  mvSlot: {
    height: MV_AREA_BOTTOM - HEADLINE_BAND_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  activeLayer: {
    inset: 0,
    position: 'absolute',
  },
  // 헤드라인이 길면 띠가 아래로 늘어나 MV 윗부분을 덮는다.
  headlineBlock: {
    backgroundColor: bandInk,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    left: 0,
    minHeight: HEADLINE_BAND_HEIGHT,
    padding: `${BAND_SAFE_TOP}px 48px 44px`,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 4,
  },
  headlineGroup: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  watermark: {
    color: ink,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: -0.3,
    lineHeight: 1,
  },
  headline: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    textAlign: 'center',
    width: '100%',
    // 한글은 기본 줄바꿈이 글자 단위다. 어절 경계에서만 접는다.
    wordBreak: 'keep-all',
  },
  headlineLine: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  headlinePlain: {
    color: ink,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  // 글자에 바짝 붙는 상자. 위아래 여백이 크면 띠지가 아니라 버튼처럼 보인다.
  headlineHighlight: {
    backgroundColor: highlight,
    color: '#000000',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    padding: '6px 14px 2px',
  },
  songLabel: {
    borderLeft: `6px solid ${highlight}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    left: 60,
    paddingLeft: 18,
    position: 'absolute',
    right: BANNER_RIGHT + BANNER_WIDTH + 28,
    top: SONG_LABEL_TOP,
    zIndex: 5,
  },
  songTitle: {
    color: ink,
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: -0.6,
    lineHeight: 1.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  songArtist: {
    color: '#FFFFFF99',
    fontSize: 26,
    fontWeight: 600,
    letterSpacing: -0.3,
    lineHeight: 1.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  banner: {
    alignItems: 'center',
    backgroundColor: bandInk,
    border: `3px solid ${highlight}`,
    borderRadius: 20,
    boxSizing: 'border-box',
    display: 'flex',
    height: BANNER_HEIGHT,
    overflow: 'hidden',
    padding: '0 20px',
    position: 'absolute',
    right: BANNER_RIGHT,
    top: BANNER_TOP,
    width: BANNER_WIDTH,
    zIndex: 5,
  },
  bannerWipe: {
    backgroundColor: highlight,
    inset: 0,
    position: 'absolute',
  },
  bannerRow: {
    alignItems: 'center',
    display: 'flex',
    gap: 16,
    width: '100%',
  },
  bannerCopy: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  },
  bannerTitle: {
    color: ink,
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: -0.8,
    lineHeight: 1.05,
    whiteSpace: 'nowrap',
  },
  bannerNumber: {
    backgroundColor: highlight,
    color: '#000000',
    display: 'inline-block',
    fontVariantNumeric: 'tabular-nums',
    padding: '2px 8px 0',
  },
  bannerSub: {
    color: '#FFFFFFB3',
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: -0.4,
    lineHeight: 1.05,
    whiteSpace: 'nowrap',
  },
  flipStage: {
    flexShrink: 0,
    height: 66,
    perspective: 500,
    width: 128,
  },
  flipCard: {
    height: '100%',
    position: 'relative',
    transformStyle: 'preserve-3d',
    width: '100%',
  },
  cardFace: {
    alignItems: 'center',
    backfaceVisibility: 'hidden',
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
  },
  cardFront: {
    backgroundColor: '#FFFFFF',
  },
  cardBack: {
    backgroundColor: highlight,
    transform: 'rotateY(180deg)',
  },
  cardReading: {
    color: '#00000099',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1,
  },
  cardJapanese: {
    color: '#000000',
    fontSize: 30,
    fontWeight: 800,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  },
  cardKorean: {
    color: '#000000',
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: -0.6,
    lineHeight: 1.1,
    padding: '0 6px',
    textAlign: 'center',
    wordBreak: 'keep-all',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: app.primary,
    borderRadius: 16,
    display: 'flex',
    flexShrink: 0,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  ctaButton: {
    backgroundColor: highlight,
    borderRadius: 999,
    color: '#000000',
    flexShrink: 0,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: -0.5,
    padding: '14px 20px 11px',
    whiteSpace: 'nowrap',
  },
  profileCue: {
    alignItems: 'center',
    color: ink,
    display: 'flex',
    gap: 12,
    left: 74,
    position: 'absolute',
    top: PROFILE_CUE_TOP,
    zIndex: 4,
  },
  profileCueLabel: {
    ...outline(1.5),
    fontSize: 27,
    fontWeight: 800,
    textShadow: '2px 2px 0 #000000',
    letterSpacing: -0.6,
    lineHeight: 1,
  },
  content: {
    alignItems: 'center',
    // 아래쪽 경계는 Profile Cue(1576) 위 60px. 가사가 길어 내용이 이 띠보다 커지면
    // flex-end 라 위로 넘치므로 Cue 와 겹치지 않는다(스페이서가 0 으로 줄어든다).
    bottom: PROMO_HEIGHT - (PROFILE_CUE_TOP - 60),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    left: CONTENT_SIDE,
    position: 'absolute',
    right: CONTENT_SIDE,
    textAlign: 'center',
    top: CONTENT_TOP,
    zIndex: 4,
  },
  contentSpacer: {
    flex: '1 1 0',
    minHeight: 0,
    width: '100%',
  },
  lyricBlock: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  },
  // 토큰 칸을 한 줄로 깔고 LYRIC_WIDTH 를 넘을 때만 접는다.
  lyricRow: {
    alignItems: 'flex-end',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  // 어절 한 덩어리. 행보다 길 때만 안에서 꺾인다.
  lyricPhrase: {
    alignItems: 'flex-end',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    minWidth: 0,
  },
  token: {
    ...outline(1),
    fontWeight: 700,
    textShadow: '2px 2px 0 #000000',
    lineHeight: 1.2,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  korean: {
    ...outline(2),
    color: ink,
    fontSize: KOREAN_FONT_SIZE,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.25,
    margin: 0,
    textShadow: '3px 3px 0 #000000',
    // 한글은 기본 줄바꿈이 글자 단위라 단어가 쪼개진다. 어절(공백) 경계에서만 접는다.
    wordBreak: 'keep-all',
  },
  glossCell: {
    alignItems: 'center',
    display: 'inline-flex',
    flexDirection: 'column',
  },
  // 폭 0 의 가운데 정렬 트랙 — 원문보다 긴 뜻이 칸을 넓혀 앞뒤 글자 사이를 벌리지 않고 양옆으로 넘친다.
  glossTrack: {
    display: 'flex',
    justifyContent: 'center',
    width: 0,
  },
  gloss: {
    ...outline(0.75),
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    textShadow: '2px 2px 0 #000000',
    whiteSpace: 'nowrap',
  },

  // 아래 깔린 가사 화면(마지막 줄에서 멈춘 그림)을 그대로 블러해 배경으로 쓴다 — pen 의 Prev Frame + Blur Layer
  endCardLayer: {
    backgroundColor: '#11101266',
    overflow: 'hidden',
    zIndex: 10,
  },
  // overlay 렌더에선 빠지고 ffmpeg 이 같은 블러를 MV 합성 위에 건다. 두 쪽 반경을 같이 바꾼다.
  endCardBackdrop: {
    backdropFilter: 'blur(56px)',
    WebkitBackdropFilter: 'blur(56px)',
  },
  endWatermark: {
    color: '#FAFAF659',
    fontSize: 28,
    fontWeight: 500,
    position: 'absolute',
    right: 72,
    top: 110,
  },
  endTitleBlock: {
    left: 72,
    position: 'absolute',
    right: 72,
    top: 140,
  },
  // 예전엔 night 단색 블록이라 화면 아래에 검은 띠가 생겼다. 스토어 큐 가독성만 남기고 띠는 없앤다.
  // 폰 목업이 끝나는 1270 에서 시작한다 — 더 위에서 시작하면 폰 바닥이 그라데이션에 먹힌다.
  bottomScrim: {
    backgroundImage: `linear-gradient(180deg, ${night}00 0%, ${night}99 28%, ${night}D9 60%, ${night}F2 100%)`,
    bottom: 0,
    height: PROMO_HEIGHT - MOCKUP_BOTTOM,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  ctaBlock: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
    left: 60,
    position: 'absolute',
    right: 60,
    top: 1350,
  },
  searchCue: {
    alignItems: 'center',
    backgroundColor: paper,
    borderRadius: 10,
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

  phone: {
    backgroundColor: app.background,
    border: `4px solid ${night}`,
    borderRadius: 40,
    boxShadow: `18px 18px 0 ${night}`,
    color: app.textPrimary,
    fontFamily: appFontStack,
    height: PHONE_HEIGHT,
    left: 310,
    overflow: 'hidden',
    position: 'absolute',
    top: MOCKUP_BOTTOM - PHONE_HEIGHT,
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
    height: MOCK_HERO_HEIGHT,
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
  mockIconButton: {
    alignItems: 'center',
    backgroundColor: '#0000002E',
    borderRadius: 999,
    color: '#FFFFFF',
    display: 'flex',
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    top: 16,
    width: 48,
  },
  mockHeroInfo: {
    bottom: 31,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    left: 26,
    position: 'absolute',
    right: 26,
  },
  mockSongTitle: {
    color: '#FFFFFF',
    display: '-webkit-box',
    fontSize: 38,
    fontWeight: 800,
    lineHeight: 1.18,
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
  },
  mockSongArtist: {
    alignItems: 'center',
    color: '#FFFFFFCC',
    display: 'flex',
    fontSize: 19,
    fontWeight: 600,
    gap: 2,
    lineHeight: 1.2,
    marginBottom: 12,
  },
  mockDeckButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    border: '1px solid #FFFFFF33',
    borderRadius: 999,
    color: app.textPrimary,
    display: 'flex',
    fontSize: 18,
    fontWeight: 700,
    gap: 10,
    height: 58,
    justifyContent: 'center',
  },
  mockTabBar: {
    alignItems: 'stretch',
    backgroundColor: app.background,
    borderBottom: `1px solid ${app.border}`,
    display: 'flex',
    gap: 12,
    height: 53,
    paddingLeft: 19,
  },
  mockTab: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    position: 'relative',
    width: 65,
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
    left: 16,
    position: 'absolute',
    width: 34,
  },
  mockHome: {
    display: 'flex',
    flexDirection: 'column',
    gap: 29,
    padding: '24px 24px 0',
  },
  mockDot: {
    borderRadius: 999,
    display: 'block',
    flexShrink: 0,
    height: 8,
    width: 8,
  },
  coverage: {
    display: 'flex',
    flexDirection: 'column',
    gap: 19,
  },
  coverageHead: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  coverageMeta: {
    alignItems: 'center',
    color: app.textMuted,
    display: 'flex',
    fontSize: 16,
    fontWeight: 600,
    justifyContent: 'space-between',
  },
  coverageStatement: {
    color: app.textPrimary,
    display: 'flex',
    fontSize: 34,
    fontWeight: 700,
    lineHeight: '43px',
  },
  coverageMeter: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  coverageTrack: {
    backgroundColor: app.coverageTrack,
    borderRadius: 999,
    height: 14,
  },
  coverageCounts: {
    alignItems: 'center',
    display: 'flex',
    gap: 7,
  },
  coverageCountLabel: {
    color: app.textMuted,
    fontSize: 14,
  },
  coverageCountValue: {
    color: app.textPrimary,
    fontSize: 16,
    fontWeight: 700,
  },
  tierSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 17,
  },
  tierSectionTitle: {
    color: app.textPrimary,
    fontSize: 23,
    fontWeight: 700,
  },
  tierStep: {
    display: 'flex',
    gap: 17,
  },
  tierRail: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    width: 31,
  },
  tierConnector: {
    backgroundColor: app.border,
    flex: 1,
    width: 2,
  },
  tierDotCurrent: {
    alignItems: 'center',
    backgroundColor: app.background,
    border: `4px solid ${app.primary}`,
    borderRadius: 999,
    boxShadow: `0 0 10px ${app.primary}40`,
    boxSizing: 'border-box',
    display: 'flex',
    flexShrink: 0,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  tierDotCurrentCore: {
    backgroundColor: app.primary,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  tierDotTodo: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  tierDotTodoCore: {
    backgroundColor: app.memoryRemaining,
    borderRadius: 999,
    height: 13,
    width: 13,
  },
  tierBody: {
    flex: 1,
    minWidth: 0,
  },
  tierCardExpanded: {
    border: `2px solid ${app.primary}`,
    borderRadius: 19,
    boxShadow: `0 7px 22px ${app.primary}26`,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 19,
  },
  tierIntro: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  tierExpandedTitle: {
    color: app.textPrimary,
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  tierExpandedDesc: {
    color: app.textMuted,
    fontSize: 15,
    lineHeight: '22px',
  },
  tierProgress: {
    display: 'flex',
    flexDirection: 'column',
    gap: 11,
  },
  tierTrack: {
    backgroundColor: app.tierTrack,
    borderRadius: 999,
  },
  tierStats: {
    alignItems: 'center',
    display: 'flex',
    gap: 14,
  },
  tierStat: {
    alignItems: 'center',
    display: 'flex',
    gap: 6,
  },
  tierStatLabel: {
    color: app.textMuted,
    fontSize: 14,
  },
  tierStatValue: {
    fontSize: 14,
    fontWeight: 500,
  },
  tierCta: {
    alignItems: 'center',
    backgroundColor: app.primary,
    borderRadius: 14,
    boxShadow: `0 4px 10px ${app.primary}40`,
    display: 'flex',
    gap: 10,
    height: 72,
    justifyContent: 'space-between',
    padding: '0 19px 0 22px',
  },
  tierCtaCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  tierCtaLabel: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  tierCtaTime: {
    alignItems: 'center',
    color: '#FFFFFFC4',
    display: 'flex',
    fontSize: 14,
    fontWeight: 600,
    gap: 5,
  },
  // SongDetailDueWordRoller — 지금 단어를 가운데 두고 다음 단어가 아래로 흐리게 비친다.
  tierRoller: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height: 46,
    overflow: 'hidden',
    paddingTop: 11,
    width: 77,
  },
  tierRollerWord: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 600,
    lineHeight: '24px',
    whiteSpace: 'nowrap',
  },
  tierCardCollapsed: {
    border: `1px solid ${app.border}`,
    borderRadius: 19,
    display: 'flex',
    flexDirection: 'column',
    gap: 11,
    padding: 17,
  },
  tierCollapsedTitle: {
    color: app.textPrimary,
    fontSize: 19,
    fontWeight: 700,
  },
  tierCollapsedDesc: {
    color: app.textSecondary,
    fontSize: 15,
    lineHeight: '22px',
  },

  sheet: {
    backgroundColor: app.background,
    borderRadius: '29px 29px 0 0',
    boxShadow: '0 -2px 17px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    width: PHONE_WIDTH,
  },
  mvBar: {
    alignItems: 'center',
    borderTop: `1px solid ${app.border}`,
    borderRadius: '29px 29px 0 0',
    boxSizing: 'border-box',
    display: 'flex',
    flexShrink: 0,
    gap: 14,
    height: MV_BAR_HEIGHT,
    padding: '0 19px',
  },
  mvThumb: {
    backgroundColor: '#111111',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    border: '1px solid #FFFFFF33',
    borderRadius: 10,
    flexShrink: 0,
    height: 36,
    width: 72,
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
    fontSize: 16,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mvArtist: {
    color: app.textSecondary,
    fontSize: 13,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dial: {
    flex: 1,
    marginTop: DIAL_TOP_PADDING,
    overflow: 'hidden',
    position: 'relative',
  },
  dialAnchor: {
    left: 0,
    position: 'absolute',
    right: 0,
    transform: 'translateY(-50%)',
  },
  dialRest: {
    display: 'flex',
    flexDirection: 'column',
    gap: DIAL_LINE_GAP,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  dialRestLine: {
    color: app.textPrimary,
    fontSize: 22,
    lineHeight: '31px',
    padding: '14px 24px',
  },
  focusBand: {
    backgroundColor: app.surfaceSubtle,
    display: 'flex',
    flexDirection: 'column',
    gap: 17,
    padding: 24,
  },
  focusTokens: {
    alignItems: 'flex-end',
    columnGap: 2,
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: 14,
  },
  focusCell: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    position: 'relative',
  },
  focusFurigana: {
    color: app.textSecondary,
    fontSize: 11,
    lineHeight: '12px',
    whiteSpace: 'pre',
  },
  focusToken: {
    color: app.textPrimary,
    fontSize: 26,
    fontWeight: 600,
    lineHeight: '34px',
    whiteSpace: 'pre',
  },
  focusBar: {
    alignSelf: 'stretch',
    borderRadius: 2,
    height: 3,
  },
  focusMeaning: {
    fontSize: 13,
    lineHeight: '17px',
    marginTop: 2,
    whiteSpace: 'pre',
  },
  focusLineMeaning: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  focusPronunciation: {
    color: app.textSecondary,
    fontSize: 16,
    letterSpacing: 0.2,
    lineHeight: '22px',
  },
  focusKorean: {
    color: app.textPrimary,
    fontSize: 19,
    fontWeight: 500,
    lineHeight: '26px',
    wordBreak: 'keep-all',
  },
  // 가사가 아래 pill 밑으로 흘러가는 걸 가리는 흰 그라데이션
  sheetBottomFade: {
    background: 'linear-gradient(180deg, #FFFFFF00 0%, #FFFFFFD9 50%, #FFFFFF 100%)',
    bottom: 0,
    height: 173,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  syncPill: {
    alignItems: 'center',
    backgroundColor: app.primaryBg,
    border: `1px solid ${app.primary}`,
    borderRadius: 999,
    bottom: 34,
    color: app.primary,
    display: 'flex',
    fontSize: 16,
    fontWeight: 500,
    gap: 7,
    left: '50%',
    padding: '11px 18px',
    position: 'absolute',
    transform: 'translateX(-50%)',
  },
  tapDot: {
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 999,
    height: 48,
    position: 'absolute',
    width: 48,
    zIndex: 5,
  },
  tapDotCentered: {
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderRadius: 999,
    height: 48,
    left: '50%',
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 48,
  },

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
    height: 62,
    justifyContent: 'space-between',
    padding: '0 19px',
  },
  reviewBackButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderRadius: 999,
    color: '#FFFFFF',
    display: 'flex',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  reviewCounter: {
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderRadius: 999,
    color: 'rgba(255,255,255,0.90)',
    fontSize: 16,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    padding: '8px 14px',
  },
  reviewProgressTrack: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: 999,
    height: 5,
    margin: '12px 19px 0',
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
    left: REVIEW_SIDE,
    position: 'absolute',
    right: REVIEW_SIDE,
    top: REVIEW_CONTENT_TOP,
  },
  reviewSourceRow: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: 12,
    height: 48,
  },
  reviewThumb: {
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    flexShrink: 0,
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
    fontSize: 17,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  reviewFace: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
  },
  reviewFrontCenter: {
    alignItems: 'flex-start',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  reviewFrontHeadword: {
    color: '#FFFFFF',
    fontSize: 74,
    fontWeight: 700,
    lineHeight: 1.1,
    transformOrigin: 'left center',
    whiteSpace: 'nowrap',
  },
  // 앞면 안내 + pill 과 뒷면 질문 + rating 줄이 같은 높이라, pill 이 그 자리에서 rating 넷으로 갈라진다.
  reviewBottomBlock: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: 14,
    paddingBottom: 5,
  },
  reviewPrompt: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 15,
    fontWeight: 500,
    lineHeight: '20px',
    textShadow: '0 1px 8px rgba(0,0,0,0.25)',
  },
  reviewPillSlot: {
    height: PILL_HEIGHT,
    position: 'relative',
    width: '100%',
  },
  glassFill: {
    backgroundColor: GLASS_FILL,
    borderRadius: 999,
    boxShadow: '0 5px 19px rgba(0,0,0,0.3)',
    inset: 0,
    position: 'absolute',
  },
  glassBorder: {
    border: '1px solid rgba(255,255,255,0.24)',
    borderRadius: 999,
    inset: 0,
    position: 'absolute',
  },
  glassRest: {
    border: '1px solid rgba(255,255,255,0.24)',
    boxSizing: 'border-box',
  },
  revealPillContent: {
    alignItems: 'center',
    color: '#FFFFFF',
    display: 'flex',
    fontSize: 18,
    fontWeight: 700,
    gap: 10,
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
  },
  reviewBack: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    paddingTop: 80,
  },
  reviewBackCenter: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 30,
    justifyContent: 'center',
  },
  reviewQuestion: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  reviewBackHeadword: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: 700,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  },
  reviewReadingRow: {
    alignItems: 'center',
    display: 'flex',
    gap: 9,
  },
  reviewReading: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 18,
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
    gap: 19,
  },
  reviewMeaningRow: {
    alignItems: 'baseline',
    display: 'flex',
    gap: 14,
  },
  reviewMeaning: {
    color: '#FFFFFF',
    fontSize: 31,
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
    gap: 7,
  },
  reviewExampleSourceTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: 600,
    maxWidth: 192,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  reviewExampleJp: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 18,
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
  ratingLayer: {
    inset: 0,
    position: 'absolute',
  },
  // 갈라지는 조각. 불투명 흰색이고 알파는 감싼 그룹이 입힌다.
  ratingShape: {
    backgroundColor: '#FFFFFF',
    borderRadius: PILL_CAP,
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  ratingButton: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: RATING_WIDTH,
  },
  ratingContent: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    fontWeight: 600,
    gap: 2,
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
  },
  ratingLabel: {
    fontSize: 17,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  },
  ratingInterval: {
    fontSize: 13,
    lineHeight: 1.1,
  },
  holdPill: {
    alignItems: 'center',
    borderRadius: 999,
    color: '#FFFFFF',
    display: 'flex',
    fontSize: 18,
    fontWeight: 700,
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
  },
} satisfies Record<string, CSSProperties>;
