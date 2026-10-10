import { describe, expect, it } from 'vitest';
import { toPattern } from './vibrationPattern';

describe('toPattern', () => {
  it('떨어진 울림은 사이 쉼과 함께 늘어놓는다', () => {
    expect(toPattern([[0, 100], [150, 50]])).toEqual([0, 100, 50, 50]);
  });

  it('처음 울림 전 쉼을 둔다', () => {
    expect(toPattern([[30, 20]])).toEqual([30, 20]);
  });

  it('겹치는 울림은 한 줄기로 이어 붙인다', () => {
    expect(toPattern([[0, 100], [60, 80], [300, 10]])).toEqual([0, 140, 160, 10]);
  });

  it('앞 울림 안에 들어가는 울림은 길이를 바꾸지 않는다', () => {
    expect(toPattern([[0, 100], [20, 30]])).toEqual([0, 100]);
  });

  it('순서가 섞여 들어와도 시작 순으로 정렬한다', () => {
    expect(toPattern([[150, 50], [0, 100]])).toEqual([0, 100, 50, 50]);
  });
});
