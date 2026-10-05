import { Colors } from '../../theme/theme';

/**
 * 연속 학습 화면 전용 색. 앱 공통 의미가 없는 값(크림 히어로, 주황 ramp)은 theme 에 올리지 않고
 * 여기 모아둔다. 잔디(학습량)와 프리즈는 프로필 히트맵과 같은 토큰을 쓴다.
 */
export const StreakPalette = {
  heroBg: '#FFF6EA',
  heroGlow: '#FFCF8F',
  heroNum: '#EF6C00',
  heroNumLabel: '#C2410C',
  /** 솟는 불씨 — 크림 배경 위라 축하 화면보다 묽게 쓴다. */
  heroEmber: '#F59E0B',
  /** ST2 의 식은 불꽃. 3겹 형태는 그대로 두고 색만 식힌다. */
  heroFlameDim: ['#CFC0AC', '#DCD0BF', '#EFE7DA'] as const,

  chipBorder: '#F2DCC0',
  chipIcon: '#EA6C00',
  chipText: '#B45309',

  /** 현재 연속 구간 띠. */
  runBand: '#FFE4C9',
  /** 띠 안의 칩 — 학습량 강도별. */
  runRamp: ['#FDBA74', '#FB923C', '#F97316', '#C2410C'] as const,
  runInk: '#5C1F0A',
  /** 가장 진한 칸은 글자를 뒤집는다. */
  runInkOn: '#FFFFFF',

  /** 잔디 칩 글자. */
  grassInk: '#123826',
  grassInkOn: '#FFFFFF',
  freezeInk: '#1D4ED8',
  futureInk: '#D9D9D9',
} as const;

/** ST3 — 주황을 전부 파랑으로 치환한 히어로. 달력(기록)은 주황 그대로 둔다. */
export const FrozenPalette = {
  heroBg: '#EFF5FF',
  heroGlow: '#9EC6FF',
  heroNum: '#1D4ED8',
  heroNumLabel: '#1E40AF',
  heroIcon: '#5B9BF8',

  chipBorder: '#C7DCFA',
  chipIcon: Colors.freezeStroke,
  chipText: '#1D4ED8',
} as const;

/** 홈 헤더 칩 — ST 히어로와 같은 상태 3종을 16px 칩 크기에 맞춘 값. */
export const HomeChipPalette = {
  done: { bg: Colors.streakPillBg, icon: Colors.streakFlame, ink: Colors.streakPillText },
  /** 칩도 불꽃도 같이 식히고 글자만 주황으로 남긴다 — 기록은 살아 있다. */
  pending: { bg: Colors.card, icon: '#ADA7A0', ink: Colors.streakPillText },
  frozen: { bg: FrozenPalette.heroBg, icon: FrozenPalette.chipIcon, ink: FrozenPalette.chipText },
} as const;

/**
 * 연속 학습 축하 전체 화면. 리뷰 몰입 화면 위에 덮이는 어두운 ember 톤이라 Streak 화면의
 * 크림 팔레트와는 반대편이다 — 불꽃만 밝고 나머지는 전부 가라앉힌다.
 */
export const CelebrationPalette = {
  bgTop: '#3B1407',
  bgMid: '#1A0C09',
  bgBottom: '#0B0708',
  bgGlow: '#FF7A00',
  /** 어제가 프리즈였을 때 점화 전까지 덮여 있는 얼어붙은 배경. */
  coldTop: '#0E2A4F',
  coldMid: '#0A1628',
  coldBottom: '#05080F',
  coldGlow: '#3D8BFF',

  /** 아직 꺼진 불. */
  flameOff: 'rgba(255,255,255,0.18)',
  /** 어제 프리즈였을 때 꺼진 불 대신 나오는 눈 결정. */
  iceInk: '#A9D3FF',
  /** 바깥에서 안으로 갈수록 뜨거워지는 3겹. */
  flameOuter: '#FF4D12',
  flameMid: '#FF9500',
  flameCore: '#FFF0B8',
  /** 불꽃 주변 빛무리. */
  glowCore: '#FFA42A',
  spark: '#FFE9A3',
  /** 불길이 치솟는 순간 화면 전체를 덮는 섬광. */
  flash: '#FFE3B3',

  countShadow: 'rgba(255,138,0,0.45)',
  unit: '#FFC489',
  sub: 'rgba(255,255,255,0.65)',

  cardBg: 'rgba(255,255,255,0.055)',
  cardBorder: 'rgba(255,255,255,0.12)',
  slotLabel: 'rgba(255,255,255,0.5)',
  slotLabelToday: '#FFB15C',

  studiedBg: '#F97316',
  studiedInk: '#FFE6C7',
  freezeBg: '#163B63',
  freezeBorder: 'rgba(61,139,255,0.45)',
  freezeInk: '#8FC6FF',
  noneBg: 'rgba(255,255,255,0.04)',
  noneBorder: 'rgba(255,255,255,0.15)',

  todayTop: '#FFD15C',
  todayMid: '#FF8A00',
  todayBottom: '#FF5A1F',
  todayBorder: 'rgba(255,255,255,0.4)',
  todayGlow: '#FF8A00',

  /** 배경이 전부 따뜻한 어둠이라 CTA 는 초록 대신 크림으로 띄운다. */
  ctaBg: '#FFF6EB',
  ctaInk: '#2B1206',
  ctaGlow: '#FFAE66',
} as const;
