import { describe, expect, it } from 'vitest';
import { formatInterval, holdLabel } from './intervalLabel';

describe('formatInterval', () => {
  it('서버 단위 문자를 한국어 단위로 바꾼다', () => {
    expect(formatInterval('1m')).toBe('1분');
    expect(formatInterval('45m')).toBe('45분');
    expect(formatInterval('3h')).toBe('3시간');
    expect(formatInterval('1d')).toBe('1일');
    expect(formatInterval('120d')).toBe('120일');
  });

  it('모르는 형식은 그대로 둔다', () => {
    expect(formatInterval('soon')).toBe('soon');
  });
});

describe('holdLabel', () => {
  it('interval 이 없으면 rating 라벨만 쓴다', () => {
    expect(holdLabel('다시')).toBe('다시');
  });

  it('interval 을 자연스러운 문장으로 붙인다', () => {
    expect(holdLabel('다시', '1m')).toBe('1분 뒤에 다시 만나요');
    expect(holdLabel('쉬움', '4d')).toBe('4일 뒤에 다시 만나요');
  });

  it('0m 은 잠시 후로 보여준다', () => {
    expect(holdLabel('다시', '0m')).toBe('잠시 후 다시 만나요');
  });
});
