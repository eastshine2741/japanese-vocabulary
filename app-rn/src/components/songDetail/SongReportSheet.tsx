import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { useSongReportStore } from '../../stores/songReportStore';
import { extractYoutubeVideoId, youtubeThumbnailUrl } from '../../utils/youtube';
import type { SongReportTypeDto, SubmitSongReportRequest } from '../../types/songReport';
import { AppSheetTextInput } from '../bottomSheet';
import type { CurrentPlayingLyricLine } from './CurrentPlayingWordsSheet';
import SongReportLineContext from './SongReportLineContext';
import {
  buildSongReportRequest,
  buildSongReportTokenChoices,
  canSubmitSongReport,
  selectSongReportTypes,
  songReportLineFocus,
  SONG_REPORT_SUGGESTION_MAX,
  type SongReportTokenChoice,
} from './songReportForm';

export type SongReportSheetTarget =
  | { group: 'MV' }
  | { group: 'LYRIC_LINE'; line: CurrentPlayingLyricLine };

export interface SongReportSheetProps {
  target: SongReportSheetTarget;
  songTitle: string;
  songArtist: string;
  youtubeUrl: string | null;
  submitting: boolean;
  onSubmit: (request: SubmitSongReportRequest) => void;
  onClose: () => void;
}

interface TypeOptionProps {
  option: SongReportTypeDto;
  selected: boolean;
  onPress: (type: string) => void;
}

const TypeOption = React.memo(function TypeOption({ option, selected, onPress }: TypeOptionProps) {
  const handlePress = useCallback(() => onPress(option.type), [onPress, option.type]);

  return (
    <Pressable
      style={[styles.option, selected && styles.optionSelected]}
      onPress={handlePress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
      {selected ? <Feather name="check" size={16} color={Colors.primary} /> : null}
    </Pressable>
  );
});

interface TokenChipProps {
  choice: SongReportTokenChoice;
  selected: boolean;
  onPress: (key: string) => void;
}

const TokenChip = React.memo(function TokenChip({ choice, selected, onPress }: TokenChipProps) {
  const handlePress = useCallback(() => onPress(choice.key), [choice.key, onPress]);

  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={handlePress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{choice.surface}</Text>
    </Pressable>
  );
});

function SongReportSheet({
  target,
  songTitle,
  songArtist,
  youtubeUrl,
  submitting,
  onSubmit,
  onClose,
}: SongReportSheetProps) {
  const types = useSongReportStore(s => s.types);
  const typesStatus = useSongReportStore(s => s.status);
  const loadTypes = useSongReportStore(s => s.loadTypes);

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [step, setStep] = useState<'type' | 'detail'>('type');
  const [selectedTokenKey, setSelectedTokenKey] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState('');

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const line = target.group === 'LYRIC_LINE' ? target.line : null;
  const tokenChoices = useMemo(
    () => buildSongReportTokenChoices(line?.tokens),
    [line?.tokens],
  );

  // 분석 전 줄에는 고를 토큰이 없다. 서버가 어차피 되돌려 보낼 유형은 내놓지 않는다.
  const groupTypes = useMemo(() => {
    const all = selectSongReportTypes(types, target.group);
    return tokenChoices.length > 0 ? all : all.filter(option => option.targetKind !== 'LINE_TOKEN');
  }, [target.group, tokenChoices.length, types]);

  const selectedTypeDto = useMemo(
    () => groupTypes.find(option => option.type === selectedType) ?? null,
    [groupTypes, selectedType],
  );

  const detailType = step === 'detail' ? selectedTypeDto : null;
  const selectedToken = useMemo(
    () => tokenChoices.find(choice => choice.key === selectedTokenKey) ?? null,
    [selectedTokenKey, tokenChoices],
  );
  const needsToken = detailType?.targetKind === 'LINE_TOKEN' && tokenChoices.length > 0;
  // 유형을 고르는 동안은 원문·번역을 두고, 고른 뒤에야 그 유형이 다루는 것으로 바꾼다 — 고르는 중에 목록이 밀리지 않게.
  const lineFocus = songReportLineFocus(detailType?.type);
  const canSubmit = !submitting && canSubmitSongReport(detailType, selectedToken, suggestion);

  const videoId = useMemo(() => extractYoutubeVideoId(youtubeUrl), [youtubeUrl]);

  // 쓴 글은 유형을 바꿔도 남기고, 고른 단어만 다른 유형으로 넘어갈 때 비운다.
  const handleSelectType = useCallback((type: string) => {
    if (type !== selectedType) setSelectedTokenKey(null);
    setSelectedType(type);
  }, [selectedType]);

  const handleNext = useCallback(() => {
    setStep('detail');
  }, []);

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    setStep('type');
  }, []);

  const handleSelectToken = useCallback((key: string) => {
    setSelectedTokenKey(prev => (prev === key ? null : key));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit || detailType == null) return;
    Keyboard.dismiss();
    onSubmit(buildSongReportRequest(detailType, suggestion, line?.index ?? null, selectedToken));
  }, [canSubmit, detailType, line?.index, onSubmit, selectedToken, suggestion]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {detailType ? (
          <Pressable
            style={styles.headerButton}
            onPress={handleBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="문제 유형 다시 고르기"
          >
            <Feather name="chevron-left" size={18} color={Colors.textSecondary} />
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {detailType?.label ?? '어디가 틀렸는지 알려주세요'}
        </Text>
        <Pressable
          style={styles.headerButton}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Feather name="x" size={16} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {line ? (
        <SongReportLineContext line={line} focus={lineFocus} />
      ) : (
        <View style={styles.mvContext}>
          <View style={styles.mvThumb}>
            {videoId ? (
              <Image source={{ uri: youtubeThumbnailUrl(videoId) }} style={styles.mvThumbImage} />
            ) : (
              <Feather name="video-off" size={14} color="#FFFFFF" />
            )}
          </View>
          <View style={styles.mvInfo}>
            <Text style={styles.contextLyric} numberOfLines={1}>{songTitle}</Text>
            <Text style={styles.contextTranslation} numberOfLines={1}>
              {`${songArtist} · 현재 연결된 영상`}
            </Text>
          </View>
        </View>
      )}

      {detailType ? (
        <>
          {needsToken ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{detailType.tokenPrompt ?? '어떤 단어인가요?'}</Text>
              <View style={styles.chips}>
                {tokenChoices.map(choice => (
                  <TokenChip
                    key={choice.key}
                    choice={choice}
                    selected={choice.key === selectedTokenKey}
                    onPress={handleSelectToken}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <AppSheetTextInput
            value={suggestion}
            onChangeText={setSuggestion}
            placeholder={detailType.suggestionPlaceholder ?? ''}
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            multiline
            textAlignVertical="top"
            maxLength={SONG_REPORT_SUGGESTION_MAX}
          />

          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
          >
            <Text style={styles.submitLabel}>{submitting ? '보내는 중...' : '제보 보내기'}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>문제 유형</Text>
            {groupTypes.length === 0 ? (
              <View style={styles.sectionLoading}>
                {typesStatus === 'error' ? (
                  <Text style={styles.sectionEmptyText}>제보 유형을 불러오지 못했어요. 잠시 후 다시 열어주세요</Text>
                ) : (
                  <ActivityIndicator size="small" color={Colors.textMuted} />
                )}
              </View>
            ) : (
              <View style={styles.options}>
                {groupTypes.map(option => (
                  <TypeOption
                    key={option.type}
                    option={option}
                    selected={option.type === selectedType}
                    onPress={handleSelectType}
                  />
                ))}
              </View>
            )}
          </View>

          <Pressable
            style={[styles.submitButton, selectedTypeDto == null && styles.submitButtonDisabled]}
            onPress={handleNext}
            disabled={selectedTypeDto == null}
            accessibilityRole="button"
          >
            <Text style={styles.submitLabel}>다음</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default React.memo(SongReportSheet);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 19,
    lineHeight: 26,
    color: Colors.textPrimary,
    ...Typography.headingExtraBold,
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSubtle,
  },
  mvContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
  },
  mvThumb: {
    width: 64,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  mvThumbImage: {
    width: '100%',
    height: '100%',
  },
  mvInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  contextLyric: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  contextTranslation: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
    ...Typography.bodyBold,
  },
  sectionLoading: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionEmptyText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  options: {
    gap: 6,
  },
  option: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: Colors.surfaceSubtle,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  optionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  optionLabelSelected: {
    color: Colors.primary,
    ...Typography.bodyExtraBold,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: Colors.surfaceSubtle,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  chipLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  chipLabelSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
  input: {
    minHeight: 72,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.textPrimary,
  },
  submitButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitLabel: {
    fontSize: 14,
    lineHeight: 19,
    color: '#FFFFFF',
    ...Typography.bodyExtraBold,
  },
});
