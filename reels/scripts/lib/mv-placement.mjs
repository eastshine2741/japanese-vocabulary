// PromoReel.tsx 의 MV 배치(mvLayer·mvSlot·framedVideoStyle·cropStyle)를 ffmpeg 좌표로 옮긴다. 두 쪽을 같이 고친다.
const PROMO_WIDTH = 1080;
const PROMO_HEIGHT = 1920;
const HEADLINE_BAND_HEIGHT = 580;
const MV_AREA_BOTTOM = 1560;

const LAYER = {x: 0, y: HEADLINE_BAND_HEIGHT, w: PROMO_WIDTH, h: PROMO_HEIGHT - HEADLINE_BAND_HEIGHT};
const SLOT = {x: 0, y: HEADLINE_BAND_HEIGHT, w: PROMO_WIDTH, h: MV_AREA_BOTTOM - HEADLINE_BAND_HEIGHT};

/**
 * 캔버스에 실제로 보이는 MV 조각만 남긴다: 디코더 crop(원본 px, top x bottom x left x right)과 캔버스 위 자리.
 * 화면 밖으로 나간 부분을 디코더에서 먼저 떼어 overlay 좌표가 늘 캔버스 안에 있게 한다. MV 가 안 보이면 null.
 * yuv420p 라 모든 값은 짝수로 맞춘다 — 원본 1px 안팎의 어긋남이 생길 수 있다.
 */
export function mvPlacement({source, mvFrame}) {
  const crop = mvFrame?.crop ?? {top: 0, right: 0, bottom: 0, left: 0};
  const src = {
    x: source.width * crop.left,
    y: source.height * crop.top,
    w: source.width * (1 - crop.left - crop.right),
    h: source.height * (1 - crop.top - crop.bottom),
  };

  let rect;
  let clip;
  if (mvFrame) {
    const w = PROMO_WIDTH * mvFrame.scale;
    const h = (w * src.h) / src.w;
    rect = {x: SLOT.x + SLOT.w / 2 + mvFrame.x - w / 2, y: SLOT.y + SLOT.h / 2 + mvFrame.y - h / 2, w, h};
    clip = LAYER;
  } else {
    // mvFrame 이 없으면 mvSlot 을 object-fit: cover 로 채우고 slot 밖은 잘린다.
    const scale = Math.max(SLOT.w / src.w, SLOT.h / src.h);
    const w = src.w * scale;
    const h = src.h * scale;
    rect = {x: SLOT.x + (SLOT.w - w) / 2, y: SLOT.y + (SLOT.h - h) / 2, w, h};
    clip = SLOT;
  }

  const visible = intersect(rect, clip);
  if (!visible) return null;

  const toSourceX = (canvasX) => src.x + ((canvasX - rect.x) / rect.w) * src.w;
  const toSourceY = (canvasY) => src.y + ((canvasY - rect.y) / rect.h) * src.h;
  const top = even(toSourceY(visible.y));
  const left = even(toSourceX(visible.x));
  const bottom = even(source.height - toSourceY(visible.y + visible.h));
  const right = even(source.width - toSourceX(visible.x + visible.w));

  const x = even(visible.x);
  const y = even(visible.y);
  return {
    decoderCrop: `${top}x${bottom}x${left}x${right}`,
    x,
    y,
    width: evenFloor(Math.min(visible.w, PROMO_WIDTH - x)),
    height: evenFloor(Math.min(visible.h, PROMO_HEIGHT - y)),
  };
}

function intersect(a, b) {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
}

const even = (value) => Math.max(0, 2 * Math.round(value / 2));
const evenFloor = (value) => Math.max(2, 2 * Math.floor(value / 2));
