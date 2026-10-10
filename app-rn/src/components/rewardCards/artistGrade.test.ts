import { describe, expect, it } from 'vitest';
import { artistGradeStep, nextArtistGradeStep, setlistWindow } from './artistGrade';

describe('artistGradeStep', () => {
  it('마스터 곡이 없으면 종이 카드다', () => {
    expect(artistGradeStep(0).grade).toBe('paper');
  });

  it('구간 경계에 닿는 순간 재질이 바뀐다', () => {
    expect(artistGradeStep(1).grade).toBe('bronze');
    expect(artistGradeStep(2).grade).toBe('bronze');
    expect(artistGradeStep(3).grade).toBe('silver');
    expect(artistGradeStep(7).grade).toBe('gold');
    expect(artistGradeStep(15).grade).toBe('platinum');
    expect(artistGradeStep(30).grade).toBe('diamond');
  });

  it('최고 재질 뒤에도 곡 수는 계속 오르고 재질은 그대로다', () => {
    expect(artistGradeStep(120).grade).toBe('diamond');
  });
});

describe('nextArtistGradeStep', () => {
  it('다음 재질과 그 경계를 돌려준다', () => {
    expect(nextArtistGradeStep(5)).toMatchObject({ grade: 'gold', from: 7 });
  });

  it('최고 재질이면 다음이 없다', () => {
    expect(nextArtistGradeStep(30)).toBeNull();
  });
});

describe('setlistWindow', () => {
  it('다 들어가면 첫 곡부터 적는다', () => {
    expect(setlistWindow(8, 14)).toEqual({ start: 0, hidden: 0 });
  });

  it('넘치면 오래된 곡을 숨기고 최근 곡을 남긴다', () => {
    expect(setlistWindow(31, 14)).toEqual({ start: 17, hidden: 17 });
  });
});
