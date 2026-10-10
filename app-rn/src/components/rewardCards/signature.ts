/** 서명 좌표계. 카드 서명 칸이 이 3:1 비율로 서명을 줄여 그린다. */
export const SIGNATURE_BOX = { width: 360, height: 120 } as const;
export const SIGNATURE_VIEW_BOX = `0 0 ${SIGNATURE_BOX.width} ${SIGNATURE_BOX.height}`;
export const SIGNATURE_STROKE = 3.2;

/** 획마다 SVG 경로 하나. */
export type CardSignature = string[];
