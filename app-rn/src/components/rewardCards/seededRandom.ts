/** 같은 카드는 늘 같은 흠집이 나도록 id 로 시드를 고정한다. */
export function seededRandom(seedText: string): () => number {
  let s = 0;
  for (let i = 0; i < seedText.length; i++) s = (s * 31 + seedText.charCodeAt(i)) % 2147483647;
  s = s || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}
