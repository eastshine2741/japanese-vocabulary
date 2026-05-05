export const TOS_URL = 'https://eastshine2741.github.io/songish-legal/terms';
export const PRIVACY_URL = 'https://eastshine2741.github.io/songish-legal/privacy';

export const RIGHTSHOLDER_REPORT_EMAIL = 'eastshine200@gmail.com';

export function buildReportMailto(opts?: { songId?: number; songTitle?: string; artist?: string }): string {
  const subjectParts = ['[Songish] 권리자 신고'];
  if (opts?.songId != null) subjectParts.push(`곡 ID ${opts.songId}`);
  const subject = encodeURIComponent(subjectParts.join(' - '));

  const bodyLines: string[] = ['아래 곡의 가사 노출에 대한 신고입니다.', ''];
  if (opts?.songTitle) bodyLines.push(`곡명: ${opts.songTitle}`);
  if (opts?.artist) bodyLines.push(`아티스트: ${opts.artist}`);
  if (opts?.songId != null) bodyLines.push(`곡 ID: ${opts.songId}`);
  bodyLines.push('', '신고 사유:', '');
  const body = encodeURIComponent(bodyLines.join('\n'));

  return `mailto:${RIGHTSHOLDER_REPORT_EMAIL}?subject=${subject}&body=${body}`;
}
