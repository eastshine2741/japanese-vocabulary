import { ArtistRewardCard, CardWord, MasteredSong, RubySegment, SongRewardCard } from './types';

// API 가 생기기 전 화면을 그리기 위한 더미. 가사는 실제 곡 가사가 아니라 지어낸 문장이다.

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;
const appleArtwork = (path: string, size = 900) => `https://is1-ssl.mzstatic.com/image/thumb/${path}/${size}x${size}bb.jpg`;
const cover = (title: string, path: string): MasteredSong => ({ title, artworkUrl: appleArtwork(path, 200) });

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
    level: 3, mastered: true, recall: 0.96, ownerNo: 47, earnedAt: '2026-09-21',
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
    level: 3, mastered: true, recall: 0.95, ownerNo: 764, earnedAt: '2026-10-05',
    frontLines: ['目覚めた朝の僕は', '醜い羽を隠す'],
    back: ['{目覚|めざ}めた{朝|あさ}の{僕|ぼく}は', '{醜|みにく}い{羽|はね}を{隠|かく}す'],
    backKo: '눈을 뜬 아침의 나는 / 흉한 날개를 숨겨',
    words: [w('目覚める', 'めざめる', '눈뜨다'), w('朝', 'あさ', '아침'), w('醜い', 'みにくい', '흉하다'), w('羽', 'はね', '날개')],
    nextGoal: null,
  },
  {
    id: 'idol', songId: null, title: 'アイドル', artist: 'YOASOBI',
    artworkUrl: unsplash('1701762292571-2875f1e522b6'), accent: '#FF5FA2', ink: '#1E0E1A',
    level: 3, mastered: false, recall: 0.93, ownerNo: 312, earnedAt: '2026-10-02',
    frontLines: ['光の中で笑う', '嘘も星になる'],
    back: ['{光|ひかり}の{中|なか}で{笑|わら}う', '{嘘|うそ}も{星|ほし}になる'],
    backKo: '빛 속에서 웃어 / 거짓말도 별이 돼',
    words: [w('光', 'ひかり', '빛'), w('笑う', 'わらう', '웃다'), w('嘘', 'うそ', '거짓말'), w('星', 'ほし', '별')],
    nextGoal: { label: '마스터까지', current: 72, total: 100 },
  },
  {
    id: 'yoru', songId: null, title: '夜に駆ける', artist: 'YOASOBI',
    artworkUrl: unsplash('1716908331958-dfe8e734e560'), accent: '#7FA8FF', ink: '#0E1222',
    level: 3, mastered: false, recall: 0.84, ownerNo: 4021, earnedAt: '2026-09-08',
    frontLines: ['沈む街を抜けて', '夜明けまで走る'],
    back: ['{沈|しず}む{街|まち}を{抜|ぬ}けて', '{夜明|よあ}けまで{走|はし}る'],
    backKo: '가라앉는 거리를 빠져나와 / 새벽까지 달려',
    words: [w('沈む', 'しずむ', '가라앉다'), w('街', 'まち', '거리'), w('抜ける', 'ぬける', '빠져나가다'), w('夜明け', 'よあけ', '새벽')],
    nextGoal: { label: '마스터까지', current: 81, total: 111 },
  },
  {
    id: 'marigold', songId: null, title: 'マリーゴールド', artist: 'あいみょん',
    artworkUrl: unsplash('1769430724125-96853e0eadbb'), accent: '#FF9F43', ink: '#21140A',
    level: 2, mastered: false, recall: 0.95, ownerNo: 902, earnedAt: '2026-09-30',
    frontLines: ['麦わらの帽子', '夏の風に揺れる'],
    back: ['{麦|むぎ}わらの{帽子|ぼうし}', '{夏|なつ}の{風|かぜ}に{揺|ゆ}れる'],
    backKo: '밀짚모자 / 여름 바람에 흔들려',
    words: [w('帽子', 'ぼうし', '모자'), w('夏', 'なつ', '여름'), w('風', 'かぜ', '바람'), w('揺れる', 'ゆれる', '흔들리다')],
    nextGoal: { label: '완곡까지', current: 52, total: 64 },
  },
  {
    id: 'gunjo', songId: null, title: '群青', artist: 'YOASOBI',
    artworkUrl: unsplash('1716809699704-209488bbac53'), accent: '#4FB3D9', ink: '#0B1820',
    level: 2, mastered: false, recall: 0.72, ownerNo: 1180, earnedAt: '2026-08-14',
    frontLines: ['青い波の向こう', '好きを描いてく'],
    back: ['{青|あお}い{波|なみ}の{向|む}こう', '{好|す}きを{描|えが}いてく'],
    backKo: '푸른 파도 너머 / 좋아하는 걸 그려 가',
    words: [w('青い', 'あおい', '파랗다'), w('波', 'なみ', '파도'), w('向こう', 'むこう', '건너편'), w('描く', 'えがく', '그리다')],
    nextGoal: { label: '완곡까지', current: 41, total: 70 },
  },
  {
    id: 'kaiju', songId: null, title: '怪獣の花唄', artist: 'Vaundy',
    artworkUrl: unsplash('1506105524407-94b39b1e7415'), accent: '#8E7CFF', ink: '#120F22',
    level: 2, mastered: false, recall: 0.91, ownerNo: 655, earnedAt: '2026-09-25',
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
    level: 2, mastered: false, recall: 0.88, ownerNo: 1437, earnedAt: '2026-09-27',
    frontLines: ['熱を帯びた空に', '明日を忘れてく'],
    back: ['{熱|ねつ}を{帯|お}びた{空|そら}に', '{明日|あした}を{忘|わす}れてく'],
    backKo: '열을 띤 하늘에 / 내일을 잊어 가',
    words: [w('熱', 'ねつ', '열'), w('帯びる', 'おびる', '띠다'), w('空', 'そら', '하늘'), w('忘れる', 'わすれる', '잊다')],
    nextGoal: { label: '완곡까지', current: 48, total: 76 },
  },
  {
    id: 'hakujitsu', songId: null, title: '白日', artist: 'King Gnu',
    artworkUrl: unsplash('1677145316529-a6e02cc8c504'), accent: '#C9D2E3', ink: '#101216',
    level: 1, mastered: false, recall: 0.94, ownerNo: 88, earnedAt: '2026-10-06',
    frontLines: ['白い日差しの中', '過ちを抱いて'],
    back: ['{白|しろ}い{日差|ひざ}しの{中|なか}', '{過|あやま}ちを{抱|いだ}いて'],
    backKo: '하얀 햇살 속 / 잘못을 끌어안고',
    words: [w('白い', 'しろい', '하얗다'), w('日差し', 'ひざし', '햇살'), w('過ち', 'あやまち', '잘못')],
    nextGoal: { label: '따라 부르기까지', current: 20, total: 34 },
  },
  {
    id: 'neko', songId: null, title: '猫', artist: 'DISH//',
    artworkUrl: unsplash('1590502593747-42a996133562'), accent: '#F2D03B', ink: '#1F1A08',
    level: 1, mastered: false, recall: 0.92, ownerNo: 230, earnedAt: '2026-10-04',
    frontLines: ['夕焼けの帰り道', '君の影を探す'],
    back: ['{夕焼|ゆうや}けの{帰|かえ}り{道|みち}', '{君|きみ}の{影|かげ}を{探|さが}す'],
    backKo: '노을 진 귀갓길 / 너의 그림자를 찾아',
    words: [w('夕焼け', 'ゆうやけ', '노을'), w('帰り道', 'かえりみち', '귀갓길'), w('影', 'かげ', '그림자'), w('探す', 'さがす', '찾다')],
    nextGoal: { label: '따라 부르기까지', current: 9, total: 22 },
  },
  {
    id: 'bansanka', songId: null, title: '晩餐歌', artist: 'tuki.',
    artworkUrl: unsplash('1644705697675-8e13764dabc9'), accent: '#FF6B3D', ink: '#200C06',
    level: 1, mastered: false, recall: 0.62, ownerNo: 511, earnedAt: '2026-09-12',
    frontLines: ['温かい食卓に', 'ひとつ灯をともす'],
    back: ['{温|あたた}かい{食卓|しょくたく}に', 'ひとつ{灯|ひ}をともす'],
    backKo: '따뜻한 식탁에 / 불 하나를 밝혀',
    words: [w('温かい', 'あたたかい', '따뜻하다'), w('食卓', 'しょくたく', '식탁'), w('灯', 'ひ', '등불')],
    nextGoal: { label: '따라 부르기까지', current: 14, total: 25 },
  },
  {
    id: 'dryflower', songId: null, title: 'ドライフラワー', artist: '優里',
    artworkUrl: unsplash('1696671498745-5fddd32f0dab'), accent: '#D9A07A', ink: '#1E140F',
    level: 1, mastered: false, recall: 0.9, ownerNo: 1022, earnedAt: '2026-10-07',
    frontLines: ['色褪せた花束', 'まだ捨てられない'],
    back: ['{色褪|いろあ}せた{花束|はなたば}', 'まだ{捨|す}てられない'],
    backKo: '빛바랜 꽃다발 / 아직 버리지 못해',
    words: [w('色褪せる', 'いろあせる', '빛바래다'), w('花束', 'はなたば', '꽃다발'), w('捨てる', 'すてる', '버리다')],
    nextGoal: { label: '따라 부르기까지', current: 18, total: 30 },
  },
  {
    id: 'suiheisen', songId: null, title: '水平線', artist: 'back number',
    artworkUrl: unsplash('1707128551040-e512534e499d'), accent: '#9FB8C8', ink: '#0E1418',
    level: 1, mastered: false, recall: 0.91, ownerNo: 377, earnedAt: '2026-10-03',
    frontLines: ['遠い水平線へ', '涙を流してく'],
    back: ['{遠|とお}い{水平線|すいへいせん}へ', '{涙|なみだ}を{流|なが}してく'],
    backKo: '먼 수평선으로 / 눈물을 흘려보내',
    words: [w('遠い', 'とおい', '멀다'), w('水平線', 'すいへいせん', '수평선'), w('涙', 'なみだ', '눈물'), w('流す', 'ながす', '흘리다')],
    nextGoal: { label: '따라 부르기까지', current: 11, total: 20 },
  },
  {
    id: 'kaibutsu', songId: null, title: '怪物', artist: 'YOASOBI',
    artworkUrl: unsplash('1543276169-235d78f9d79e'), accent: '#E04848', ink: '#1C0A0A',
    level: 1, mastered: false, recall: 0.55, ownerNo: 2033, earnedAt: '2026-07-19',
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
  '1662920390866-33410f637e72', '1615754890640-1b07ac20cdbc',
];

type ArtistSeed = Omit<ArtistRewardCard, 'id' | 'imageUrl'>;

// 재질 여섯 단계가 모두 보이도록 마스터 곡 수를 골랐다.
const artistSeeds: ArtistSeed[] = [
  {
    name: '米津玄師', accent: '#E8C547', ink: '#1A1206', masteredCount: 31, fanNo: 47, since: '2025-03-02',
    recentMastered: [
      cover('さよーならまたいつか！', 'Music221/v4/3e/b2/13/3eb21367-be26-2634-d90f-bc8182d3d0b2/4547366699760.jpg'),
      cover('KICK BACK', 'Music122/v4/4e/a8/75/4ea875d1-bdb6-9b83-185a-646391cbffbd/4547366589849.jpg'),
      cover('地球儀', 'Music116/v4/45/5a/c9/455ac9fc-e38b-09c2-7e8f-79beeca04375/4547366634242.jpg'),
      cover('感電', 'Music124/v4/6b/0f/0b/6b0f0b3d-e842-5ee1-83a8-1b12142a9dfd/dj.bpfbtyiy.jpg'),
      cover('馬と鹿', 'Music124/v4/5f/8b/86/5f8b86ec-5ee5-fe35-5691-6a63951039a5/jacket_SECL02497B00Z_550.jpg'),
    ],
  },
  {
    name: 'YOASOBI', accent: '#7FB8FF', ink: '#0B1020', masteredCount: 16, fanNo: 312, since: '2025-06-14',
    recentMastered: [
      cover('祝福', 'Music122/v4/5c/45/a9/5c45a9cf-678a-a945-3544-923382e5d1c4/197186993001.jpg'),
      cover('ハルカ', 'Music125/v4/6f/92/2d/6f922d2d-735d-59bd-00a0-d845371bb99c/195497666263.jpg'),
      cover('たぶん', 'Music124/v4/bf/1c/3b/bf1c3bdd-a128-2843-776a-35bf3c879d98/195081850498.jpg'),
      cover('優しい彗星', 'Music124/v4/fc/2a/2a/fc2a2ae6-f971-0b82-efe7-fad4981efe68/195497842889.jpg'),
      cover('ツバメ', 'Music125/v4/5a/66/8d/5a668da4-c94d-b208-19cd-8bc649f725e2/196292629439.jpg'),
    ],
  },
  {
    name: 'King Gnu', accent: '#E06A4F', ink: '#170A08', masteredCount: 8, fanNo: 1180, since: '2025-11-20',
    recentMastered: [
      cover('SPECIALZ', 'Music116/v4/aa/33/55/aa335541-9932-d73c-6b1e-62bd484fc83d/4547366642308.jpg'),
      cover('一途', 'Music211/v4/64/d7/73/64d77339-d682-5903-611f-cf59ab928750/4547366542400.jpg'),
      cover('逆夢', 'Music211/v4/c6/17/d9/c617d968-ed91-81c0-8a2a-1dc4edb46110/4547366544121.jpg'),
      cover('カメレオン', 'Music116/v4/28/5e/6a/285e6aab-fb7d-aca7-2cd0-7d0502cabdde/4547366552881.jpg'),
      cover('三文小説', 'Music125/v4/f0/52/0e/f0520ec1-755a-2bea-c478-2b2d24a5f445/4547366480252.jpg'),
    ],
  },
  {
    name: 'あいみょん', accent: '#F2A65A', ink: '#1C1008', masteredCount: 4, fanNo: 902, since: '2026-02-08',
    recentMastered: [
      cover('裸の心', 'Music124/v4/85/0b/1b/850b1b4c-f529-6828-4b2b-a5a187ec61c6/190295235017.jpg'),
      cover('君はロックを聴かない', 'Music124/v4/d8/7b/7c/d87b7cfd-c88c-1003-bc5d-883882043e33/190295747138.jpg'),
      cover('愛を伝えたいだとか', 'Music122/v4/33/bb/26/33bb26ea-d33e-10da-448d-e592d540b1d2/190295821067.jpg'),
      cover('ハルノヒ', 'Music114/v4/c6/17/ad/c617ad80-bf5c-64f1-0d52-f19cb1c04efd/190295450946.jpg'),
    ],
  },
  {
    name: 'Vaundy', accent: '#8FD16A', ink: '#0B140A', masteredCount: 2, fanNo: 655, since: '2026-05-30',
    recentMastered: [
      cover('踊り子', 'Music126/v4/f1/cd/f7/f1cdf773-5dca-3d6d-6c14-2fb9871a83a9/197189838330.jpg'),
      cover('花占い', 'Music116/v4/18/71/31/1871315a-3e07-b5a1-e19d-2e404ff73c0b/197189907494.jpg'),
    ],
  },
  {
    name: '25時、ナイトコードで。', accent: '#B07AE8', ink: '#110A1C', masteredCount: 1, fanNo: 764, since: '2026-08-11',
    recentMastered: [
      cover('ザムザ', 'Music126/v4/dc/75/73/dc75730f-d84b-3c77-dba8-3e070bc66937/4511820-96201.jpg'),
    ],
  },
  {
    name: 'back number', accent: '#6FA8C8', ink: '#08121A', masteredCount: 0, fanNo: 1437, since: '2026-09-27',
    recentMastered: [],
  },
  {
    name: 'tuki.', accent: '#E6849B', ink: '#1A0A0F', masteredCount: 0, fanNo: 511, since: '2026-09-12',
    recentMastered: [],
  },
];

export const DUMMY_ARTIST_CARDS: ArtistRewardCard[] = artistSeeds.map((seed, i) => ({
  id: `artist-${i}`,
  imageUrl: unsplash(ARTIST_PHOTOS[i % ARTIST_PHOTOS.length]),
  ...seed,
}));

export function findDummySongCard(id: string): SongRewardCard | undefined {
  return DUMMY_SONG_CARDS.find((c) => c.id === id);
}

export function findDummyArtistCard(id: string): ArtistRewardCard | undefined {
  return DUMMY_ARTIST_CARDS.find((c) => c.id === id);
}
