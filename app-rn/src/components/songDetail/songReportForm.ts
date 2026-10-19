import type { Token } from '../../types/song';
import type {
  SongReportGroup,
  SongReportTypeDto,
  SubmitSongReportRequest,
} from '../../types/songReport';

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
