// 웹(개발용)엔 인스타 스토리로 보낼 길이 없다. 앱은 instagramStory.native.ts.
export const instagramStorySupported = false;

/** 스토리 바탕 그라데이션 위·아래 색(#rrggbb). */
export interface StoryBackdrop {
  top: string;
  bottom: string;
}

export async function isInstagramInstalled(): Promise<boolean> {
  return false;
}

export async function shareToInstagramStory(_stickerImage: string, _linkUrl: string, _backdrop: StoryBackdrop): Promise<void> {
  throw new Error('instagram story is not supported on web');
}
