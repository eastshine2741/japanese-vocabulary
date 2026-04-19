import React from 'react';
import AppDialog from './AppDialog';

interface Props {
  message: string | null;
  onDismiss: () => void;
}

export default function ErrorDialog({ message, onDismiss }: Props) {
  return (
    <AppDialog
      visible={message !== null}
      title="문제가 발생했어요"
      body={message ?? ''}
      buttons={[{ label: '확인', onPress: onDismiss }]}
    />
  );
}
