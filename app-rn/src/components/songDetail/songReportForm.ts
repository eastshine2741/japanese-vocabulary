import type { Token } from '../../types/song';
import type {
  SongReportGroup,
  SongReportTypeDto,
  SubmitSongReportRequest,
} from '../../types/songReport';

const KANJI_RE = /[一-鿿]/;

/** 서버 `SongReportService.MAX_SUGGESTION_LENGTH` 와 같은 값. */
export const SONG_REPORT_SUGGESTION_MAX = 1000;

export interface SongReportTokenChoice {
  key: string;
  surface: string;
  charStart: number;
  charEnd: number;
}

export function selectSongReportTypes(
  types: SongReportTypeDto[],
  group: SongReportGroup,
): SongReportTypeDto[] {
  return types.filter(type => type.group === group);
}

/** 서버는 제보 시점의 토큰 오프셋으로 위치를 찾으므로, 가사 줄이 준 오프셋을 그대로 돌려보낸다. */
export function buildSongReportTokenChoices(tokens: Token[] | undefined): SongReportTokenChoice[] {
  return (tokens ?? [])
    .filter(token => token.surface.trim().length > 0)
    .map(token => ({
      key: `${token.charStart}-${token.charEnd}`,
      surface: token.surface,
      charStart: token.charStart,
      charEnd: token.charEnd,
    }));
}

/** 제보 유형마다 가사 줄에서 보여줄 것. 모르는 유형은 원문과 번역을 함께 보여준다. */
export type SongReportLineFocus = 'ORIGINAL' | 'READING' | 'TRANSLATION' | 'MEANING' | 'SEGMENTS';

const LINE_FOCUS_BY_TYPE: Record<string, SongReportLineFocus> = {
  LYRIC_TEXT: 'ORIGINAL',
  FURIGANA: 'READING',
  TRANSLATION: 'TRANSLATION',
  WORD_MEANING: 'MEANING',
  SEGMENTATION: 'SEGMENTS',
};

export function songReportLineFocus(type: string | null | undefined): SongReportLineFocus {
  return (type != null ? LINE_FOCUS_BY_TYPE[type] : undefined) ?? 'TRANSLATION';
}

/** 가나만 있는 단어는 후리가나가 달리지 않으니 발음 제보에서 고를 수 없다. */
export function selectSongReportTokenChoices(
  choices: SongReportTokenChoice[],
  type: string | null | undefined,
): SongReportTokenChoice[] {
  if (songReportLineFocus(type) !== 'READING') return choices;
  return choices.filter(choice => KANJI_RE.test(choice.surface));
}

export function canSubmitSongReport(
  type: SongReportTypeDto | null,
  token: SongReportTokenChoice | null,
  suggestion: string,
): boolean {
  if (type == null) return false;
  if (type.targetKind === 'LINE_TOKEN' && token == null) return false;
  if (type.suggestionRequired && suggestion.trim().length === 0) return false;
  return true;
}

export function buildSongReportRequest(
  type: SongReportTypeDto,
  suggestion: string,
  lineIndex: number | null,
  token: SongReportTokenChoice | null,
): SubmitSongReportRequest {
  const request: SubmitSongReportRequest = { type: type.type };
  if (type.targetKind === 'LINE' && lineIndex != null) {
    request.target = { lineIndex };
  }
  if (type.targetKind === 'LINE_TOKEN' && lineIndex != null && token != null) {
    request.target = { lineIndex, charStart: token.charStart, charEnd: token.charEnd };
  }
  const trimmed = suggestion.trim();
  if (trimmed.length > 0) request.suggestion = trimmed;
  return request;
}
