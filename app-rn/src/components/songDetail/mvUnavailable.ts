import type { MvUnavailableReason } from '../../types/song';

/** 플레이어 오류만 났고 서버도 이유를 모를 때. 임베드 플레이어는 연령 제한·삭제를 같은 오류(150)로 알려 줘 구분이 안 된다. */
export type MvBlock = MvUnavailableReason | 'PLAYER_ERROR';

export function mvBlock(serverReason: MvUnavailableReason | null | undefined, playerFailed: boolean): MvBlock | null {
  if (serverReason) return serverReason;
  return playerFailed ? 'PLAYER_ERROR' : null;
}

export function mvBlockLabel(block: MvBlock): string {
  switch (block) {
    case 'AGE_RESTRICTED':
      return '연령 제한 영상';
    case 'UNAVAILABLE':
      return '삭제됐거나 볼 수 없는 영상이에요';
    case 'PLAYER_ERROR':
      return '재생할 수 없는 영상이에요';
  }
}

/** 연령 제한 영상은 YouTube 에서 로그인하면 볼 수 있다. 나머지는 열어도 못 본다. */
export function canWatchOnYoutube(block: MvBlock): boolean {
  return block === 'AGE_RESTRICTED';
}
