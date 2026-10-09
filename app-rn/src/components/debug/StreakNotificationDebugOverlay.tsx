import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addStreakPressListener } from '../../../modules/streak-notification';
import { debugShowStreakReminder } from '../../services/pushNotifications';
import { Layers } from '../../theme/layers';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// 서버 StreakReminderTask 와 같은 마감: 다음 04:00 KST (= 19:00 UTC).
function nextKst4am(now: number): number {
  const d = new Date(now);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 19);
  while (t <= now) t += DAY;
  return t;
}

type Preset = { label: string; expiresAt: (now: number) => number };

const PRESETS: Preset[] = [
  { label: '+1분', expiresAt: (now) => now + MINUTE },
  { label: '+5분', expiresAt: (now) => now + 5 * MINUTE },
  { label: '04:00 KST', expiresAt: nextKst4am },
  { label: '만료됨(폴백)', expiresAt: (now) => now - MINUTE },
];

const TITLE = '당신의 의지는 여기까지입니까.';
const BODY = '더 할 수 있잖아요. 12일을 여기서 버릴 건가요. 새벽 4시 전에 카드 한 장만 넘기세요';

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/** __DEV__ 전용: 23:00 카운트다운 알림을 즉시 띄워 보고, 탭(onPress) 이벤트를 기록한다. */
export default function StreakNotificationDebugOverlay() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const append = useCallback((line: string) => {
    setLog((prev) => [`${formatTime(Date.now())} ${line}`, ...prev].slice(0, 6));
  }, []);

  useEffect(() => {
    const sub = addStreakPressListener((data) => append(`onPress ${JSON.stringify(data)}`));
    if (!sub) append('네이티브 모듈 없음 — 폴백만 동작');
    return () => sub?.remove();
  }, [append]);

  const fire = useCallback(
    async (preset: Preset) => {
      const expiresAt = preset.expiresAt(Date.now());
      try {
        const result = await debugShowStreakReminder({ title: TITLE, body: BODY, expiresAt });
        append(`${preset.label} → ${result} (만료 ${formatTime(expiresAt)})`);
      } catch (e) {
        append(`${preset.label} → 실패 ${String(e)}`);
      }
    },
    [append],
  );

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <View pointerEvents="box-none" style={[styles.root, { top: insets.top + 56 }]}>
      <Pressable onPress={toggle} style={styles.handle}>
        <Text style={styles.handleText}>{open ? '×' : '🔥'}</Text>
      </Pressable>
      {open && (
        <View style={styles.panel}>
          <Text style={styles.heading}>연속 학습 카운트다운 알림</Text>
          <View style={styles.buttons}>
            {PRESETS.map((preset) => (
              <PresetButton key={preset.label} preset={preset} onPress={fire} />
            ))}
          </View>
          {log.map((line, i) => (
            <Text key={`${i}-${line}`} style={styles.log} numberOfLines={2}>
              {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const PresetButton = React.memo(function PresetButton({
  preset,
  onPress,
}: {
  preset: Preset;
  onPress: (preset: Preset) => void;
}) {
  const handlePress = useCallback(() => onPress(preset), [onPress, preset]);
  return (
    <Pressable onPress={handlePress} style={styles.button}>
      <Text style={styles.buttonText}>{preset.label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: 8,
    left: 8,
    alignItems: 'flex-end',
    zIndex: Layers.modalSheet + 10,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleText: { color: '#fff', fontSize: 16 },
  panel: {
    marginTop: 6,
    alignSelf: 'stretch',
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  heading: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#4f46e5',
  },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  log: { color: '#d1d5db', fontSize: 11, marginTop: 2 },
});
