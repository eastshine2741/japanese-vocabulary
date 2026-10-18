import { useEffect, useMemo, useState } from 'react';
import { backdropFromPixels, paletteFromPixels, type CardColors } from './artPalette';
import { readArtPixels } from './artPixels';

const cache = new Map<string, Promise<CardColors | null>>();
// 아트가 늦게 오면 기다리지 않고 id 팔레트로 그린다. 캐시엔 남아 다음에 다시 받을 때 쓴다.
const WAIT_MS = 2000;

export function artColors(uri: string): Promise<CardColors | null> {
  if (!uri) return Promise.resolve(null);
  let colors = cache.get(uri);
  if (!colors) {
    colors = readArtPixels(uri).then(paletteFromPixels).catch(() => null);
    cache.set(uri, colors);
  }
  return colors;
}

/** 아트에서 뽑은 색으로 카드 색을 바꾼다. 못 뽑으면 카드에 있던 색을 그대로 둔다. */
export async function paintFromArt<T extends CardColors>(card: T, uri: string): Promise<T> {
  const colors = await Promise.race([artColors(uri), new Promise<null>((r) => setTimeout(() => r(null), WAIT_MS))]);
  return colors ? { ...card, ...colors } : card;
}

export function useArtColors<T extends CardColors>(card: T | null, uri: string | undefined): T | null {
  const [colors, setColors] = useState<CardColors | null>(null);
  useEffect(() => {
    let alive = true;
    setColors(null);
    if (uri) artColors(uri).then((c) => alive && setColors(c));
    return () => {
      alive = false;
    };
  }, [uri]);
  return useMemo(() => (card && colors ? { ...card, ...colors } : card), [card, colors]);
}

const backdropCache = new Map<string, Promise<[string, string] | null>>();

/** 아트에서 뽑은 바탕 두 색. 뽑기 전이나 못 뽑으면 null. */
export function useArtBackdrop(uri: string | null | undefined): [string, string] | null {
  const [colors, setColors] = useState<[string, string] | null>(null);
  useEffect(() => {
    let alive = true;
    setColors(null);
    if (!uri) return undefined;
    let pending = backdropCache.get(uri);
    if (!pending) {
      pending = readArtPixels(uri).then(backdropFromPixels).catch(() => null);
      backdropCache.set(uri, pending);
    }
    pending.then((c) => alive && setColors(c));
    return () => {
      alive = false;
    };
  }, [uri]);
  return colors;
}
