export const Colors = {
  primary: '#16B364',
  primaryBg: '#16B36420',
  primaryShadow: '#16B36440',
  accentSecondary: '#FFB300',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  card: '#EEEEEE',
  elevated: '#EEEEEE',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#888888',
  border: '#E5E5E5',
  /** 카드보다 한 단계 옅은 바탕 — 가사 다이얼의 포커스 띠 등. */
  surfaceSubtle: '#F6F6F6',
  overlay: '#00000044',
  accentRed: '#EF4444',

  ratingAgain: '#EF4444',
  ratingAgainBg: '#FEF2F2',
  ratingHard: '#F97316',
  ratingHardBg: '#FFF7ED',
  ratingGood: '#16B364',
  ratingGoodBg: '#E8F8EF',
  ratingEasy: '#3B82F6',
  ratingEasyBg: '#EFF6FF',

  stateLearning: '#6366F1',
  stateLearningBg: '#EEF2FF',
  stateReview: '#16B364',
  stateReviewBg: '#16B36420',
  stateRelearning: '#FBBF24',
  stateRelearningBg: '#FFFBEB',
  stateRetrievability: '#6ADBA0',
  stateRetrievabilityBg: '#6ADBA020',

  jlptN1: '#E85E56',
  jlptN2: '#D57031',
  jlptN3: '#AD861D',
  jlptN4: '#2A9B8D',
  jlptN5: '#5388F3',

  posNoun: '#368EE8',
  posVerb: '#299E67',
  posAdjective: '#C47B1D',
  posAdverb: '#A276E0',
  posParticle: '#EB5587',

  // Streak / study stats
  streakFlame: '#FF9500',
  heatmapIntensities: ['#EEEEEE', '#C9F0DB', '#8CE1B4', '#3CC784', '#107A45'] as const,
  freezeFill: '#E8F0F9',
  freezeStroke: '#5B9BF5',

  // 이해도 (가사 줄 기준) / 기억 칸 진행 바 — 곡 상세·프로필·단어장이 같은 색을 쓴다
  coverageAccent: '#E5A100',
  coverageTrack: '#F4EEDF',
  /** 장기기억 — 7일 뒤 90% 이상 회상. primary 와 같은 초록. */
  memoryLongTerm: '#16B364',
  /** 단기기억 — 한 번이라도 학습한 단어. */
  memoryShortTerm: '#22B8CF',
  /** 남음 — 한 번도 학습하지 않은 단어. */
  memoryRemaining: '#D2D2D2',
  tierTrack: '#EEEEEE',


  // Legacy aliases
  textTertiary: '#A1A1AA',
  cardBorder: '#E5E5E5',
};

export const Dimens = {
  screenPadding: 16,
  cardCornerRadius: 16,
  smallCornerRadius: 12,
  artworkCornerRadius: 12,
  bottomBarHeight: 56,
};
