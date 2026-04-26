const errorMessages: Record<string, string> = {
  // Auth
  DUPLICATE_NAME: '이미 사용 중인 이름이에요.',
  INVALID_CREDENTIALS: '이름 또는 비밀번호가 올바르지 않아요.',

  // Song / Lyrics
  LYRICS_NOT_FOUND: '이 노래의 가사를 찾을 수 없었어요.',
  SONG_NOT_FOUND: '노래를 찾을 수 없었어요.',

  // Word
  WORD_NOT_FOUND: '단어를 찾을 수 없었어요.',
  MEANING_REQUIRED: '뜻을 하나 이상 입력해 주세요.',
  INVALID_EXAMPLES: '일부 예문이 이 단어에 속하지 않아요.',

  // Flashcard
  FLASHCARD_NOT_FOUND: '플래시카드를 찾을 수 없었어요.',
  INVALID_RATING: '올바르지 않은 평가 값이에요.',

  // Dictionary
  DEFINITION_NOT_FOUND: '사전에서 뜻을 찾을 수 없었어요.',

  // Common
  FORBIDDEN: '접근 권한이 없어요.',
};

const DEFAULT_MESSAGE = '알 수 없는 오류가 발생했어요.';

export function getErrorMessage(errorCode: string | null | undefined): string {
  if (!errorCode) return DEFAULT_MESSAGE;
  return errorMessages[errorCode] ?? DEFAULT_MESSAGE;
}
