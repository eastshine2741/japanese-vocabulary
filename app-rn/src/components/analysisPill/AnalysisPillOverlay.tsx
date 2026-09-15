import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { GestureResponderHandlers, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useAnalysisStore } from '../../stores/analysisStore';
import { navigate } from '../../navigation/navigationRef';
import { Layers } from '../../theme/layers';
import AnalysisPill, { PILL_HEIGHT } from './AnalysisPill';
import { AnalysisJob, deriveJobPillState, derivePillState } from './pillState';
import { pillDockAfterDrag, shouldStartDockPan } from './pillDockGesture';

// spec/AnalyzingPill (Pencil TN787): 모든 화면 위에 뜨는 분석 상태 pill.
//  - 상단 도킹은 상태바 아래 16, 하단 도킹(기본)은 safe area 바로 위 8. 바텀 내비는 기준으로 삼지 않는다.
//  - 세로로 짧게 끌거나 가볍게 튕기면 반대쪽으로 도킹되고, 놓으면 튕김 없이 자리를 잡는다. 도킹 위치는 기기에 기억.
//  - 2곡 이상이면 탭으로 곡별 pill 로 분해되고, 도킹된 쪽에서 반대 방향으로 자란다.
//    앵커 쪽 pill 은 그 자리에서 첫 곡 pill 로 바뀌고, 나머지는 그 pill 밑에서 빠져나와 제자리로 간다.
//    접을 땐 반대로 앵커 pill 밑으로 들어가 겹쳐진다.
//  - 분석이 실패하면 실패 pill 이 3초 보이고, 탭하면 바로 지워진다. 남은 곡이 있으면 그 상태로 돌아간다.

const BOTTOM_GAP = 16;
const TOP_GAP = 16;
const STACK_GAP = 8;
const SIDE_PADDING = 16;

// mass 를 올려 무게감을 준다. 거의 임계 감쇠(임계값 2√(stiffness·mass) ≈ 42)라 넘치지도, 끝이 늘어지지도 않는다.
const SETTLE_SPRING = { mass: 1.5, stiffness: 300, damping: 41 } as const;

const APPEAR_DURATION = 220;
const APPEAR_EASING = Easing.out(Easing.cubic);
const APPEAR_OFFSET = 16;
// pill 슬롯의 layout 전환. 도킹이 바뀌면 슬롯이 스택 반대 끝으로 점프하는데, 그건 dragY 가 손 놓은 위치에서
// 이어서 스냅하므로 여기서 또 움직이면 원래 자리에서 다시 출발하는 것처럼 보인다. 그 경우만 즉시 적용한다.
const DOCK_JUMP_THRESHOLD = PILL_HEIGHT * 2;
function slotLayout(values: {
  currentOriginX: number; currentOriginY: number; currentWidth: number; currentHeight: number;
  targetOriginX: number; targetOriginY: number; targetWidth: number; targetHeight: number;
}) {
  'worklet';
  const target = {
    originX: values.targetOriginX,
    originY: values.targetOriginY,
    width: values.targetWidth,
    height: values.targetHeight,
  };
  if (Math.abs(values.targetOriginY - values.currentOriginY) > DOCK_JUMP_THRESHOLD) {
    return { initialValues: target, animations: {} };
  }
  const timing = { duration: APPEAR_DURATION, easing: APPEAR_EASING };
  return {
    initialValues: {
      originX: values.currentOriginX,
      originY: values.currentOriginY,
      width: values.currentWidth,
      height: values.currentHeight,
    },
    animations: {
      originX: withTiming(target.originX, timing),
      originY: withTiming(target.originY, timing),
      width: withTiming(target.width, timing),
      height: withTiming(target.height, timing),
    },
  };
}

// 나타날 때는 앵커 쪽에서 살짝 밀려나오며 커지고, 사라질 때는 그 반대. offset 부호가 방향이다.
function pillEntering(offset: number) {
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: offset }, { scale: 0.9 }] },
      animations: {
        opacity: withTiming(1, { duration: APPEAR_DURATION, easing: APPEAR_EASING }),
        transform: [
          { translateY: withTiming(0, { duration: APPEAR_DURATION, easing: APPEAR_EASING }) },
          { scale: withTiming(1, { duration: APPEAR_DURATION, easing: APPEAR_EASING }) },
        ],
      },
    };
  };
}
function pillExiting(offset: number) {
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
      animations: {
        opacity: withTiming(0, { duration: APPEAR_DURATION, easing: APPEAR_EASING }),
        transform: [
          { translateY: withTiming(offset, { duration: APPEAR_DURATION, easing: APPEAR_EASING }) },
          { scale: withTiming(0.9, { duration: APPEAR_DURATION, easing: APPEAR_EASING }) },
        ],
      },
    };
  };
}
const pillMotion = {
  top: { entering: pillEntering(-APPEAR_OFFSET), exiting: pillExiting(-APPEAR_OFFSET) },
  bottom: { entering: pillEntering(APPEAR_OFFSET), exiting: pillExiting(APPEAR_OFFSET) },
} as const;

const SPLIT_DURATION = 320;
const MERGE_DURATION = 220;
const SPLIT_STAGGER = 40;
const SPLIT_EASING = Easing.out(Easing.cubic);
const SPLIT_SCALE = 0.94;
const ANCHOR_Z = 100;

// 분리/합체: 앵커 pill 위치(제자리에서 distance 만큼 앵커 쪽)에서 출발해 제자리로 간다. 앵커 pill 이 위에 겹치므로
// 나오는 동안은 그 밑에서 빠져나오는 것처럼 보인다. 페이드는 없고 살짝 작은 크기에서 시작한다.
function splitEntering(distance: number, order: number) {
  return () => {
    'worklet';
    const timing = { duration: SPLIT_DURATION, easing: SPLIT_EASING };
    return {
      initialValues: { opacity: 1, transform: [{ translateY: distance }, { scale: SPLIT_SCALE }] },
      animations: {
        transform: [
          { translateY: withDelay(order * SPLIT_STAGGER, withTiming(0, timing)) },
          { scale: withDelay(order * SPLIT_STAGGER, withTiming(1, timing)) },
        ],
      },
    };
  };
}
// 합체는 앵커 pill 밑으로 미끄러져 들어간다. 폭이 다른 pill 이 삐져나오지 않게 끝에서 흐려진다.
function mergeExiting(distance: number, order: number) {
  return () => {
    'worklet';
    const timing = { duration: MERGE_DURATION, easing: Easing.in(Easing.quad) };
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
      animations: {
        opacity: withDelay(order * SPLIT_STAGGER, withTiming(0, { duration: MERGE_DURATION, easing: Easing.in(Easing.cubic) })),
        transform: [
          { translateY: withDelay(order * SPLIT_STAGGER, withTiming(distance, timing)) },
          { scale: withDelay(order * SPLIT_STAGGER, withTiming(SPLIT_SCALE, timing)) },
        ],
      },
    };
  };
}

interface PillSlotProps {
  dock: 'top' | 'bottom';
  /** 스택 안 순서. 0 이 앵커 pill 이고, 나머지는 앵커에서 분리되어 나온다. */
  index: number;
  panHandlers: GestureResponderHandlers;
  children: React.ReactNode;
}

function PillSlot({ dock, index, panHandlers, children }: PillSlotProps) {
  const motion = useMemo(() => {
    if (index === 0) return pillMotion[dock];
    // 앵커 pill 중심까지의 거리. 하단 도킹이면 위로 쌓이므로 출발점은 아래(+), 상단 도킹은 반대.
    const distance = index * (PILL_HEIGHT + STACK_GAP) * (dock === 'bottom' ? 1 : -1);
    return { entering: splitEntering(distance, index - 1), exiting: mergeExiting(distance, index - 1) };
  }, [dock, index]);
  // 앵커 pill 이 항상 가장 위. exiting 중인 뷰는 마지막 props 를 유지하므로 count 에 따라 흔들리는 값을 쓰면 안 된다.
  return (
    <Animated.View
      layout={slotLayout}
      entering={motion.entering}
      exiting={motion.exiting}
      style={{ zIndex: ANCHOR_Z - index }}
      {...panHandlers}
    >
      {children}
    </Animated.View>
  );
}

interface JobPillProps {
  job: AnalysisJob;
  dock: 'top' | 'bottom';
  index: number;
  panHandlers: GestureResponderHandlers;
  onOpen: (job: AnalysisJob) => void;
}

function JobPill({ job, dock, index, panHandlers, onOpen }: JobPillProps) {
  const state = useMemo(() => deriveJobPillState(job), [job]);
  const handlePress = useCallback(() => onOpen(job), [job, onOpen]);
  return (
    <PillSlot dock={dock} index={index} panHandlers={panHandlers}>
      <AnalysisPill state={state} onPress={handlePress} />
    </PillSlot>
  );
}

export default function AnalysisPillOverlay() {
  const { jobs, dock, expanded, dismiss, setDock, setExpanded, loadDock } = useAnalysisStore(useShallow(s => ({
    jobs: s.jobs,
    dock: s.dock,
    expanded: s.expanded,
    dismiss: s.dismiss,
    setDock: s.setDock,
    setExpanded: s.setExpanded,
    loadDock: s.loadDock,
  })));
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    loadDock();
  }, [loadDock]);

  const pillState = useMemo(() => derivePillState(jobs), [jobs]);

  const topY = insets.top + TOP_GAP;
  const bottomInset = insets.bottom + BOTTOM_GAP;
  const travel = Math.max(0, windowHeight - bottomInset - PILL_HEIGHT - topY);

  const dockRef = useRef(dock);
  dockRef.current = dock;
  const travelRef = useRef(travel);
  travelRef.current = travel;

  const dragY = useSharedValue(0);
  const settle = useCallback((nextDock: 'top' | 'bottom', dy: number) => {
    if (nextDock !== dockRef.current) {
      // 앵커가 반대쪽으로 바뀌므로 지금 손가락 위치를 새 앵커 기준 오프셋으로 옮겨 이어서 스냅한다.
      dragY.value = nextDock === 'top' ? dy + travelRef.current : dy - travelRef.current;
      setDock(nextDock);
    }
    dragY.value = withSpring(0, SETTLE_SPRING);
  }, [dragY, setDock]);

  const pan = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => shouldStartDockPan(gesture),
      onPanResponderMove: (_, gesture) => {
        dragY.value = gesture.dy;
      },
      onPanResponderRelease: (_, gesture) =>
        settle(pillDockAfterDrag(dockRef.current, gesture, travelRef.current), gesture.dy),
      onPanResponderTerminate: () => settle(dockRef.current, 0),
    }),
    [dragY, settle],
  );

  const openSong = useCallback((songId: number | null) => {
    if (songId == null) return;
    setExpanded(false);
    navigate('SongDetail', { songId, origin: 'AnalysisPill' });
  }, [setExpanded]);

  const handlePillPress = useCallback(() => {
    if (!pillState) return;
    if (pillState.dismissWorkId != null) dismiss(pillState.dismissWorkId);
    else if (pillState.expandable) setExpanded(!expanded);
    else openSong(pillState.tapSongId);
  }, [dismiss, expanded, openSong, pillState, setExpanded]);

  const handleJobOpen = useCallback((job: AnalysisJob) => {
    if (job.phase === 'failed') dismiss(job.workId);
    else openSong(job.songId);
  }, [dismiss, openSong]);
  const collapse = useCallback(() => setExpanded(false), [setExpanded]);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const showStack = expanded && jobs.length > 1;

  // 앵커 쪽 pill 은 접힘/펼침에 걸쳐 같은 key 를 유지해 그 자리에서 내용만 바뀐다.
  // 스택은 두 도킹 위치 사이 전체를 차지하는 고정 프레임이다(하단 도킹은 column-reverse 로 아래부터 쌓임).
  // exiting 중인 뷰는 부모 프레임 기준으로 그려지므로, 부모가 내용에 맞춰 줄어들면 엉뚱한 곳으로 튄다.
  // 그래서 스택 크기를 고정하고 드래그 핸들러는 pill 마다 단다.
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {showStack && <Pressable style={StyleSheet.absoluteFill} onPress={collapse} />}
      <Animated.View
        style={[styles.stack, { top: topY, height: travel + PILL_HEIGHT }, dock === 'bottom' && styles.stackUpward, dragStyle]}
        pointerEvents="box-none"
      >
        {showStack
          ? jobs.map((job, index) => (
            <JobPill key={job.workId} job={job} dock={dock} index={index} panHandlers={pan.panHandlers} onOpen={handleJobOpen} />
          ))
          : pillState && (
            <PillSlot key={jobs[0].workId} dock={dock} index={0} panHandlers={pan.panHandlers}>
              <AnalysisPill state={pillState} onPress={handlePillPress} />
            </PillSlot>
          )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: Layers.analysisPill,
    elevation: Layers.analysisPill,
  },
  stack: {
    position: 'absolute',
    left: SIDE_PADDING,
    right: SIDE_PADDING,
    alignItems: 'center',
    gap: STACK_GAP,
  },
  stackUpward: {
    flexDirection: 'column-reverse',
  },
});
