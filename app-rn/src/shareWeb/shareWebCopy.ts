import type { SharedRewardCardDto } from '../types/rewardCard';
import { ARTIST_GRADE_STEPS } from '../components/rewardCards/artistGrade';
import { cardArtist, cardTitle } from '../components/rewardCards/cardCredit';
import { SONG_CARD_KINDS, songTierName } from '../components/rewardCards/cardKinds';
import type { LadderStep } from '../components/rewardCards/cardLadders';
import { artistGradeIndex, songGradeOf } from '../components/rewardCards/serverRewardCards';

// 이 화면을 보는 사람은 앱을 모른다. 앱 안의 단계·등급 이름 대신 무엇을 공부했는지로 말한다.
// 줄마다 한 줄로 맞춰 그리므로 긴 문장은 \n 으로 미리 나눈다.

export interface ShareCelebration {
  /** 승급 계단 자리. */
  rung: number;
  /** 「곡명」 또는 「아티스트」. 길이가 제각각이라 헤드라인과 줄을 나눈다. */
  subject: string;
  headline: string;
  /** 이 카드를 받으려면 무엇을 해야 하는지. 처음 보는 사람에게 카드의 무게를 알린다. */
  meaning: string;
  /** 순번 축하 한 줄. 카드에도 찍히지만 처음 보는 사람에겐 말로 축하한다. 기본 아티스트 카드는 팬 번호가 없어 null. */
  rank: RankLine | null;
}

/** 숫자만 따로 강조하도록 둘로 나눈다. */
export interface RankLine {
  /** 숫자 앞 말. 곡 카드 순번은 무엇 중 몇 번째인지 밝혀야 '내가 얻은 몇 번째 카드'로 읽히지 않는다. */
  lead?: string;
  no: string;
  rest: string;
}

/** 곡 카드: 같은 카드를 얻은 사람 중 몇 번째인지. */
export function rankLine(no: number): RankLine {
  const lead = '모든 사용자 중 ';
  return no === 1
    ? { lead, no: '처음', rest: '으로 얻은 카드예요' }
    : { lead, no: `${no.toLocaleString('ko-KR')}번째`, rest: '로 얻은 카드예요' };
}

/** 아티스트 카드: 몇 번째 팬인지. */
export function fanLine(no: number): RankLine {
  return { no: `${no.toLocaleString('ko-KR')}번째`, rest: ' 팬이에요' };
}

/** 곡 카드 레벨 1~3 은 곡 상세 단계(후렴 정복 → 따라 부르기 → 완곡) 순서다. */
const SONG_TIER_MEANING = [
  '이 노래 가사 속 일본어 단어를\n처음 공부하면 받는 카드예요',
  '이 노래 후렴에 나오는 단어를\n모두 공부해야 받는 카드예요',
  '이 노래에 자주 나오는 단어까지\n모두 공부해야 받는 카드예요',
  '이 노래 가사의 단어를\n처음부터 끝까지 공부해야 받는 카드예요',
];
const SONG_TIER_CAPTION = ['첫 공부', '후렴 단어', '자주 나오는 단어', '가사 전부'];

export function shareCelebration(shared: SharedRewardCardDto): ShareCelebration | null {
  const song = shared.songCard;
  if (song) {
    const { level, mastered } = songGradeOf(song.grade);
    const rung = mastered ? 4 : level;
    return {
      rung,
      subject: `「${cardTitle(song.title)}」`,
      headline: '곡 카드를 얻었어요',
      meaning: mastered
        ? `이 노래 단어의 ${shared.songGradeRule.masterPercent}%를 몇 주 동안\n복습해 완전히 외워야 받는 마지막 카드예요`
        : SONG_TIER_MEANING[level],
      rank: rankLine(song.acquiredSeq),
    };
  }
  const artist = shared.artistCard;
  if (!artist) return null;
  const rung = artistGradeIndex(artist.grade);
  const step = ARTIST_GRADE_STEPS[rung];
  const name = cardArtist(artist.name);
  return {
    rung,
    subject: `「${name}」`,
    headline: '아티스트 카드를 얻었어요',
    meaning:
      rung === 0
        ? `${name} 노래로\n일본어 공부를 시작하면 받는 카드예요`
        : `${name} 노래 ${step.from}곡의 가사 단어를\n완전히 외워야 받는 카드예요`,
    rank: artist.fanNo == null ? null : fanLine(artist.fanNo),
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
