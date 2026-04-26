import React, { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import AppDialog from './AppDialog';
import { Colors } from '../theme/theme';
import { getBaseURL, setBaseURL } from '../api/client';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ServerURLDialog({ visible, onClose }: Props) {
  const [url, setUrl] = useState(getBaseURL);

  useEffect(() => {
    if (visible) setUrl(getBaseURL());
  }, [visible]);

  const handleApply = async () => {
    await setBaseURL(url);
    onClose();
  };

  return (
    <AppDialog
      visible={visible}
      title="Backend URL"
      buttons={[
        { label: '취소', onPress: onClose, variant: 'secondary' },
        { label: '적용', onPress: handleApply, variant: 'primary' },
      ]}
    >
      <Text style={styles.description}>
        namespace에 따라 path prefix가 달라집니다 (예: /k8s, /main)
      </Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="http://49.142.62.106/main"
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  description: { fontSize: 12, color: Colors.textMuted, lineHeight: 17, textAlign: 'center' },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
  },
});
