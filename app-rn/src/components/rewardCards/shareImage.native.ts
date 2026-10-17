import { RefObject } from 'react';
import { Image, Platform, View, findNodeHandle } from 'react-native';
import {
  ClipOp,
  FilterMode,
  FontWeight,
  ImageFormat,
  MipmapMode,
  SkCanvas,
  SkImage,
  SkTypefaceFontProvider,
  Skia,
  TextAlign,
  makeImageFromView,
} from '@shopify/react-native-skia';
import { FunnelSans_500Medium, FunnelSans_700Bold, FunnelSans_800ExtraBold } from '@expo-google-fonts/funnel-sans';
import { File, Paths } from 'expo-file-system';
import { captureViewPixels } from '../../../modules/view-pixel-copy';
import { APP_PITCH, STORE_SEARCH, shareHook } from '../../services/shareLinks';
import { Colors } from '../../theme/theme';
import { SHOWROOM } from './cardTheme';
import { Box, CARD_CORNER, PREVIEW_H, PREVIEW_W, previewLayout, stickerLayout } from './shareStory';
import type { ShareImages, ShareStoryInfo } from './shareImage';

const APP_ICON = require('../../../assets/icon.png');
const FAMILY = 'FunnelSans';
const INK = '#14171A';
const INK_DIM = '#6B7177';
const INK_FAINT = '#9AA0A6';

// 한글은 Funnel Sans 에 없어 Paragraph 가 같은 굵기의 시스템 고딕으로 대신 그린다 — 앱 화면 글자와 같다.
let fontLoad: Promise<SkTypefaceFontProvider> | null = null;

function loadFonts(): Promise<SkTypefaceFontProvider> {
  fontLoad ??= Promise.all(
    [FunnelSans_500Medium, FunnelSans_700Bold, FunnelSans_800ExtraBold].map((m) => Skia.Data.fromURI(Image.resolveAssetSource(m).uri)),
  )
    .then((data) => {
      const mgr = Skia.TypefaceFontProvider.Make();
      for (const d of data) {
        const face = Skia.Typeface.MakeFreeTypeFaceFromData(d);
        if (!face) throw new Error('font load failed');
        mgr.registerFont(face, FAMILY);
      }
      return mgr;
    })
    .catch((e) => {
      fontLoad = null;
      throw e;
    });
  return fontLoad;
}

async function loadImage(uri: string | null): Promise<SkImage | null> {
  if (!uri) return null;
  try {
    return Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  } catch {
    return null;
  }
}

interface TextStyle {
  size: number;
  color: string;
  weight: FontWeight;
  align?: TextAlign;
}

function paragraph(fonts: SkTypefaceFontProvider, text: string, width: number, { size, color, weight, align = TextAlign.Left }: TextStyle) {
  const p = Skia.ParagraphBuilder.Make({ textAlign: align, maxLines: 1, ellipsis: '…' }, fonts)
    .pushStyle({ color: Skia.Color(color), fontFamilies: [FAMILY], fontSize: size, fontStyle: { weight } })
    .addText(text)
    .build();
  p.layout(width);
  return p;
}

function drawText(
  canvas: SkCanvas,
  fonts: SkTypefaceFontProvider,
  text: string,
  slot: { x: number; y: number; size: number; width: number },
  style: Omit<TextStyle, 'size'>,
) {
  // 오른쪽 정렬 칸은 x 가 오른쪽 끝이다.
  const x = style.align === TextAlign.Right ? slot.x - slot.width : slot.x;
  paragraph(fonts, text, slot.width, { ...style, size: slot.size }).paint(canvas, x, slot.y);
}

function drawImage(canvas: SkCanvas, image: SkImage, dst: Box, cover = false) {
  const w = image.width();
  const h = image.height();
  const side = Math.min(w, h);
  const src = cover ? Skia.XYWHRect((w - side) / 2, (h - side) / 2, side, side) : Skia.XYWHRect(0, 0, w, h);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  canvas.drawImageRectOptions(image, src, Skia.XYWHRect(dst.x, dst.y, dst.width, dst.height), FilterMode.Linear, MipmapMode.Linear, paint);
}

// 캡처는 카드 모서리 밖 배경까지 담는다.
function drawCard(canvas: SkCanvas, card: SkImage, dst: Box, kind: ShareStoryInfo['kind']) {
  canvas.save();
  clipRound(canvas, dst, dst.width * CARD_CORNER[kind]);
  drawImage(canvas, card, dst);
  canvas.restore();
}

function clipRound(canvas: SkCanvas, box: Box, radius: number) {
  canvas.clipRRect(Skia.RRectXY(Skia.XYWHRect(box.x, box.y, box.width, box.height), radius, radius), ClipOp.Intersect, true);
}

function drawAvatar(canvas: SkCanvas, fonts: SkTypefaceFontProvider, name: string, avatar: SkImage | null, box: Box) {
  canvas.save();
  clipRound(canvas, box, box.width / 2);
  if (avatar) {
    drawImage(canvas, avatar, box, true);
  } else {
    canvas.drawColor(Skia.Color(Colors.primaryBg));
    const initial = paragraph(fonts, name.slice(0, 1), box.width, {
      size: box.width * 0.44,
      color: Colors.primary,
      weight: FontWeight.Bold,
      align: TextAlign.Center,
    });
    initial.paint(canvas, box.x, box.y + (box.height - initial.getHeight()) / 2);
  }
  canvas.restore();
}

/** bg 가 없으면 투명 바탕이다. */
function render(width: number, height: number, bg: string | null, draw: (canvas: SkCanvas) => void, fileName: string): string {
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (!surface) throw new Error('surface failed');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color(bg ?? '#00000000'));
  draw(canvas);
  surface.flush();
  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100);
  const file = new File(Paths.cache, fileName);
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

/**
 * 화면에 보이는 카드를 그대로 떠 PNG base64 로 준다. 위를 가리는 것(공유 시트 등)이 없을 때 부른다.
 * Android 는 뷰를 다시 그리는 캡처(Skia makeImageFromView·view-shot)가 클립·투명도를 놓쳐 숨은 뒷면 Skia 글자나 아티스트 사진이
 * 맨 위에 덧그려지므로 창 픽셀을 복사한다. iOS makeImageFromView 는 화면 합성 결과(drawViewHierarchyInRect)라 그대로 쓴다.
 * 모서리 밖 배경도 찍히니 합성 때 카드 반경으로 자른다.
 */
export async function captureCard(cardView: RefObject<View | null>): Promise<string> {
  if (Platform.OS === 'android') {
    const tag = findNodeHandle(cardView.current);
    if (tag == null) throw new Error('card view not mounted');
    return captureViewPixels(tag);
  }
  const image = await makeImageFromView(cardView as RefObject<View>);
  if (!image) throw new Error('card capture failed');
  return image.encodeToBase64(ImageFormat.PNG, 100);
}

/** 떠 둔 카드로 스토리 스티커(투명 바탕 패널)와 링크 미리보기(1.91:1) PNG 를 캐시에 쓴다. */
export async function composeShareImages(captured: string, fileName: string, info: ShareStoryInfo): Promise<ShareImages> {
  const [fonts, avatar, icon] = await Promise.all([
    loadFonts(),
    loadImage(info.profileImageUrl),
    loadImage(Image.resolveAssetSource(APP_ICON).uri),
  ]);
  const card = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(captured));
  if (!card) throw new Error('card capture failed');

  const l = stickerLayout(card.width(), card.height());
  const sticker = render(Math.ceil(l.width), Math.ceil(l.height), null, (canvas) => {
    const panel = Skia.Paint();
    panel.setColor(Skia.Color('#FFFFFF'));
    panel.setAntiAlias(true);
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(0, 0, l.width, l.height), l.radius, l.radius), panel);

    drawAvatar(canvas, fonts, info.name, avatar, l.avatar);
    drawText(canvas, fonts, info.name, l.name, { color: INK, weight: FontWeight.Bold });
    drawText(canvas, fonts, info.kind === 'song' ? '곡 카드를 얻었어요' : '아티스트 카드를 얻었어요', l.caption, {
      color: INK_DIM,
      weight: FontWeight.Medium,
    });
    if (icon) {
      canvas.save();
      clipRound(canvas, l.icon, l.icon.width * 0.24);
      drawImage(canvas, icon, l.icon);
      canvas.restore();
    }

    drawCard(canvas, card, l.card, info.kind);

    drawText(canvas, fonts, shareHook(info.kind), l.tagline, { color: INK, weight: FontWeight.Bold });
    drawText(canvas, fonts, STORE_SEARCH, l.stores, { color: INK_FAINT, weight: FontWeight.Medium });
    drawText(canvas, fonts, 'Kotonoha', l.brand, { color: Colors.primary, weight: FontWeight.ExtraBold, align: TextAlign.Right });
    drawText(canvas, fonts, APP_PITCH, l.pitch, { color: INK_DIM, weight: FontWeight.Medium, align: TextAlign.Right });
  }, `${fileName}-sticker.png`);
  const preview = render(PREVIEW_W, PREVIEW_H, SHOWROOM.bg, (canvas) => {
    drawCard(canvas, card, previewLayout(card.width(), card.height()), info.kind);
  }, `${fileName}-preview.png`);
  return { sticker, preview };
}
