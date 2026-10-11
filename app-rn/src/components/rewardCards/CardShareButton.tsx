import React, { RefObject, useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Sharing from 'expo-sharing';
import { Feather } from '@expo/vector-icons';
import { AppBottomSheetModal, AppBottomSheetModalRef, AppBottomSheetView } from '../bottomSheet';
import { rewardCardApi } from '../../api/rewardCardApi';
import { putToPresignedUrl } from '../../services/presignedUpload';
import { shareUrlLabel } from '../../services/shareLinks';
import { trackCardShare } from '../../services/analytics';
import { Colors } from '../../theme/theme';
import { SHOWROOM } from './cardTheme';
import { composeShareImages } from './shareImage';
import { CardTilt } from './useCardTilt';

type Method = 'image' | 'link';

interface Props {
  kind: 'song' | 'artist';
  /** songId 또는 artistId. */
  targetId: number;
  title: string;
  tilt: CardTilt;
  /** 공유 이미지로 뜰 카드 뷰. */
  cardRef: RefObject<View | null>;
}

// 정면·앞면으로 바꾼 자세가 UI 스레드에 그려진 뒤에 뜬다.
const nextFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

function CardShareButton({ kind, targetId, title, tilt, cardRef }: Props) {
  const sheetRef = useRef<AppBottomSheetModalRef>(null);
  const [busy, setBusy] = useState<Method | null>(null);
  const apiKind = kind === 'song' ? 'songs' : 'artists';

  const handleOpen = useCallback(() => sheetRef.current?.present(), []);

  const capture = useCallback(
    async (url: string) => {
      const flip = tilt.flip.value;
      tilt.flip.value = 0;
      tilt.still.value = true;
      try {
        await nextFrames();
        return await composeShareImages(cardRef, `card-share-${apiKind}-${targetId}`, shareUrlLabel(url));
      } finally {
        tilt.still.value = false;
        tilt.flip.value = flip;
      }
    },
    [apiKind, cardRef, targetId, tilt],
  );

  const upload = useCallback(
    async (fileUri: string) => {
      const { uploadUrl, headers } = await rewardCardApi.issueShareImageUploadUrl(apiKind, targetId);
      await putToPresignedUrl(fileUri, uploadUrl, headers);
      await rewardCardApi.shareCard(apiKind, targetId, true);
    },
    [apiKind, targetId],
  );

  const handleImage = useCallback(async () => {
    if (busy) return;
    setBusy('image');
    try {
      const { url } = await rewardCardApi.shareCard(apiKind, targetId);
      const { story, preview } = await capture(url);
      // 랜딩 미리보기용이라 실패해도 공유는 계속한다.
      upload(preview).catch((e) => Sentry.captureException(e, { tags: { context: 'card-share-upload' } }));
      sheetRef.current?.dismiss();
      trackCardShare(kind, 'image');
      await Sharing.shareAsync(story, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      Alert.alert('공유하지 못했어요');
    } finally {
      setBusy(null);
    }
  }, [apiKind, busy, capture, kind, targetId, upload]);

  const handleLink = useCallback(async () => {
    if (busy) return;
    setBusy('link');
    try {
      const { url } = await rewardCardApi.shareCard(apiKind, targetId);
      // X 미리보기가 카드 이미지를 읽도록 링크보다 먼저 올린다. 실패하면 서버가 앨범 아트로 대신한다.
      try {
        await upload((await capture(url)).preview);
      } catch (e) {
        Sentry.captureException(e, { tags: { context: 'card-share-upload' } });
      }
      sheetRef.current?.dismiss();
      trackCardShare(kind, 'link');
      const label = `「${title}」`;
      await Share.share(Platform.OS === 'ios' ? { message: label, url } : { message: `${label}\n${url}` });
    } catch {
      Alert.alert('공유하지 못했어요');
    } finally {
      setBusy(null);
    }
  }, [apiKind, busy, capture, kind, targetId, title, upload]);

  return (
    <>
      <Pressable onPress={handleOpen} hitSlop={10} style={styles.iconBtn}>
        <Feather name="share" size={17} color={SHOWROOM.fg} />
      </Pressable>
      <AppBottomSheetModal ref={sheetRef} enableDynamicSizing enablePanDownToClose>
        <AppBottomSheetView>
          <View style={styles.sheet}>
            <ShareRow method="image" icon="image" label="이미지로 공유" busy={busy} onPress={handleImage} />
            <ShareRow method="link" icon="link" label="링크 공유" busy={busy} onPress={handleLink} />
          </View>
        </AppBottomSheetView>
      </AppBottomSheetModal>
    </>
  );
}

export default React.memo(CardShareButton);

interface RowProps {
  method: Method;
  icon: 'image' | 'link';
  label: string;
  busy: Method | null;
  onPress: () => void;
}

const ShareRow = React.memo(function ShareRow({ method, icon, label, busy, onPress }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy != null}
      style={({ pressed }) => [styles.row, busy != null && busy !== method && styles.rowDisabled, pressed && styles.rowPressed]}
    >
      <Feather name={icon} size={20} color={Colors.textPrimary} />
      <Text style={styles.rowText}>{label}</Text>
      {busy === method && <ActivityIndicator size="small" color={Colors.textSecondary} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  sheet: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  rowDisabled: { opacity: 0.4 },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
});
