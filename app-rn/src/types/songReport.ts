export type SongReportGroup = 'LYRIC_LINE' | 'MV';

export type SongReportTargetKind = 'NONE' | 'LINE' | 'LINE_TOKEN';

/** 유형 목록은 서버 enum `SongReportType` 이 소유한다. 앱은 받은 순서대로 보여준다. */
export interface SongReportTypeDto {
  type: string;
  group: SongReportGroup;
  label: string;
  targetKind: SongReportTargetKind;
  suggestionRequired: boolean;
  tokenPrompt: string | null;
  suggestionPlaceholder: string;
}

export interface SongReportTargetRequest {
  lineIndex?: number;
  charStart?: number;
  charEnd?: number;
}

export interface SubmitSongReportRequest {
  type: string;
  target?: SongReportTargetRequest;
  suggestion?: string;
}

export interface SubmitSongReportResponse {
  id: number;
  status: string;
}

export interface SongContributor {
  userId: number;
  username: string;
  name: string | null;
}

export interface SongContributorsDto {
  count: number;
  contributors: SongContributor[];
}
