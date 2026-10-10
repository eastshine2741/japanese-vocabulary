import { ARTIST_GRADE_STEPS } from './artistGrade';
import { ArtistRewardCard, CardLyricLine, CardWord, MasteredSong, RubySegment, SongRewardCard } from './types';

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

/** 가사는 곡 순서대로 [후리가나 원문, 번역]. pick 은 카드에 처음 실리는 줄. */
type Seed = Omit<SongRewardCard, 'lyric' | 'signature'> & { lyrics: [string, string][]; pick: number[] };

const seeds: Seed[] = [
  {
    id: 'lemon', songId: null, title: 'Lemon', artist: '米津玄師',
    artworkUrl: unsplash('1682946543931-2c0dded9ba65'), accent: '#E8C547', ink: '#1C1A12',
    level: 3, mastered: true, recall: 0.96, ownerNo: 47, earnedAt: '2026-09-21',
    lyrics: [
      ['{雨|あめ}が{降|ふ}り{止|や}まない', '비가 그치지 않아'],
      ['{古|ふる}い{傷|きず}が{痛|いた}む', '오래된 상처가 아파'],
      ['{苦|にが}い{果実|かじつ}の{香|かお}り', '쓴 과실의 향기'],
      ['{胸|むね}に{残|のこ}るまま', '가슴에 남은 채로'],
      ['{今|いま}も{君|きみ}は{光|ひかり}', '지금도 너는 빛'],
      ['{忘|わす}れられない{日々|ひび}', '잊을 수 없는 나날'],
    ],
    pick: [2, 3],
    words: [w('苦い', 'にがい', '쓰다'), w('果実', 'かじつ', '과실'), w('香り', 'かおり', '향기'), w('胸', 'むね', '가슴'), w('残る', 'のこる', '남다')],
    nextGoal: null,
  },
  {
    id: 'zamza', songId: null, title: 'ザムザ', artist: '25時、ナイトコードで。',
    artworkUrl: appleArtwork('Music126/v4/dc/75/73/dc75730f-d84b-3c77-dba8-3e070bc66937/4511820-96201.jpg'),
    accent: '#5EC4C0', ink: '#08191B',
    level: 3, mastered: true, recall: 0.95, ownerNo: 764, earnedAt: '2026-10-05',
    lyrics: [
      ['{窓|まど}の{外|そと}は{灰色|はいいろ}', '창밖은 잿빛'],
      ['{目覚|めざ}めた{朝|あさ}の{僕|ぼく}は', '눈을 뜬 아침의 나는'],
      ['{醜|みにく}い{羽|はね}を{隠|かく}す', '흉한 날개를 숨겨'],
      ['{誰|だれ}にも{言|い}えない', '누구에게도 말 못 해'],
      ['{声|こえ}を{殺|ころ}して{泣|な}く', '소리를 죽이고 울어'],
    ],
    pick: [1, 2],
    words: [w('目覚める', 'めざめる', '눈뜨다'), w('朝', 'あさ', '아침'), w('醜い', 'みにくい', '흉하다'), w('羽', 'はね', '날개')],
    nextGoal: null,
  },
  {
    id: 'idol', songId: null, title: 'アイドル', artist: 'YOASOBI',
    artworkUrl: unsplash('1701762292571-2875f1e522b6'), accent: '#FF5FA2', ink: '#1E0E1A',
    level: 3, mastered: false, recall: 0.93, ownerNo: 312, earnedAt: '2026-10-02',
    lyrics: [
      ['{完璧|かんぺき}な{笑顔|えがお}で', '완벽한 미소로'],
      ['{誰|だれ}もが{目|め}を{奪|うば}われる', '모두가 눈을 빼앗겨'],
      ['{光|ひかり}の{中|なか}で{笑|わら}う', '빛 속에서 웃어'],
      ['{嘘|うそ}も{星|ほし}になる', '거짓말도 별이 돼'],
      ['{本当|ほんとう}は{秘密|ひみつ}', '사실은 비밀'],
    ],
    pick: [2, 3],
    words: [w('光', 'ひかり', '빛'), w('笑う', 'わらう', '웃다'), w('嘘', 'うそ', '거짓말'), w('星', 'ほし', '별')],
    nextGoal: { label: '마스터까지', current: 72, total: 100 },
  },
  {
    id: 'yoru', songId: null, title: '夜に駆ける', artist: 'YOASOBI',
    artworkUrl: unsplash('1716908331958-dfe8e734e560'), accent: '#7FA8FF', ink: '#0E1222',
    level: 3, mastered: false, recall: 0.84, ownerNo: 4021, earnedAt: '2026-09-08',
    lyrics: [
      ['{君|きみ}の{手|て}を{取|と}って', '너의 손을 잡고'],
      ['{沈|しず}む{街|まち}を{抜|ぬ}けて', '가라앉는 거리를 빠져나와'],
      ['{夜明|よあ}けまで{走|はし}る', '새벽까지 달려'],
      ['{風|かぜ}の{音|おと}だけ{響|ひび}く', '바람 소리만 울려'],
      ['{振|ふ}り{返|かえ}らないで', '뒤돌아보지 마'],
    ],
    pick: [1, 2],
    words: [w('沈む', 'しずむ', '가라앉다'), w('街', 'まち', '거리'), w('抜ける', 'ぬける', '빠져나가다'), w('夜明け', 'よあけ', '새벽')],
    nextGoal: { label: '마스터까지', current: 81, total: 111 },
  },
  {
    id: 'marigold', songId: null, title: 'マリーゴールド', artist: 'あいみょん',
    artworkUrl: unsplash('1769430724125-96853e0eadbb'), accent: '#FF9F43', ink: '#21140A',
    level: 2, mastered: false, recall: 0.95, ownerNo: 902, earnedAt: '2026-09-30',
    lyrics: [
      ['{遠|とお}くの{空|そら}を{見|み}る', '먼 하늘을 봐'],
      ['{麦|むぎ}わらの{帽子|ぼうし}', '밀짚모자'],
      ['{夏|なつ}の{風|かぜ}に{揺|ゆ}れる', '여름 바람에 흔들려'],
      ['{手|て}を{繋|つな}いで{歩|ある}く', '손잡고 걸어'],
      ['{花|はな}が{咲|さ}く{頃|ころ}', '꽃이 필 무렵'],
    ],
    pick: [1, 2],
    words: [w('帽子', 'ぼうし', '모자'), w('夏', 'なつ', '여름'), w('風', 'かぜ', '바람'), w('揺れる', 'ゆれる', '흔들리다')],
    nextGoal: { label: '완곡까지', current: 52, total: 64 },
  },
  {
    id: 'gunjo', songId: null, title: '群青', artist: 'YOASOBI',
    artworkUrl: unsplash('1716809699704-209488bbac53'), accent: '#4FB3D9', ink: '#0B1820',
    level: 2, mastered: false, recall: 0.72, ownerNo: 1180, earnedAt: '2026-08-14',
    lyrics: [
      ['{嘘|うそ}じゃない{気持|きも}ち', '거짓 아닌 마음'],
      ['{青|あお}い{波|なみ}の{向|む}こう', '푸른 파도 너머'],
      ['{好|す}きを{描|えが}いてく', '좋아하는 걸 그려 가'],
      ['{怖|こわ}くても{進|すす}む', '무서워도 나아가'],
      ['{自分|じぶん}の{色|いろ}で', '나만의 색으로'],
    ],
    pick: [1, 2],
    words: [w('青い', 'あおい', '파랗다'), w('波', 'なみ', '파도'), w('向こう', 'むこう', '건너편'), w('描く', 'えがく', '그리다')],
    nextGoal: { label: '완곡까지', current: 41, total: 70 },
  },
  {
    id: 'kaiju', songId: null, title: '怪獣の花唄', artist: 'Vaundy',
    artworkUrl: unsplash('1506105524407-94b39b1e7415'), accent: '#8E7CFF', ink: '#120F22',
    level: 2, mastered: false, recall: 0.91, ownerNo: 655, earnedAt: '2026-09-25',
    lyrics: [
      ['{眠|ねむ}れない{夜|よる}に', '잠 못 드는 밤에'],
      ['{星|ほし}の{下|した}で{歌|うた}えば', '별 아래서 노래하면'],
      ['{思|おも}い{出|で}が{光|ひか}る', '추억이 빛나'],
      ['{大|おお}きな{声|こえ}で', '큰 목소리로'],
      ['{君|きみ}を{呼|よ}んでいる', '너를 부르고 있어'],
    ],
    pick: [1, 2],
    words: [w('星', 'ほし', '별'), w('歌う', 'うたう', '노래하다'), w('思い出', 'おもいで', '추억'), w('光る', 'ひかる', '빛나다')],
    nextGoal: { label: '완곡까지', current: 60, total: 82 },
  },
  {
    id: 'netsuijou', songId: null, title: '熱異常', artist: 'いよわ',
    artworkUrl: appleArtwork('Music112/v4/b9/9c/bd/b99cbdd3-bac5-88f7-d3cf-713c42c40386/859758874797_cover.jpg'),
    accent: '#FF5A2A', ink: '#210A04',
    level: 2, mastered: false, recall: 0.88, ownerNo: 1437, earnedAt: '2026-09-27',
    lyrics: [
      ['{壊|こわ}れた{時計|とけい}の{針|はり}', '고장 난 시계 바늘'],
      ['{熱|ねつ}を{帯|お}びた{空|そら}に', '열을 띤 하늘에'],
      ['{明日|あした}を{忘|わす}れてく', '내일을 잊어 가'],
      ['{答|こた}えはまだ{遠|とお}い', '답은 아직 멀어'],
      ['{記憶|きおく}が{溶|と}けてく', '기억이 녹아 가'],
    ],
    pick: [1, 2],
    words: [w('熱', 'ねつ', '열'), w('帯びる', 'おびる', '띠다'), w('空', 'そら', '하늘'), w('忘れる', 'わすれる', '잊다')],
    nextGoal: { label: '완곡까지', current: 48, total: 76 },
  },
  {
    id: 'hakujitsu', songId: null, title: '白日', artist: 'King Gnu',
    artworkUrl: unsplash('1677145316529-a6e02cc8c504'), accent: '#C9D2E3', ink: '#101216',
    level: 1, mastered: false, recall: 0.94, ownerNo: 88, earnedAt: '2026-10-06',
    lyrics: [
      ['{雪|ゆき}が{全|すべ}てを{隠|かく}す', '눈이 모든 걸 숨겨'],
      ['{白|しろ}い{日差|ひざ}しの{中|なか}', '하얀 햇살 속'],
      ['{過|あやま}ちを{抱|いだ}いて', '잘못을 끌어안고'],
      ['{真|ま}っ{白|しろ}な{明日|あした}へ', '새하얀 내일로'],
      ['{歩|ある}き{出|だ}せるなら', '걸어 나갈 수 있다면'],
    ],
    pick: [1, 2],
    words: [w('白い', 'しろい', '하얗다'), w('日差し', 'ひざし', '햇살'), w('過ち', 'あやまち', '잘못')],
    nextGoal: { label: '따라 부르기까지', current: 20, total: 34 },
  },
  {
    id: 'neko', songId: null, title: '猫', artist: 'DISH//',
    artworkUrl: unsplash('1590502593747-42a996133562'), accent: '#F2D03B', ink: '#1F1A08',
    level: 1, mastered: false, recall: 0.92, ownerNo: 230, earnedAt: '2026-10-04',
    lyrics: [
      ['{気|き}まぐれな{君|きみ}', '변덕스러운 너'],
      ['{夕焼|ゆうや}けの{帰|かえ}り{道|みち}', '노을 진 귀갓길'],
      ['{君|きみ}の{影|かげ}を{探|さが}す', '너의 그림자를 찾아'],
      ['{部屋|へや}は{静|しず}かすぎて', '방은 너무 조용해서'],
      ['{会|あ}いたいと{呟|つぶや}く', '보고 싶다고 중얼거려'],
    ],
    pick: [1, 2],
    words: [w('夕焼け', 'ゆうやけ', '노을'), w('帰り道', 'かえりみち', '귀갓길'), w('影', 'かげ', '그림자'), w('探す', 'さがす', '찾다')],
    nextGoal: { label: '따라 부르기까지', current: 9, total: 22 },
  },
  {
    id: 'bansanka', songId: null, title: '晩餐歌', artist: 'tuki.',
    artworkUrl: unsplash('1644705697675-8e13764dabc9'), accent: '#FF6B3D', ink: '#200C06',
    level: 1, mastered: false, recall: 0.62, ownerNo: 511, earnedAt: '2026-09-12',
    lyrics: [
      ['{二人|ふたり}{分|ぶん}の{皿|さら}', '두 사람 몫의 접시'],
      ['{温|あたた}かい{食卓|しょくたく}に', '따뜻한 식탁에'],
      ['ひとつ{灯|ひ}をともす', '불 하나를 밝혀'],
      ['{涙|なみだ}の{味|あじ}がする', '눈물 맛이 나'],
      ['{今夜|こんや}だけはそばに', '오늘 밤만은 곁에'],
    ],
    pick: [1, 2],
    words: [w('温かい', 'あたたかい', '따뜻하다'), w('食卓', 'しょくたく', '식탁'), w('灯', 'ひ', '등불')],
    nextGoal: { label: '따라 부르기까지', current: 14, total: 25 },
  },
  {
    id: 'dryflower', songId: null, title: 'ドライフラワー', artist: '優里',
    artworkUrl: unsplash('1696671498745-5fddd32f0dab'), accent: '#D9A07A', ink: '#1E140F',
    level: 1, mastered: false, recall: 0.9, ownerNo: 1022, earnedAt: '2026-10-07',
    lyrics: [
      ['{部屋|へや}の{隅|すみ}に{置|お}いた', '방 구석에 둔'],
      ['{色褪|いろあ}せた{花束|はなたば}', '빛바랜 꽃다발'],
      ['まだ{捨|す}てられない', '아직 버리지 못해'],
      ['{君|きみ}の{声|こえ}が{消|き}えない', '너의 목소리가 사라지지 않아'],
      ['{乾|かわ}いた{心|こころ}', '메마른 마음'],
    ],
    pick: [1, 2],
    words: [w('色褪せる', 'いろあせる', '빛바래다'), w('花束', 'はなたば', '꽃다발'), w('捨てる', 'すてる', '버리다')],
    nextGoal: { label: '따라 부르기까지', current: 18, total: 30 },
  },
  {
    id: 'suiheisen', songId: null, title: '水平線', artist: 'back number',
    artworkUrl: unsplash('1707128551040-e512534e499d'), accent: '#9FB8C8', ink: '#0E1418',
    level: 1, mastered: false, recall: 0.91, ownerNo: 377, earnedAt: '2026-10-03',
    lyrics: [
      ['{波|なみ}の{音|おと}を{聞|き}く', '파도 소리를 들어'],
      ['{遠|とお}い{水平線|すいへいせん}へ', '먼 수평선으로'],
      ['{涙|なみだ}を{流|なが}してく', '눈물을 흘려보내'],
      ['{誰|だれ}かの{優|やさ}しさに', '누군가의 다정함에'],
      ['{明日|あした}を{信|しん}じて', '내일을 믿고'],
    ],
    pick: [1, 2],
    words: [w('遠い', 'とおい', '멀다'), w('水平線', 'すいへいせん', '수평선'), w('涙', 'なみだ', '눈물'), w('流す', 'ながす', '흘리다')],
    nextGoal: { label: '따라 부르기까지', current: 11, total: 20 },
  },
  {
    id: 'kaibutsu', songId: null, title: '怪物', artist: 'YOASOBI',
    artworkUrl: unsplash('1543276169-235d78f9d79e'), accent: '#E04848', ink: '#1C0A0A',
    level: 1, mastered: false, recall: 0.55, ownerNo: 2033, earnedAt: '2026-07-19',
    lyrics: [
      ['{夜|よる}の{街|まち}を{見下|みお}ろす', '밤거리를 내려다봐'],
      ['{牙|きば}を{隠|かく}したまま', '송곳니를 숨긴 채'],
      ['{正|ただ}しさを{問|と}う', '옳음을 물어'],
      ['{本当|ほんとう}の{僕|ぼく}は{誰|だれ}', '진짜 나는 누구'],
      ['{守|まも}りたいものがある', '지키고 싶은 게 있어'],
    ],
    pick: [1, 2],
    words: [w('牙', 'きば', '송곳니'), w('隠す', 'かくす', '숨기다'), w('正しい', 'ただしい', '옳다'), w('問う', 'とう', '묻다')],
    nextGoal: { label: '따라 부르기까지', current: 16, total: 28 },
  },
];

const SONG_LYRICS: Record<string, CardLyricLine[]> = Object.fromEntries(
  seeds.map((seed) => [seed.id, seed.lyrics.map(([source, ko], index) => ({ index, ruby: ruby(source), ko }))]),
);

export const DUMMY_SONG_CARDS: SongRewardCard[] = seeds.map(({ lyrics: _lyrics, pick, ...card }) => ({
  ...card,
  lyric: SONG_LYRICS[card.id].filter((line) => pick.includes(line.index)),
  signature: null,
}));

/** 카드 곡의 가사 전체. 실제로는 곡 가사 API 에서 받는다. */
export function findDummyLyrics(cardId: string): CardLyricLine[] {
  return SONG_LYRICS[cardId] ?? [];
}

const ARTIST_PHOTOS = [
  '1693240817505-f59d02b89ef9', '1670960763844-10278a725ac7', '1528818955841-a7f1425131b5',
  '1711750058162-29035a3b61a8', '1728734719929-2536485e280b', '1761503030918-533edb8d48c6',
  '1662920390866-33410f637e72', '1615754890640-1b07ac20cdbc',
];

type ArtistSeed = Omit<ArtistRewardCard, 'id' | 'imageUrl' | 'masteredSongs'> & {
  covers: MasteredSong[];
  gradeSamples?: boolean;
  titles?: string[];
  imageUrl?: string;
};

// 재질 여섯 단계가 모두 보이도록 마스터 곡 수를 골랐다.
const artistSeeds: ArtistSeed[] = [
  {
    imageUrl: appleArtwork('Music112/v4/ae/7c/f4/ae7cf4d1-a006-162c-3d0b-6b2b8c2175e1/4511820-95529.jpg'),
    // 같은 아티스트로 재질을 비교하려고 재질마다 한 장씩 만든다.
    gradeSamples: true,
    titles: [
      '悔やむと書いてミライ', '限りなく灰色へ', 'カトラリー', 'ジャックポットサッドガール', 'ロウワー', '携帯恋話',
      'ジャンキーナイトタウンオーケストラ', 'ヴァンパイア', '君の夜をくれ', 'シネマ', '劣等上等', 'アイディスマイル',
      'バグ', '化けの花', 'ザムザ',
    ],
    name: '25時、ナイトコードで。', accent: '#B07AE8', ink: '#110A1C', masteredCount: 1, fanNo: 764, since: '2026-08-11',
    covers: [
      cover('ザムザ', 'Music126/v4/dc/75/73/dc75730f-d84b-3c77-dba8-3e070bc66937/4511820-96201.jpg'),
    ],
  },  {
    titles: ['アイネクライネ', 'サンタマリア', 'ドーナツホール', 'アンビリーバーズ', 'LOSER', 'ピースサイン', 'orion', '打上花火', '灰色と青', 'Lemon', 'Flamingo', 'TEENAGE RIOT', '海の幽霊', 'パプリカ', 'カナリヤ', 'Pale Blue', '死神', 'M八七', 'Paper Flower', '月を見ていた', 'LADY', 'がらくた', 'Azalea', 'BOW AND ARROW', 'Plazma', '毎日', '馬と鹿', '感電', '地球儀', 'KICK BACK', 'さよーならまたいつか！'],
    name: '米津玄師', accent: '#E8C547', ink: '#1A1206', masteredCount: 31, fanNo: 47, since: '2025-03-02',
    covers: [
      cover('さよーならまたいつか！', 'Music221/v4/3e/b2/13/3eb21367-be26-2634-d90f-bc8182d3d0b2/4547366699760.jpg'),
      cover('KICK BACK', 'Music122/v4/4e/a8/75/4ea875d1-bdb6-9b83-185a-646391cbffbd/4547366589849.jpg'),
      cover('地球儀', 'Music116/v4/45/5a/c9/455ac9fc-e38b-09c2-7e8f-79beeca04375/4547366634242.jpg'),
      cover('感電', 'Music124/v4/6b/0f/0b/6b0f0b3d-e842-5ee1-83a8-1b12142a9dfd/dj.bpfbtyiy.jpg'),
      cover('馬と鹿', 'Music124/v4/5f/8b/86/5f8b86ec-5ee5-fe35-5691-6a63951039a5/jacket_SECL02497B00Z_550.jpg'),
    ],
  },
  {
    titles: ['夜に駆ける', 'あの夢をなぞって', 'ハルジオン', 'たぶん', '群青', 'ハルカ', '怪物', '優しい彗星', '三原色', 'もう少しだけ', 'ツバメ', '大正浪漫', '祝福', '海のまにまに', 'セブンティーン', 'アイドル'],
    name: 'YOASOBI', accent: '#7FB8FF', ink: '#0B1020', masteredCount: 16, fanNo: 312, since: '2025-06-14',
    covers: [
      cover('祝福', 'Music122/v4/5c/45/a9/5c45a9cf-678a-a945-3544-923382e5d1c4/197186993001.jpg'),
      cover('ハルカ', 'Music125/v4/6f/92/2d/6f922d2d-735d-59bd-00a0-d845371bb99c/195497666263.jpg'),
      cover('たぶん', 'Music124/v4/bf/1c/3b/bf1c3bdd-a128-2843-776a-35bf3c879d98/195081850498.jpg'),
      cover('優しい彗星', 'Music124/v4/fc/2a/2a/fc2a2ae6-f971-0b82-efe7-fad4981efe68/195497842889.jpg'),
      cover('ツバメ', 'Music125/v4/5a/66/8d/5a668da4-c94d-b208-19cd-8bc649f725e2/196292629439.jpg'),
    ],
  },
  {
    titles: ['Prayer X', '白日', '飛行艇', '傘', 'Teenager Forever', '三文小説', '一途', 'SPECIALZ'],
    name: 'King Gnu', accent: '#E06A4F', ink: '#170A08', masteredCount: 8, fanNo: 1180, since: '2025-11-20',
    covers: [
      cover('SPECIALZ', 'Music116/v4/aa/33/55/aa335541-9932-d73c-6b1e-62bd484fc83d/4547366642308.jpg'),
      cover('一途', 'Music211/v4/64/d7/73/64d77339-d682-5903-611f-cf59ab928750/4547366542400.jpg'),
      cover('逆夢', 'Music211/v4/c6/17/d9/c617d968-ed91-81c0-8a2a-1dc4edb46110/4547366544121.jpg'),
      cover('カメレオン', 'Music116/v4/28/5e/6a/285e6aab-fb7d-aca7-2cd0-7d0502cabdde/4547366552881.jpg'),
      cover('三文小説', 'Music125/v4/f0/52/0e/f0520ec1-755a-2bea-c478-2b2d24a5f445/4547366480252.jpg'),
    ],
  },
  {
    name: 'あいみょん', accent: '#F2A65A', ink: '#1C1008', masteredCount: 4, fanNo: 902, since: '2026-02-08',
    covers: [
      cover('裸の心', 'Music124/v4/85/0b/1b/850b1b4c-f529-6828-4b2b-a5a187ec61c6/190295235017.jpg'),
      cover('君はロックを聴かない', 'Music124/v4/d8/7b/7c/d87b7cfd-c88c-1003-bc5d-883882043e33/190295747138.jpg'),
      cover('愛を伝えたいだとか', 'Music122/v4/33/bb/26/33bb26ea-d33e-10da-448d-e592d540b1d2/190295821067.jpg'),
      cover('ハルノヒ', 'Music114/v4/c6/17/ad/c617ad80-bf5c-64f1-0d52-f19cb1c04efd/190295450946.jpg'),
    ],
  },
  {
    name: 'Vaundy', accent: '#8FD16A', ink: '#0B140A', masteredCount: 2, fanNo: 655, since: '2026-05-30',
    covers: [
      cover('踊り子', 'Music126/v4/f1/cd/f7/f1cdf773-5dca-3d6d-6c14-2fb9871a83a9/197189838330.jpg'),
      cover('花占い', 'Music116/v4/18/71/31/1871315a-3e07-b5a1-e19d-2e404ff73c0b/197189907494.jpg'),
    ],
  },

  {
    name: 'back number', accent: '#6FA8C8', ink: '#08121A', masteredCount: 0, fanNo: 1437, since: '2026-09-27',
    covers: [],
  },
  {
    name: 'tuki.', accent: '#E6849B', ink: '#1A0A0F', masteredCount: 0, fanNo: 511, since: '2026-09-12',
    covers: [],
  },
];

// 커버·제목이 마스터 곡 수보다 적으면 돌려 쓴다. titles 는 마스터한 순서다.
function artistCard({ covers, titles, gradeSamples: _gradeSamples, ...seed }: ArtistSeed, id: string, photo: string): ArtistRewardCard {
  return {
    id,
    ...seed,
    imageUrl: seed.imageUrl ?? photo,
    masteredSongs: Array.from({ length: seed.masteredCount }, (_, k) => ({
      title: titles ? titles[k % titles.length] : covers[k % covers.length].title,
      artworkUrl: covers[k % covers.length].artworkUrl,
    })),
  };
}

export const DUMMY_ARTIST_CARDS: ArtistRewardCard[] = artistSeeds.flatMap((seed, i) => {
  const photo = unsplash(ARTIST_PHOTOS[i % ARTIST_PHOTOS.length]);
  if (!seed.gradeSamples) return [artistCard(seed, `artist-${i}`, photo)];
  return ARTIST_GRADE_STEPS.map((step) =>
    artistCard({ ...seed, masteredCount: step.from }, `artist-${i}-${step.grade}`, photo),
  );
});

export function findDummyArtistCard(id: string): ArtistRewardCard | undefined {
  return DUMMY_ARTIST_CARDS.find((c) => c.id === id);
}
