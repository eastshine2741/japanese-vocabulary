// 웹(개발용)엔 인스타 스토리로 보낼 길이 없다. 앱은 instagramStory.native.ts.
export const instagramStorySupported = false;

export async function isInstagramInstalled(): Promise<boolean> {
  return false;
}

export async function shareToInstagramStory(_backgroundImage: string, _linkUrl: string): Promise<void> {
  throw new Error('instagram story is not supported on web');
}
