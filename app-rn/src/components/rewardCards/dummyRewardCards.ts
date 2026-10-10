import { ArtistRewardCard, CardWord, RubySegment, SongRewardCard } from './types';

// API 가 생기기 전 화면을 그리기 위한 더미. 가사는 실제 곡 가사가 아니라 지어낸 문장이다.

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;
const appleArtwork = (path: string) => `https://is1-ssl.mzstatic.com/image/thumb/${path}/900x900bb.jpg`;

const ruby = (source: string): RubySegment[] =>
  source.split(/(\{[^}]+\})/).filter(Boolean).map((part) => {
    const m = part.match(/^\{([^|]+)\|([^}]+)\}$/);
    return m ? { text: m[1], reading: m[2] } : { text: part };
  });

const w = (japanese: string, reading: string, meaning: string): CardWord => ({
  japanese, reading, meaning,
});

type Seed = Omit<SongRewardCard, 'backLines'> & { back: [string, string] };

const seeds: Seed[] = [
  {
    id: 'lemon', songId: null, title: 'Lemon', artist: '米津玄師',
    artworkUrl: unsplash('1682946543931-2c0dded9ba65'), accent: '#E8C547', ink: '#1C1A12',
    level: 3, lenticular: true, recall: 0.96, ownerNo: 47, earnedAt: '2026-09-21',
    frontLines: ['苦い果実の香り', '胸に残るまま'],
    back: ['{苦|にが}い{果実|かじつ}の{香|かお}り', '{胸|むね}に{残|のこ}るまま'],
    backKo: '쓴 과실의 향기 / 가슴에 남은 채로',
    words: [w('苦い', 'にがい', '쓰다'), w('果実', 'かじつ', '과실'), w('香り', 'かおり', '향기'), w('胸', 'むね', '가슴'), w('残る', 'のこる', '남다')],
    nextGoal: null,
  },
  {
    id: 'zamza', songId: null, title: 'ザムザ', artist: '25時、ナイトコードで。',
    artworkUrl: appleArtwork('Music126/v4/dc/75/73/dc75730f-d84b-3c77-dba8-3e070bc66937/4511820-96201.jpg'),
    accent: '#5EC4C0', ink: '#08191B',
    level: 3, lenticular: true, recall: 0.95, ownerNo: 764, earnedAt: '2026-10-05',
    frontLines: ['目覚めた朝の僕は', '醜い羽を隠す'],
    back: ['{目覚|めざ}めた{朝|あさ}の{僕|ぼく}は', '{醜|みにく}い{羽|はね}を{隠|かく}す'],
    backKo: '눈을 뜬 아침의 나는 / 흉한 날개를 숨겨',
    words: [w('目覚める', 'めざめる', '눈뜨다'), w('朝', 'あさ', '아침'), w('醜い', 'みにくい', '흉하다'), w('羽', 'はね', '날개')],
    nextGoal: null,
  },
  {
    id: 'idol', songId: null, title: 'アイドル', artist: 'YOASOBI',
    artworkUrl: unsplash('1701762292571-2875f1e522b6'), accent: '#FF5FA2', ink: '#1E0E1A',
    level: 3, lenticular: false, recall: 0.93, ownerNo: 312, earnedAt: '2026-10-02',
    frontLines: ['光の中で笑う', '嘘も星になる'],
    back: ['{光|ひかり}の{中|なか}で{笑|わら}う', '{嘘|うそ}も{星|ほし}になる'],
    backKo: '빛 속에서 웃어 / 거짓말도 별이 돼',
    words: [w('光', 'ひかり', '빛'), w('笑う', 'わらう', '웃다'), w('嘘', 'うそ', '거짓말'), w('星', 'ほし', '별')],
    nextGoal: { label: '렌티큘러까지', current: 72, total: 100 },
  },
  {
    id: 'yoru', songId: null, title: '夜に駆ける', artist: 'YOASOBI',
    artworkUrl: unsplash('1716908331958-dfe8e734e560'), accent: '#7FA8FF', ink: '#0E1222',
    level: 3, lenticular: false, recall: 0.84, ownerNo: 4021, earnedAt: '2026-09-08',
    frontLines: ['沈む街を抜けて', '夜明けまで走る'],
    back: ['{沈|しず}む{街|まち}を{抜|ぬ}けて', '{夜明|よあ}けまで{走|はし}る'],
    backKo: '가라앉는 거리를 빠져나와 / 새벽까지 달려',
    words: [w('沈む', 'しずむ', '가라앉다'), w('街', 'まち', '거리'), w('抜ける', 'ぬける', '빠져나가다'), w('夜明け', 'よあけ', '새벽')],
    nextGoal: { label: '렌티큘러까지', current: 81, total: 111 },
  },
  {
    id: 'marigold', songId: null, title: 'マリーゴールド', artist: 'あいみょん',
    artworkUrl: unsplash('1769430724125-96853e0eadbb'), accent: '#FF9F43', ink: '#21140A',
    level: 2, lenticular: false, recall: 0.95, ownerNo: 902, earnedAt: '2026-09-30',
    frontLines: ['麦わらの帽子', '夏の風に揺れる'],
    back: ['{麦|むぎ}わらの{帽子|ぼうし}', '{夏|なつ}の{風|かぜ}に{揺|ゆ}れる'],
    backKo: '밀짚모자 / 여름 바람에 흔들려',
    words: [w('帽子', 'ぼうし', '모자'), w('夏', 'なつ', '여름'), w('風', 'かぜ', '바람'), w('揺れる', 'ゆれる', '흔들리다')],
    nextGoal: { label: '완곡까지', current: 52, total: 64 },
  },
  {
    id: 'gunjo', songId: null, title: '群青', artist: 'YOASOBI',
    artworkUrl: unsplash('1716809699704-209488bbac53'), accent: '#4FB3D9', ink: '#0B1820',
    level: 2, lenticular: false, recall: 0.72, ownerNo: 1180, earnedAt: '2026-08-14',
    frontLines: ['青い波の向こう', '好きを描いてく'],
    back: ['{青|あお}い{波|なみ}の{向|む}こう', '{好|す}きを{描|えが}いてく'],
    backKo: '푸른 파도 너머 / 좋아하는 걸 그려 가',
    words: [w('青い', 'あおい', '파랗다'), w('波', 'なみ', '파도'), w('向こう', 'むこう', '건너편'), w('描く', 'えがく', '그리다')],
    nextGoal: { label: '완곡까지', current: 41, total: 70 },
  },
  {
    id: 'kaiju', songId: null, title: '怪獣の花唄', artist: 'Vaundy',
    artworkUrl: unsplash('1506105524407-94b39b1e7415'), accent: '#8E7CFF', ink: '#120F22',
    level: 2, lenticular: false, recall: 0.91, ownerNo: 655, earnedAt: '2026-09-25',
    frontLines: ['星の下で歌えば', '思い出が光る'],
    back: ['{星|ほし}の{下|した}で{歌|うた}えば', '{思|おも}い{出|で}が{光|ひか}る'],
    backKo: '별 아래서 노래하면 / 추억이 빛나',
    words: [w('星', 'ほし', '별'), w('歌う', 'うたう', '노래하다'), w('思い出', 'おもいで', '추억'), w('光る', 'ひかる', '빛나다')],
    nextGoal: { label: '완곡까지', current: 60, total: 82 },
  },
  {
    id: 'netsuijou', songId: null, title: '熱異常', artist: 'いよわ',
    artworkUrl: appleArtwork('Music112/v4/b9/9c/bd/b99cbdd3-bac5-88f7-d3cf-713c42c40386/859758874797_cover.jpg'),
    accent: '#FF5A2A', ink: '#210A04',
    level: 2, lenticular: false, recall: 0.88, ownerNo: 1437, earnedAt: '2026-09-27',
    frontLines: ['熱を帯びた空に', '明日を忘れてく'],
    back: ['{熱|ねつ}を{帯|お}びた{空|そら}に', '{明日|あした}を{忘|わす}れてく'],
    backKo: '열을 띤 하늘에 / 내일을 잊어 가',
    words: [w('熱', 'ねつ', '열'), w('帯びる', 'おびる', '띠다'), w('空', 'そら', '하늘'), w('忘れる', 'わすれる', '잊다')],
    nextGoal: { label: '완곡까지', current: 48, total: 76 },
  },
  {
    id: 'hakujitsu', songId: null, title: '白日', artist: 'King Gnu',
    artworkUrl: unsplash('1677145316529-a6e02cc8c504'), accent: '#C9D2E3', ink: '#101216',
    level: 1, lenticular: false, recall: 0.94, ownerNo: 88, earnedAt: '2026-10-06',
    frontLines: ['白い日差しの中', '過ちを抱いて'],
    back: ['{白|しろ}い{日差|ひざ}しの{中|なか}', '{過|あやま}ちを{抱|いだ}いて'],
    backKo: '하얀 햇살 속 / 잘못을 끌어안고',
    words: [w('白い', 'しろい', '하얗다'), w('日差し', 'ひざし', '햇살'), w('過ち', 'あやまち', '잘못')],
    nextGoal: { label: '따라 부르기까지', current: 20, total: 34 },
  },
  {
    id: 'neko', songId: null, title: '猫', artist: 'DISH//',
    artworkUrl: unsplash('1590502593747-42a996133562'), accent: '#F2D03B', ink: '#1F1A08',
    level: 1, lenticular: false, recall: 0.92, ownerNo: 230, earnedAt: '2026-10-04',
    frontLines: ['夕焼けの帰り道', '君の影を探す'],
    back: ['{夕焼|ゆうや}けの{帰|かえ}り{道|みち}', '{君|きみ}の{影|かげ}を{探|さが}す'],
    backKo: '노을 진 귀갓길 / 너의 그림자를 찾아',
    words: [w('夕焼け', 'ゆうやけ', '노을'), w('帰り道', 'かえりみち', '귀갓길'), w('影', 'かげ', '그림자'), w('探す', 'さがす', '찾다')],
    nextGoal: { label: '따라 부르기까지', current: 9, total: 22 },
  },
  {
    id: 'bansanka', songId: null, title: '晩餐歌', artist: 'tuki.',
    artworkUrl: unsplash('1644705697675-8e13764dabc9'), accent: '#FF6B3D', ink: '#200C06',
    level: 1, lenticular: false, recall: 0.62, ownerNo: 511, earnedAt: '2026-09-12',
    frontLines: ['温かい食卓に', 'ひとつ灯をともす'],
    back: ['{温|あたた}かい{食卓|しょくたく}に', 'ひとつ{灯|ひ}をともす'],
    backKo: '따뜻한 식탁에 / 불 하나를 밝혀',
    words: [w('温かい', 'あたたかい', '따뜻하다'), w('食卓', 'しょくたく', '식탁'), w('灯', 'ひ', '등불')],
    nextGoal: { label: '따라 부르기까지', current: 14, total: 25 },
  },
  {
    id: 'dryflower', songId: null, title: 'ドライフラワー', artist: '優里',
    artworkUrl: unsplash('1696671498745-5fddd32f0dab'), accent: '#D9A07A', ink: '#1E140F',
    level: 1, lenticular: false, recall: 0.9, ownerNo: 1022, earnedAt: '2026-10-07',
    frontLines: ['色褪せた花束', 'まだ捨てられない'],
    back: ['{色褪|いろあ}せた{花束|はなたば}', 'まだ{捨|す}てられない'],
    backKo: '빛바랜 꽃다발 / 아직 버리지 못해',
    words: [w('色褪せる', 'いろあせる', '빛바래다'), w('花束', 'はなたば', '꽃다발'), w('捨てる', 'すてる', '버리다')],
    nextGoal: { label: '따라 부르기까지', current: 18, total: 30 },
  },
  {
    id: 'suiheisen', songId: null, title: '水平線', artist: 'back number',
    artworkUrl: unsplash('1707128551040-e512534e499d'), accent: '#9FB8C8', ink: '#0E1418',
    level: 1, lenticular: false, recall: 0.91, ownerNo: 377, earnedAt: '2026-10-03',
    frontLines: ['遠い水平線へ', '涙を流してく'],
    back: ['{遠|とお}い{水平線|すいへいせん}へ', '{涙|なみだ}を{流|なが}してく'],
    backKo: '먼 수평선으로 / 눈물을 흘려보내',
    words: [w('遠い', 'とおい', '멀다'), w('水平線', 'すいへいせん', '수평선'), w('涙', 'なみだ', '눈물'), w('流す', 'ながす', '흘리다')],
    nextGoal: { label: '따라 부르기까지', current: 11, total: 20 },
  },
  {
    id: 'kaibutsu', songId: null, title: '怪物', artist: 'YOASOBI',
    artworkUrl: unsplash('1543276169-235d78f9d79e'), accent: '#E04848', ink: '#1C0A0A',
    level: 1, lenticular: false, recall: 0.55, ownerNo: 2033, earnedAt: '2026-07-19',
    frontLines: ['牙を隠したまま', '正しさを問う'],
    back: ['{牙|きば}を{隠|かく}したまま', '{正|ただ}しさを{問|と}う'],
    backKo: '송곳니를 숨긴 채 / 옳음을 물어',
    words: [w('牙', 'きば', '송곳니'), w('隠す', 'かくす', '숨기다'), w('正しい', 'ただしい', '옳다'), w('問う', 'とう', '묻다')],
    nextGoal: { label: '따라 부르기까지', current: 16, total: 28 },
  },
];

export const DUMMY_SONG_CARDS: SongRewardCard[] = seeds.map(({ back, ...card }) => ({
  ...card,
  backLines: back.map(ruby),
}));

const ARTIST_PHOTOS = [
  '1693240817505-f59d02b89ef9', '1670960763844-10278a725ac7', '1528818955841-a7f1425131b5',
  '1711750058162-29035a3b61a8', '1728734719929-2536485e280b', '1761503030918-533edb8d48c6',
  '1662920390866-33410f637e72', '1615754890640-1b07ac20cdbc', '1646753950523-19fb8a2a1457',
];

// 등급 기준(3장·5장)은 아직 정해지지 않은 값이다.
const LEVEL_STEPS = [3, 5];

export const DUMMY_ARTIST_CARDS: ArtistRewardCard[] = Object.entries(
  DUMMY_SONG_CARDS.reduce<Record<string, number>>((acc, c) => {
    acc[c.artist] = (acc[c.artist] ?? 0) + 1;
    return acc;
  }, {}),
)
  .sort((a, b) => b[1] - a[1])
  .map(([name, count], i) => {
    const level = (1 + LEVEL_STEPS.filter((step) => count >= step).length) as 1 | 2 | 3;
    return {
      id: `artist-${i}`,
      name,
      imageUrl: unsplash(ARTIST_PHOTOS[i % ARTIST_PHOTOS.length]),
      level,
      songCardCount: count,
      nextLevelAt: LEVEL_STEPS.find((step) => count < step) ?? null,
    };
  });

export function findDummySongCard(id: string): SongRewardCard | undefined {
  return DUMMY_SONG_CARDS.find((c) => c.id === id);
}
