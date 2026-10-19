// 단어 경계라 `Kis-My-Ft2` 는 그대로 두고, 점 뒤 공백이 없어도(`feat.鏡音リン`) 잡는다. 백엔드 ArtistCredit 과 같은 규칙.
const FEAT = String.raw`\b(?:featuring|feat|ft)\b`;
const BRACKETED_FEAT = new RegExp(String.raw`\s*[(\[（［【]\s*${FEAT}[^)\]）］】]*[)\]）］】]`, 'gi');
const TRAILING_FEAT = new RegExp(String.raw`\s*${FEAT}\.?.*$`, 'i');

/** 카드에선 게스트 표기를 뺀다. `(Remix)` 처럼 곡을 가르는 괄호는 남긴다. */
function withoutFeaturing(text: string): string {
  return text.replace(BRACKETED_FEAT, '').replace(TRAILING_FEAT, '').trim() || text.trim();
}

export const cardTitle = withoutFeaturing;
export const cardArtist = withoutFeaturing;
