import React, { RefObject, useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Feather, FontAwesome6 } from '@expo/vector-icons';
import { AppBottomSheetModal, AppBottomSheetModalRef, AppBottomSheetView } from '../bottomSheet';
import { rewardCardApi } from '../../api/rewardCardApi';
import { putToPresignedUrl } from '../../services/presignedUpload';
import { shareUrlLabel, xPostUrl } from '../../services/shareLinks';
import { trackCardShare } from '../../services/analytics';
import { Colors } from '../../theme/theme';
import { SHOWROOM } from './cardTheme';
import { composeShareImages } from './shareImage';
import { instagramStorySupported, isInstagramInstalled, shareToInstagramStory } from './instagramStory';
import { CardTilt } from './useCardTilt';

type Method = 'x' | 'instagram_story' | 'link';

interface Props {
  kind: 'song' | 'artist';
  /** 서버 카드 id. 등급마다 카드가 따로다. */
  cardId: number;
  title: string;
  tilt: CardTilt;
  /** 공유 이미지로 뜰 카드 뷰. */
  cardRef: RefObject<View | null>;
}

// 정면·앞면으로 바꾼 자세가 UI 스레드에 그려진 뒤에 뜬다.
const nextFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

class InstagramMissing extends Error {}

function CardShareButton({ kind, cardId, title, tilt, cardRef }: Props) {
  const sheetRef = useRef<AppBottomSheetModalRef>(null);
  const [busy, setBusy] = useState<Method | null>(null);
  const apiKind = kind === 'song' ? 'song-cards' : 'artist-cards';
  const label = `「${title}」`;

  const handleOpen = useCallback(() => sheetRef.current?.present(), []);

  const capture = useCallback(
    async (url: string) => {
      const flip = tilt.flip.value;
      tilt.flip.value = 0;
      tilt.still.value = true;
      try {
        await nextFrames();
        return await composeShareImages(cardRef, `card-share-${apiKind}-${cardId}`, shareUrlLabel(url));
      } finally {
        tilt.still.value = false;
        tilt.flip.value = flip;
      }
    },
    [apiKind, cardRef, cardId, tilt],
  );

  const upload = useCallback(
    async (fileUri: string) => {
      const { uploadUrl, headers } = await rewardCardApi.issueShareImageUploadUrl(apiKind, cardId);
      await putToPresignedUrl(fileUri, uploadUrl, headers);
      await rewardCardApi.shareCard(apiKind, cardId, true);
    },
    [apiKind, cardId],
  );

  /** 링크를 받고 카드를 떠서 미리보기를 올린다. 링크로 퍼지는 X·링크 공유는 미리보기가 올라간 뒤에 내보낸다. */
  const prepare = useCallback(
    async (waitUpload: boolean) => {
      const { url } = await rewardCardApi.shareCard(apiKind, cardId);
      const images = await capture(url);
      // 실패하면 서버가 앨범 아트로 대신하니 공유는 계속한다.
      const uploading = upload(images.preview).catch((e) =>
        Sentry.captureException(e, { tags: { context: 'card-share-upload' } }),
      );
      if (waitUpload) await uploading;
      return { url, story: images.story };
    },
    [apiKind, capture, cardId, upload],
  );

  const run = useCallback(
    async (method: Method, share: () => Promise<void>) => {
      if (busy) return;
      setBusy(method);
      try {
        await share();
        trackCardShare(kind, method);
      } catch (e) {
        Alert.alert(e instanceof InstagramMissing ? '인스타그램이 설치되어 있지 않아요' : '공유하지 못했어요');
      } finally {
        setBusy(null);
      }
    },
    [busy, kind],
  );

  const handleX = useCallback(
    () =>
      run('x', async () => {
        const { url } = await prepare(true);
        sheetRef.current?.dismiss();
        await Linking.openURL(xPostUrl(label, url));
      }),
    [label, prepare, run],
  );

  const handleInstagram = useCallback(
    () =>
      run('instagram_story', async () => {
        if (!(await isInstagramInstalled())) throw new InstagramMissing();
        const { url, story } = await prepare(false);
        sheetRef.current?.dismiss();
        await shareToInstagramStory(story, url);
      }),
    [prepare, run],
  );

  const handleLink = useCallback(
    () =>
      run('link', async () => {
        const { url } = await prepare(true);
        sheetRef.current?.dismiss();
        await Share.share(Platform.OS === 'ios' ? { message: label, url } : { message: `${label}\n${url}` });
      }),
    [label, prepare, run],
  );

  return (
    <>
      <Pressable onPress={handleOpen} hitSlop={10} style={styles.iconBtn}>
        <Feather name="share" size={17} color={SHOWROOM.fg} />
      </Pressable>
      <AppBottomSheetModal ref={sheetRef} enableDynamicSizing enablePanDownToClose>
        <AppBottomSheetView>
          <View style={styles.sheet}>
            <ShareRow method="x" label="X 게시물로 공유" busy={busy} onPress={handleX} />
            {instagramStorySupported && (
              <ShareRow method="instagram_story" label="인스타그램 스토리로 공유" busy={busy} onPress={handleInstagram} />
            )}
            <ShareRow method="link" label="링크로 공유" busy={busy} onPress={handleLink} />
          </View>
        </AppBottomSheetView>
      </AppBottomSheetModal>
    </>
  );
}

export default React.memo(CardShareButton);

interface RowProps {
  method: Method;
  label: string;
  busy: Method | null;
  onPress: () => void;
}

function RowIcon({ method }: { method: Method }) {
  if (method === 'x') return <FontAwesome6 name="x-twitter" size={19} color={Colors.textPrimary} />;
  if (method === 'instagram_story') return <FontAwesome6 name="instagram" size={20} color={Colors.textPrimary} />;
  return <Feather name="link" size={20} color={Colors.textPrimary} />;
}

const ShareRow = React.memo(function ShareRow({ method, label, busy, onPress }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy != null}
      style={({ pressed }) => [styles.row, busy != null && busy !== method && styles.rowDisabled, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <RowIcon method={method} />
      </View>
      <Text style={styles.rowText}>{label}</Text>
      {busy === method && <ActivityIndicator size="small" color={Colors.textSecondary} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  sheet: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowDisabled: { opacity: 0.4 },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
});
