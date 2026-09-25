import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StudyCard } from './types';

export interface WordFrontProps {
  card: StudyCard;
  revealProgress?: Animated.Value;
  /** pill 이 rating 버튼 넷으로 갈라지는 진행도 — pill 윤곽은 이 초반에 녹아 없어진다. */
  splitProgress?: Animated.Value;
  hideHeadword?: boolean;
  headwordRef?: React.Ref<View>;
  onHeadwordLayout?: () => void;
  /** headword 앵커 안에 겹쳐 그릴 것 — 앵커가 레이아웃으로 움직이면 같은 프레임에 따라온다. */
  headwordOverlay?: React.ReactNode;
}

/**
 * 앞면 wordLayer — headword 하나만 세로 중앙에, 하단에 '먼저 떠올려라' 안내 + 뜻 확인 pill.
 * pill 은 시각적 타깃일 뿐이고 실제 탭은 WordLayer 가 카드 전체에서 받는다.
 * 하단 블록은 뒷면 ratingBlock 과 같은 높이·너비라, 뒤집힐 때 pill 이 그 자리에서 rating 버튼 넷으로 갈라진다.
 */
export const WordFront = React.memo(function WordFront({
  card,
  revealProgress,
  splitProgress,
  hideHeadword = false,
  headwordRef,
  onHeadwordLayout,
  headwordOverlay,
}: WordFrontProps) {
  const headwordStyle = React.useMemo(() => revealProgress
    ? {
        opacity: revealProgress.interpolate({
          inputRange: [0, 0.72, 1],
          outputRange: [1, 1, 0],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            translateY: revealProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -92],
              extrapolate: 'clamp',
            }),
          },
          {
            scale: revealProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.69],
              extrapolate: 'clamp',
            }),
          },
        ],
      }
    : null, [revealProgress]);
  // 하단 블록은 넷으로 나뉘어 사라진다 — 안내 문구는 바로, pill 안 아이콘·글자는 그 다음,
  // pill 채움은 뒷면 rating 버튼이 같은 모양으로 덮어 온 뒤에야 빠진다(같은 자리·같은 색이라
  // 이 crossfade 는 보이지 않는다). pill 윤곽만은 분열 초반까지 남았다가 녹아 없어지고,
  // 뒷면 버튼이 거의 다 갈라진 뒤 버튼마다 윤곽이 다시 떠오른다.
  const revealStyles = React.useMemo(() => revealProgress
    ? {
        hint: {
          opacity: revealProgress.interpolate({
            inputRange: [0, 0.28],
            outputRange: [1, 0],
            extrapolate: 'clamp' as const,
          }),
          transform: [
            {
              translateY: revealProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 10],
                extrapolate: 'clamp' as const,
              }),
            },
          ],
        },
        pillBody: {
          opacity: revealProgress.interpolate({
            inputRange: [0, 0.22],
            outputRange: [1, 0],
            extrapolate: 'clamp' as const,
          }),
        },
        pillContent: {
          opacity: revealProgress.interpolate({
            inputRange: [0, 0.12],
            outputRange: [1, 0],
            extrapolate: 'clamp' as const,
          }),
        },
        pillBorder: splitProgress
          ? {
              opacity: splitProgress.interpolate({
                inputRange: [0.06, 0.26],
                outputRange: [1, 0],
                extrapolate: 'clamp' as const,
              }),
            }
          : {
              opacity: revealProgress.interpolate({
                inputRange: [0, 0.22],
                outputRange: [1, 0],
                extrapolate: 'clamp' as const,
              }),
            },
      }
    : null, [revealProgress, splitProgress]);
  const hintStyle = revealStyles?.hint ?? null;
  const pillBodyStyle = revealStyles?.pillBody ?? null;
  const pillContentStyle = revealStyles?.pillContent ?? null;
  const pillBorderStyle = revealStyles?.pillBorder ?? null;

  return (
    <View style={styles.wordFront}>
      <View style={styles.frontCenterBlock}>
        <View style={styles.frontWordGroup}>
          <View ref={headwordRef} collapsable={false} onLayout={onHeadwordLayout}>
            {/* 숨김은 Animated 가 건드리지 않는 부모에 건다 — 같은 view 의 opacity 를 Animated 값과
                고정값 사이로 바꾸면, iOS 는 native 가 한 번 쓴 opacity 에 대한 React 갱신을 무시한다
                (docs/runbooks/ios-native-animated-pitfalls.md). */}
            <View collapsable={false} style={hideHeadword && styles.hiddenHeadword}>
              <Animated.Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={[styles.frontHeadword, headwordStyle]}
              >
                {card.japanese}
              </Animated.Text>
            </View>
            {headwordOverlay}
          </View>
        </View>
      </View>
      <View style={styles.revealBlock}>
        <Animated.Text style={[styles.recallHint, hintStyle]}>뜻을 먼저 떠올린 뒤 확인해 보세요</Animated.Text>
        <View style={styles.revealPill}>
          <Animated.View style={[styles.revealPillFill, pillBodyStyle]} />
          <Animated.View style={[styles.revealPillBorder, pillBorderStyle]} />
          <Animated.View style={[styles.revealPillContent, pillContentStyle]}>
            <MaterialIcons name="touch-app" size={20} color="#FFFFFF" />
            <Text style={styles.revealLabel}>뜻 확인하기</Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wordFront: {
    flex: 1,
  },
  frontCenterBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  frontWordGroup: {
    maxWidth: '100%',
    alignItems: 'flex-start',
  },
  frontHeadword: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: 0,
    transformOrigin: 'left center',
  },
  hiddenHeadword: {
    opacity: 0,
  },
  revealBlock: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  recallHint: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  revealPill: {
    width: '100%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 채움과 윤곽을 따로 두어 서로 다른 시점에 사라지게 한다. 뒷면 rating 버튼과 같은 색·두께.
  revealPillFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  revealPillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  revealPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revealLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
