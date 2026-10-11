import type { SharedRewardCardDto } from '../types/rewardCard';

/** 서버 RewardCardLandingPage.DATA_ELEMENT_ID 와 맞춘다. */
const DATA_ELEMENT_ID = 'kotonoha-share';

export interface ShareWebData {
  card: SharedRewardCardDto;
  appUrl: string;
  iosAppStoreUrl: string;
  androidPlayUrl: string;
}

export function parseShareWebData(json: string | null | undefined): ShareWebData | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json) as ShareWebData;
    return data?.card && (data.card.songCard || data.card.artistCard) ? data : null;
  } catch {
    return null;
  }
}

export function readShareWebData(): ShareWebData | null {
  if (typeof document === 'undefined') return null;
  return parseShareWebData(document.getElementById(DATA_ELEMENT_ID)?.textContent);
}

export function storeOf(userAgent: string): 'ios' | 'android' | null {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return null;
}
