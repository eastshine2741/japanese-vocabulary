import { describe, expect, it } from 'vitest';
import type { ArtistCardDto, SharedRewardCardDto, SongCardDto } from '../types/rewardCard';
import { shareCelebration, shareLadder } from './shareWebCopy';

const rule = { tierNames: ['후렴 정복', '따라 부르기', '완곡'], masterPercent: 90 };

function songShared(grade: SongCardDto['grade'], acquiredSeq = 12): SharedRewardCardDto {
  return {
    token: 't',
    url: 'u',
    kind: 'SONG',
    songCard: { grade, acquiredSeq } as SongCardDto,
    artistCard: null,
    owner: { name: '하루', profileImageUrl: null },
    songGradeRule: rule,
  };
}

function artistShared(grade: ArtistCardDto['grade'], fanNo: number | null): SharedRewardCardDto {
  return {
    ...songShared('BASIC'),
    kind: 'ARTIST',
    songCard: null,
    artistCard: { name: 'YOASOBI', grade, fanNo, acquiredSeq: 3 } as ArtistCardDto,
  };
}

describe('shareCelebration', () => {
  it('곡 카드는 앱 단계 이름 없이 무엇을 공부했는지와 등급별 순번을 말한다', () => {
    const c = shareCelebration(songShared('SILVER', 1234))!;
    expect(c.rung).toBe(2);
    expect(c.headline).toBe('SILVER 카드를 얻었어요');
    expect(c.meaning).not.toContain("'");
    expect(c.rank).toBe('이 노래로 SILVER 카드를 받은 1,234번째 사람');
  });

  it('기본 곡 카드와 마스터 카드', () => {
    expect(shareCelebration(songShared('BASIC'))!.headline).toBe('곡 카드를 얻었어요');
    const master = shareCelebration(songShared('MASTER'))!;
    expect(master.rung).toBe(4);
    expect(master.meaning).toContain('90%');
  });

  it('아티스트 카드는 외운 곡 수 조건과 팬 순번을 말한다', () => {
    const c = shareCelebration(artistShared('GOLD', 7))!;
    expect(c.rung).toBe(3);
    expect(c.meaning).toBe('YOASOBI 노래 7곡의 가사 단어를 완전히 외워야 받는 카드예요');
    expect(c.rank).toBe('YOASOBI 카드를 받은 7번째 팬');
    expect(shareCelebration(artistShared('BASIC', null))!.rank).toBe('YOASOBI 카드를 받은 3번째 사람');
  });

  it('계단 조건에 앱 단계 이름을 쓰지 않는다', () => {
    const captions = shareLadder(songShared('GOLD')).map((s) => s.caption);
    expect(captions).toEqual(['첫 공부', '후렴 단어', '자주 나오는 단어', '가사 전부', '90% 외우기']);
    expect(shareLadder(artistShared('GOLD', 1)).map((s) => s.caption)[3]).toBe('7곡 외우기');
  });
});
