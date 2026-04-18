import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';
import { getBaseURL, setBaseURL } from '../api/client';

interface Props {
  onApply?: () => void;
}

export default function ServerURLEditor({ onApply }: Props) {
  const [url, setUrl] = useState(getBaseURL);

  const handleApply = () => {
    setBaseURL(url);
    onApply?.();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Backend URL</Text>
      <Text style={styles.description}>
        namespace에 따라 path prefix가 달라집니다 (예: /k8s, /main)
      </Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="http://49.142.62.106"
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <TouchableOpacity style={styles.button} onPress={handleApply} activeOpacity={0.7}>
        <Text style={styles.buttonText}>적용</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  description: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
  input: {
    marginTop: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  button: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
