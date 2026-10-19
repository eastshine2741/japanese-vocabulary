import React, { useCallback, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { deckApi } from '../api/deckApi';
import AppDialog from '../components/AppDialog';
import ErrorDialog from '../components/ErrorDialog';
import SongDeckActionSheet, { SongDeckTarget } from '../components/SongDeckActionSheet';
import { AppBottomSheetModal, AppBottomSheetModalRef, AppBottomSheetView } from '../components/bottomSheet';
import { useStudyStatsStore } from '../stores/studyStatsStore';

const RETRY_MESSAGE = '잠시 후 다시 시도해주세요.';
const KEPT_WORDS_NOTE = '다른 곡에서도 배운 단어는 그대로 남아요.';

type DeletionPreview = { deletedWordCount: number; deletedCardCount: number };

export function songDeckDeletionBody({ deletedWordCount, deletedCardCount }: DeletionPreview): string {
  const lines = [
    deletedWordCount > 0 ? `단어 ${deletedWordCount}개와 복습 기록이 사라져요.` : null,
    deletedCardCount > 0
      ? `이 곡에서 얻은 카드 ${deletedCardCount}장${deletedWordCount > 0 ? '도' : '이'} 사라져요.`
      : null,
    KEPT_WORDS_NOTE,
  ];
  return lines.filter(Boolean).join('\n');
}

/** 곡 덱 삭제 확인 → 삭제. 확인 다이얼로그 전에 함께 지워질 단어 수를 받아 온다. */
export function useDeleteSongDeck(onDeleted: (deckId: number) => void) {
  const [pending, setPending] = useState<({ deckId: number } & DeletionPreview) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const onDeletedRef = useRef(onDeleted);
  onDeletedRef.current = onDeleted;

  const requestDelete = useCallback(async (deckId: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const { deletedWordCount, deletedCardCount } = await deckApi.getDeletionPreview(deckId);
      setPending({ deckId, deletedWordCount, deletedCardCount });
    } catch {
      setError(RETRY_MESSAGE);
    } finally {
      busyRef.current = false;
    }
  }, []);

  const cancel = useCallback(() => setPending(null), []);

  const confirm = useCallback(async () => {
    const target = pending;
    setPending(null);
    if (!target || busyRef.current) return;
    busyRef.current = true;
    try {
      await deckApi.deleteDeck(target.deckId);
    } catch {
      setError(RETRY_MESSAGE);
      return;
    } finally {
      busyRef.current = false;
    }
    useStudyStatsStore.getState().invalidate();
    onDeletedRef.current(target.deckId);
  }, [pending]);

  const dismissError = useCallback(() => setError(null), []);

  const dialogs = (
    <>
      <AppDialog
        visible={pending !== null}
        title="이 곡 학습을 그만둘까요?"
        body={songDeckDeletionBody(pending ?? { deletedWordCount: 0, deletedCardCount: 0 })}
        buttons={[
          { label: '취소', variant: 'secondary', onPress: cancel },
          { label: '그만두기', variant: 'danger', onPress: confirm },
        ]}
      />
      <ErrorDialog message={error} onDismiss={dismissError} />
    </>
  );

  return { requestDelete, dialogs };
}

/** 곡 덱 롱프레스 액션 시트('학습 그만두기' 하나). 안드로이드 뒤로가기는 열린 시트부터 닫는다. */
export function useSongDeckActionSheet(onDelete: (target: SongDeckTarget) => void) {
  const [target, setTarget] = useState<SongDeckTarget | null>(null);
  const sheetRef = useRef<AppBottomSheetModalRef>(null);
  // present()/dismiss() 시점에 바로 바꿔 둔다 — gorhom onChange 를 기다리면 뒤로가기와 경합한다.
  const openRef = useRef(false);

  const open = useCallback((next: SongDeckTarget) => {
    setTarget(next);
    openRef.current = true;
    sheetRef.current?.present();
  }, []);

  const handleChange = useCallback((index: number) => {
    openRef.current = index >= 0;
  }, []);

  const handleDismiss = useCallback(() => {
    openRef.current = false;
    setTarget(null);
  }, []);

  const handleDelete = useCallback(() => {
    if (!target) return;
    openRef.current = false;
    sheetRef.current?.dismiss();
    onDelete(target);
  }, [onDelete, target]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (!openRef.current) return false;
        openRef.current = false;
        sheetRef.current?.dismiss();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

  const sheet = (
    <AppBottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      onChange={handleChange}
      onDismiss={handleDismiss}
    >
      <AppBottomSheetView>
        {target && <SongDeckActionSheet target={target} onDelete={handleDelete} />}
      </AppBottomSheetView>
    </AppBottomSheetModal>
  );

  return { open, sheet };
}
