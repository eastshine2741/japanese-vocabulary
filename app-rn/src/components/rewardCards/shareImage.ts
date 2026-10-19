import { RefObject } from 'react';
import { View } from 'react-native';

/** file uri. sticker 는 인스타 스토리에 얹는 투명 바탕 패널, preview 는 랜딩 og:image 로 올린다. */
export interface ShareImages {
  sticker: string;
  preview: string;
}

/** 스토리 스티커 머리줄. 카드 주인(나)과 카드 종류. */
export interface ShareStoryInfo {
  name: string;
  profileImageUrl: string | null;
  kind: 'song' | 'artist';
}

// 웹(개발용)은 뷰 캡처가 없어 공유 이미지를 만들지 않는다. 앱은 shareImage.native.ts.
export async function captureCard(_cardView: RefObject<View | null>): Promise<string> {
  throw new Error('card capture is not supported on web');
}

export async function composeShareImages(_captured: string, _fileName: string, _info: ShareStoryInfo): Promise<ShareImages> {
  throw new Error('share image is not supported on web');
}
