import { Colors } from '../theme/theme';

export const POS_INFO: Record<string, { korean: string; color: string }> = {
  NOUN: { korean: '명사', color: Colors.posNoun },
  VERB: { korean: '동사', color: Colors.posVerb },
  ADJECTIVE: { korean: '형용사', color: Colors.posAdjective },
  NA_ADJECTIVE: { korean: '형용동사', color: Colors.posAdjective },
  ADVERB: { korean: '부사', color: Colors.posAdverb },
  PRONOUN: { korean: '대명사', color: Colors.posNoun },
  ADNOMINAL: { korean: '연체사', color: Colors.posNoun },
  CONJUNCTION: { korean: '접속사', color: Colors.posNoun },
  AUXILIARY_VERB: { korean: '조동사', color: Colors.posVerb },
  PARTICLE: { korean: '조사', color: Colors.posParticle },
  INTERJECTION: { korean: '감동사', color: Colors.posNoun },
  PREFIX: { korean: '접두사', color: Colors.posNoun },
  SUFFIX: { korean: '접미사', color: Colors.posNoun },
  SYMBOL: { korean: '기호', color: Colors.textMuted },
  SUPPLEMENTARY_SYMBOL: { korean: '보조기호', color: Colors.textMuted },
  WHITESPACE: { korean: '공백', color: Colors.textMuted },
};

export const POS_PICKER_KEYS = [
  'NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB',
  'PRONOUN', 'ADNOMINAL', 'CONJUNCTION', 'AUXILIARY_VERB',
  'PARTICLE', 'INTERJECTION', 'PREFIX', 'SUFFIX',
] as const;

export const POS_OPTIONS = POS_PICKER_KEYS.map((key) => ({
  key,
  label: POS_INFO[key].korean,
  color: POS_INFO[key].color,
}));

export function getPosLabel(pos: string): string {
  return POS_INFO[pos]?.korean ?? pos;
}

export function getPosColor(pos: string): string {
  return POS_INFO[pos]?.color ?? Colors.textMuted;
}
