import { describe, expect, it } from 'vitest';
import type { ArtistCardDto, SharedRewardCardDto, SongCardDto } from '../types/rewardCard';
import { fanLine, rankLine, shareCelebration, shareLadder } from './shareWebCopy';

const rule = { tierNames: ['후렴 정복', '따라 부르기', '완곡'], masterPercent: 90 };

function songShared(grade: SongCardDto['grade'], acquiredSeq = 12): SharedRewardCardDto {
  return {
    token: 't',
    url: 'u',
    kind: 'SONG',
    songCard: { title: 'アイドル (feat. X)', grade, acquiredSeq } as SongCardDto,
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
    artistCard: { name: 'YOASOBI', grade, fanNo } as ArtistCardDto,
  };
}

describe('rankLine', () => {
  it('첫 번째는 처음으로, 나머지는 천 단위 쉼표로 말한다', () => {
    expect(rankLine(1)).toEqual({ lead: '모든 사용자 중 ', no: '처음', rest: '으로 얻은 카드예요' });
    expect(rankLine(1234)).toEqual({ lead: '모든 사용자 중 ', no: '1,234번째', rest: '로 얻은 카드예요' });
  });
});

describe('shareCelebration', () => {
  it('곡 카드는 등급 이름 없이 곡 이름으로 축하하고 무엇을 공부했는지 말한다', () => {
    const c = shareCelebration(songShared('SILVER'))!;
    expect(c.rung).toBe(2);
    expect(c.subject).toBe('「アイドル」');
    expect(c.headline).toBe('곡 카드를 얻었어요');
    expect(c.meaning).not.toContain("'");
    expect(c.meaning).not.toContain('SILVER');
  });

  it('마스터 카드', () => {
    const master = shareCelebration(songShared('MASTER'))!;
    expect(master.rung).toBe(4);
    expect(master.meaning).toContain('90%');
  });

  it('아티스트 카드는 아티스트 이름으로 축하하고 외운 곡 수 조건을 말한다', () => {
    const c = shareCelebration(artistShared('GOLD', 7))!;
    expect(c.rung).toBe(3);
    expect(c.subject).toBe('「YOASOBI」');
    expect(c.headline).toBe('아티스트 카드를 얻었어요');
    expect(c.meaning).toBe('YOASOBI 노래 7곡의 가사 단어를\n완전히 외워야 받는 카드예요');
    expect(c.rank).toEqual(fanLine(7));
    expect(fanLine(1234)).toEqual({ no: '1,234번째', rest: ' 팬이에요' });
  });

  it('기본 아티스트 카드는 팬 번호가 없어 순번 줄도 없다', () => {
    expect(shareCelebration(artistShared('BASIC', null))!.rank).toBeNull();
  });

  it('계단 조건에 앱 단계 이름을 쓰지 않는다', () => {
    const captions = shareLadder(songShared('GOLD')).map((s) => s.caption);
    expect(captions).toEqual(['첫 공부', '후렴 단어', '자주 나오는 단어', '가사 전부', '90% 외우기']);
    expect(shareLadder(artistShared('GOLD', 1)).map((s) => s.caption)[3]).toBe('7곡 외우기');
  });
});
