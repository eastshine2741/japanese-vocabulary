import { Linking, Platform } from 'react-native';
import Share, { Social } from 'react-native-share';

/** Meta 앱 id. 인스타가 source_application 으로 요구하는 공개 값이라 코드에 둔다. */
const FACEBOOK_APP_ID = '1530136869146287';

export const instagramStorySupported = true;

// iOS 는 LSApplicationQueriesSchemes, Android 는 manifest queries 에 등록돼 있어야 답이 맞다(app.config.js).
export async function isInstagramInstalled(): Promise<boolean> {
  if (Platform.OS === 'android') return (await Share.isPackageInstalled('com.instagram.android')).isInstalled;
  return Linking.canOpenURL('instagram-stories://share');
}

/** 스토리 편집 화면을 이미지 배경으로 연다. linkUrl 은 링크 스티커 키로 넘기지만 인스타가 받아 줄지는 보장되지 않는다. */
export async function shareToInstagramStory(backgroundImage: string, linkUrl: string): Promise<void> {
  await Share.shareSingle({
    social: Social.InstagramStories,
    appId: FACEBOOK_APP_ID,
    backgroundImage,
    linkUrl,
  });
}
