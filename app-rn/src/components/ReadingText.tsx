import React from 'react';
import { Text, TextProps } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { convertReading } from '../utils/readingConverter';

interface Props extends TextProps {
  reading: string;
}

function ReadingText({ reading, ...textProps }: Props) {
  const readingDisplay = useSettingsStore(s => s.readingDisplay);
  return <Text {...textProps}>{convertReading(reading, readingDisplay)}</Text>;
}

export default React.memo(ReadingText);
