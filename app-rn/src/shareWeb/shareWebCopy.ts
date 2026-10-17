import type { SharedRewardCardDto } from '../types/rewardCard';
import { ARTIST_GRADE_STEPS } from '../components/rewardCards/artistGrade';
import { SONG_CARD_KINDS, songTierName } from '../components/rewardCards/cardKinds';
import type { LadderStep } from '../components/rewardCards/cardLadders';
import { artistGradeIndex, songGradeOf } from '../components/rewardCards/serverRewardCards';

// 이 화면을 보는 사람은 앱을 모른다. 앱 안의 단계 이름('후렴 정복' 등) 대신 무엇을 공부했는지로 말한다.

export interface ShareCelebration {
  /** 승급 계단 자리. */
  rung: number;
  grade: string;
  headline: string;
  /** 이 카드를 받으려면 무엇을 해야 하는지. 처음 보는 사람에게 카드의 무게를 알린다. */
  meaning: string;
  /** 같은 카드를 받은 사람 중 몇 번째인지. */
  rank: string;
}

/** 곡 카드 레벨 1~3 은 곡 상세 단계(후렴 정복 → 따라 부르기 → 완곡) 순서다. */
const SONG_TIER_MEANING = [
  '이 노래 가사 속 일본어 단어를 처음 공부하면 받는 카드예요',
  '이 노래 후렴에 나오는 단어를 모두 공부해야 받는 카드예요',
  '이 노래를 따라 부를 수 있을 만큼, 자주 나오는 단어까지 모두 공부해야 받는 카드예요',
  '이 노래 가사의 단어를 처음부터 끝까지 모두 공부해야 받는 카드예요',
];
const SONG_TIER_CAPTION = ['첫 공부', '후렴 단어', '자주 나오는 단어', '가사 전부'];

const nth = (n: number) => `${n.toLocaleString('ko-KR')}번째`;

export function shareCelebration(shared: SharedRewardCardDto): ShareCelebration | null {
  const song = shared.songCard;
  if (song) {
    const { level, mastered } = songGradeOf(song.grade);
    const rung = mastered ? 4 : level;
    const grade = songTierName(level, mastered);
    return {
      rung,
      grade,
      headline: rung === 0 ? '곡 카드를 얻었어요' : `${grade} 카드를 얻었어요`,
      meaning: mastered
        ? `이 노래 단어의 ${shared.songGradeRule.masterPercent}%를 몇 주 동안 복습해서 완전히 외워야 받는 마지막 카드예요`
        : SONG_TIER_MEANING[level],
      rank: `이 노래로 ${rung === 0 ? '카드' : `${grade} 카드`}를 받은 ${nth(song.acquiredSeq)} 사람`,
    };
  }
  const artist = shared.artistCard;
  if (!artist) return null;
  const rung = artistGradeIndex(artist.grade);
  const step = ARTIST_GRADE_STEPS[rung];
  return {
    rung,
    grade: step.label,
    headline: rung === 0 ? '아티스트 카드를 얻었어요' : `${step.label} 카드를 얻었어요`,
    meaning:
      rung === 0
        ? `${artist.name} 노래로 일본어 공부를 시작하면 받는 카드예요`
        : `${artist.name} 노래 ${step.from}곡의 가사 단어를 완전히 외워야 받는 카드예요`,
    rank:
      artist.fanNo != null
        ? `${artist.name} 카드를 받은 ${nth(artist.fanNo)} 팬`
        : `${artist.name} 카드를 받은 ${nth(artist.acquiredSeq)} 사람`,
  };
}

/** 등급 이름은 그대로, 조건만 앱을 몰라도 읽히게 적은 승급 계단. */
export function shareLadder(shared: SharedRewardCardDto): LadderStep[] {
  if (shared.songCard) {
    const percent = shared.songGradeRule.masterPercent;
    return SONG_CARD_KINDS.map((kind) => ({
      label: songTierName(kind.level, kind.mastered),
      caption: kind.mastered ? `${percent}% 외우기` : SONG_TIER_CAPTION[kind.level],
    }));
  }
  return ARTIST_GRADE_STEPS.map((s) => ({ label: s.label, caption: s.from === 0 ? '첫 공부' : `${s.from}곡 외우기` }));
}

export function sharePitch(kind: SharedRewardCardDto['kind']): string {
  return kind === 'SONG'
    ? '좋아하는 일본 노래 가사로 단어를 공부하면\n공부한 만큼 그 노래의 카드가 생겨요'
    : '좋아하는 아티스트 노래로 일본어를 공부하면\n외운 곡이 늘수록 카드 등급이 올라가요';
}
