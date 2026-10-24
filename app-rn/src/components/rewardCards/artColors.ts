import { useEffect, useMemo, useState } from 'react';
import { backdropFromPixels, paletteFromPixels, type CardColors } from './artPalette';
import { readSavedArtColors, writeSavedArtColors } from './artColorStore';
import { readArtPixels } from './artPixels';

const cache = new Map<string, Promise<CardColors | null>>();
// 색을 뽑으려면 원본 아트를 받아 디코딩해야 해 카드가 많으면 수 초가 걸린다. 뽑은 색은 기기에 남겨 다음엔 바로 그린다.
const saved: Record<string, CardColors> = {};
let savedLoaded: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const WAIT_MS = 2000;

export function loadSavedArtColors(): Promise<void> {
  savedLoaded ??= readSavedArtColors()
    .then((colors) => {
      for (const [uri, c] of Object.entries(colors)) saved[uri] ??= c;
    })
    .catch(() => undefined);
  return savedLoaded;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    loadSavedArtColors().then(() => {
      try {
        writeSavedArtColors(saved);
      } catch {
        // 못 남겨도 다음에 다시 뽑으면 된다.
      }
    });
  }, 1000);
}

export function artColors(uri: string): Promise<CardColors | null> {
  if (!uri) return Promise.resolve(null);
  if (saved[uri]) return Promise.resolve(saved[uri]);
  let colors = cache.get(uri);
  if (!colors) {
    colors = readArtPixels(uri).then(paletteFromPixels).catch(() => null);
    colors.then((c) => {
      if (!c) {
        cache.delete(uri);
        return;
      }
      saved[uri] = c;
      scheduleSave();
    });
    cache.set(uri, colors);
  }
  return colors;
}

/** 남겨 둔 아트 색으로 카드 색을 바꾼다. 아직 못 뽑은 아트면 카드에 있던 id 팔레트 그대로다. */
export function paintSaved<T extends CardColors>(card: T, uri: string): T {
  const colors = saved[uri];
  if (!colors || (colors.accent === card.accent && colors.ink === card.ink)) return card;
  return { ...card, ...colors };
}

/**
 * 남겨 둔 색이 없는 아트에서 색을 뽑는다. 새로 뽑은 색이 있으면 true.
 * 늦는 아트 하나에 나머지가 묶이지 않게 WAIT_MS 까지만 기다린다. 그 뒤에 뽑힌 색은 남겨 뒀다가 다음에 쓴다.
 */
export async function extractArtColors(uris: string[]): Promise<boolean> {
  const missing = [...new Set(uris)].filter((uri) => uri && !saved[uri]);
  if (missing.length === 0) return false;
  await Promise.race([Promise.all(missing.map(artColors)), new Promise((r) => setTimeout(r, WAIT_MS))]);
  return missing.some((uri) => saved[uri] != null);
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
