import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { songReportApi } from '../../api/songReportApi';
import { apiErrorMessage } from '../../api/errors';
import ErrorDialog from '../ErrorDialog';
import { AppBottomSheetModal, AppBottomSheetModalRef, AppBottomSheetView } from '../bottomSheet';
import type { SubmitSongReportRequest } from '../../types/songReport';
import SongReportSheet, { type SongReportSheetTarget } from './SongReportSheet';
import SongReportThanksSheet from './SongReportThanksSheet';

export interface SongReportModalRef {
  open: (target: SongReportSheetTarget) => void;
}

interface SongReportModalProps {
  songId: number;
  title: string;
  artist: string;
  youtubeUrl: string | null;
}

/** 제보 시트와 보낸 뒤 감사 시트, 실패 다이얼로그까지 한 묶음. 곡 상세와 줄 공부가 같이 쓴다. */
const SongReportModal = forwardRef<SongReportModalRef, SongReportModalProps>(function SongReportModal(
  { songId, title, artist, youtubeUrl },
  ref,
) {
  const sheetRef = useRef<AppBottomSheetModalRef>(null);
  const [target, setTarget] = useState<SongReportSheetTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    open: next => {
      setTarget(next);
      sheetRef.current?.present();
    },
  }), []);

  const handleClose = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);
  const handleDismissed = useCallback(() => {
    setTarget(null);
    setSent(false);
  }, []);
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);
  const handleSubmit = useCallback(async (request: SubmitSongReportRequest) => {
    setSubmitting(true);
    try {
      await songReportApi.submit(songId, request);
      setSent(true);
    } catch (e) {
      setError(apiErrorMessage(e, '제보를 보내지 못했어요. 잠시 후 다시 보내주세요'));
    } finally {
      setSubmitting(false);
    }
  }, [songId]);

  return (
    <>
      <AppBottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={handleDismissed}
      >
        <AppBottomSheetView fitAboveKeyboard>
          {sent ? (
            <SongReportThanksSheet onClose={handleClose} />
          ) : target ? (
            <SongReportSheet
              target={target}
              songTitle={title}
              songArtist={artist}
              youtubeUrl={youtubeUrl}
              submitting={submitting}
              onSubmit={handleSubmit}
              onClose={handleClose}
            />
          ) : null}
        </AppBottomSheetView>
      </AppBottomSheetModal>

      <ErrorDialog message={error} onDismiss={handleDismissError} />
    </>
  );
});

export default React.memo(SongReportModal);
