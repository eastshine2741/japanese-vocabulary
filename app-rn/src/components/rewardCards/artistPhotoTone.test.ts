import { describe, expect, it } from 'vitest';
import { ARTIST_GRADE_STEPS } from './artistGrade';
import { ARTIST_PHOTO_TONE, applyColorMatrix } from './artistPhotoTone';

const tones = ARTIST_GRADE_STEPS.map((s) => ARTIST_PHOTO_TONE[s.grade]);
const level = (m: readonly number[], v: number) => applyColorMatrix(m, [v, v, v])[0];

describe('ARTIST_PHOTO_TONE', () => {
  it('어느 재질도 사진 색조를 바꾸지 않는다', () => {
    for (const m of tones) {
      for (const v of [0.2, 0.5, 0.8]) {
        const [r, g, b] = applyColorMatrix(m, [v, v, v]);
        expect(r).toBeCloseTo(g);
        expect(g).toBeCloseTo(b);
      }
    }
  });

  it('재질이 오를수록 대비가 깊어진다', () => {
    const range = tones.map((m) => level(m, 1) - level(m, 0));
    range.slice(1).forEach((v, i) => expect(v).toBeGreaterThan(range[i]));
  });

  it('종이는 무광 인화처럼 검정이 뜬다', () => {
    expect(level(ARTIST_PHOTO_TONE.paper, 0)).toBeGreaterThan(0);
  });
});
