import { describe, expect, it } from 'vitest';
import { cardArtist, cardTitle } from './cardCredit';

describe('cardTitle', () => {
  it('feat 괄호만 지우고 다른 괄호는 남긴다', () => {
    expect(cardTitle('夜に駆ける (feat. ikura)')).toBe('夜に駆ける');
    expect(cardTitle('アイドル [ft. X] (TV size)')).toBe('アイドル (TV size)');
    expect(cardTitle('Song（featuring A & B）')).toBe('Song');
    expect(cardTitle('Lemon (Remix)')).toBe('Lemon (Remix)');
  });

  it('괄호 없이 뒤에 붙은 feat 도 지운다', () => {
    expect(cardTitle('Song feat.鏡音リン')).toBe('Song');
  });
});

describe('cardArtist', () => {
  it('메인 아티스트만 남긴다', () => {
    expect(cardArtist('椎名もた feat.鏡音リン')).toBe('椎名もた');
    expect(cardArtist('YOASOBI (feat. ikura)')).toBe('YOASOBI');
  });

  it('이름 속 ft 는 건드리지 않고, 다 지워지면 원래 표기를 쓴다', () => {
    expect(cardArtist('Kis-My-Ft2')).toBe('Kis-My-Ft2');
    expect(cardArtist('feat. A')).toBe('feat. A');
  });
});
