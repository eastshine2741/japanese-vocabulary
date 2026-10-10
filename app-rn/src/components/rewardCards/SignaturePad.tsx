import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { SIGNATURE_INK, SIGNATURE_PAPER } from './SignatureField';
import {
  CardSignature,
  SIGNATURE_BOX,
  SIGNATURE_STROKE,
  SIGNATURE_VIEW_BOX,
  SignaturePoint,
  shouldAddPoint,
  strokePath,
  toSignaturePoint,
} from './signature';

interface Props {
  strokes: CardSignature;
  /** 그리는 중인 획까지. 손가락이 움직일 때마다 불린다. */
  onDraw: (live: string | null) => void;
  /** 손을 떼서 획 하나가 끝났을 때. */
  onStroke: (stroke: string) => void;
}

/** 카드 서명 칸과 같은 3:1 종이. 같은 좌표계라 여기 그린 그대로 카드에 줄어 찍힌다. */
function SignaturePad({ strokes, onDraw, onStroke }: Props) {
  const [width, setWidth] = useState(0);
  const [live, setLive] = useState<string | null>(null);
  const points = useRef<SignaturePoint[]>([]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  const gesture = useMemo(() => {
    const draw = () => {
      const d = strokePath(points.current);
      setLive(d);
      onDraw(d);
    };
    const finish = () => {
      if (points.current.length === 0) return;
      const d = strokePath(points.current);
      points.current = [];
      setLive(null);
      onDraw(null);
      onStroke(d);
    };
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .enabled(width > 0)
      .onBegin((e) => {
        points.current = [toSignaturePoint(e.x, e.y, width)];
        draw();
      })
      .onUpdate((e) => {
        const p = toSignaturePoint(e.x, e.y, width);
        if (!shouldAddPoint(points.current, p)) return;
        points.current.push(p);
        draw();
      })
      .onFinalize(finish);
  }, [width, onDraw, onStroke]);

  return (
    <GestureDetector gesture={gesture}>
      <View onLayout={handleLayout} style={styles.paper}>
        {width > 0 ? (
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox={SIGNATURE_VIEW_BOX}>
            {strokes.map((d, i) => (
              <Path key={i} d={d} {...STROKE_PROPS} />
            ))}
            {live ? <Path d={live} {...STROKE_PROPS} /> : null}
          </Svg>
        ) : null}
      </View>
    </GestureDetector>
  );
}

export default React.memo(SignaturePad);

const STROKE_PROPS = {
  stroke: SIGNATURE_INK,
  strokeWidth: SIGNATURE_STROKE,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

const styles = StyleSheet.create({
  paper: {
    aspectRatio: SIGNATURE_BOX.width / SIGNATURE_BOX.height,
    borderRadius: 14,
    backgroundColor: SIGNATURE_PAPER,
    overflow: 'hidden',
  },
});
