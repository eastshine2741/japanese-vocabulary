import { describe, expect, it } from 'vitest';
import { parseShareWebData, storeOf } from './shareWebData';

const card = {
  token: 't',
  url: 'https://kotonoha.eastshine.dev/c/t',
  kind: 'ARTIST',
  songCard: null,
  artistCard: { artistId: 1, name: 'YOASOBI' },
  owner: { name: '하루', profileImageUrl: null },
};

describe('parseShareWebData', () => {
  it('서버가 실어 준 JSON 을 읽는다', () => {
    const json = JSON.stringify({ card, appUrl: 'kotonoha://c/t', iosAppStoreUrl: 'i', androidPlayUrl: 'a' });
    expect(parseShareWebData(json)?.card.owner.name).toBe('하루');
  });

  it('비었거나 깨졌거나 카드가 없으면 null', () => {
    expect(parseShareWebData(null)).toBeNull();
    expect(parseShareWebData('{')).toBeNull();
    expect(parseShareWebData(JSON.stringify({ card: { ...card, artistCard: null } }))).toBeNull();
  });
});

describe('storeOf', () => {
  it('기기에 맞는 스토어', () => {
    expect(storeOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(storeOf('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android');
    expect(storeOf('Mozilla/5.0 (Windows NT 10.0)')).toBeNull();
  });
});
