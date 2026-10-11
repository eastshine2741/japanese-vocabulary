import { RefObject } from 'react';
import { View } from 'react-native';

/** file uri. story 는 인스타 스토리 등 이미지 공유용, preview 는 랜딩 og:image 로 올린다. */
export interface ShareImages {
  story: string;
  preview: string;
}

// 웹(개발용)은 뷰 캡처가 없어 공유 이미지를 만들지 않는다. 앱은 shareImage.native.ts.
export async function composeShareImages(_cardView: RefObject<View | null>, _name: string, _footer: string): Promise<ShareImages> {
  throw new Error('share image is not supported on web');
}
