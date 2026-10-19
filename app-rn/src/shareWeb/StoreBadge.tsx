import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export type Store = 'ios' | 'android';

const APPLE =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';

// Google Play 삼각형의 네 조각. 공식 배지처럼 조각마다 색이 다르다.
const PLAY: readonly [d: string, fill: string][] = [
  ['M1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924z', '#00C3FF'],
  ['M13.544 10.989l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973z', '#00E676'],
  ['M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z', '#FFD400'],
  ['M13.544 13.056l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z', '#FF3A44'],
];

const COPY: Record<Store, { over: string; name: string }> = {
  ios: { over: 'Download on the', name: 'App Store' },
  android: { over: 'GET IT ON', name: 'Google Play' },
};

interface Props {
  store: Store;
  onPress: (store: Store) => void;
}

/** 스토어 공식 배지 모양의 버튼. 검은 바탕에 로고와 두 줄 글씨. */
function StoreBadge({ store, onPress }: Props) {
  const handlePress = useCallback(() => onPress(store), [onPress, store]);
  const { over, name } = COPY[store];
  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.badge, pressed && styles.pressed]} accessibilityRole="link">
      <Svg width={26} height={26} viewBox="0 0 24 24">
        {store === 'ios' ? <Path d={APPLE} fill="#FFFFFF" /> : PLAY.map(([d, fill]) => <Path key={fill} d={d} fill={fill} />)}
      </Svg>
      <View>
        <Text style={styles.over}>{over}</Text>
        <Text style={styles.name}>{name}</Text>
      </View>
    </Pressable>
  );
}

export default React.memo(StoreBadge);

const styles = StyleSheet.create({
  badge: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A6A6A6',
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  pressed: { opacity: 0.8 },
  over: { color: '#FFFFFF', fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
  name: { color: '#FFFFFF', fontSize: 19, fontWeight: '600', letterSpacing: -0.3, marginTop: -1 },
});
