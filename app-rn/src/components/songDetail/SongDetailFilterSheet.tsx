import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { getPosColor, getPosLabel } from '../../types/pos';

interface Props {
  availablePos: string[];
  selectedPos: Set<string>;
  availableJlpt: string[];
  selectedJlpt: Set<string>;
  includeUnknownJlpt: boolean;
  onTogglePos: (pos: string) => void;
  onToggleJlpt: (jlpt: string) => void;
  onToggleUnknownJlpt: () => void;
  onReset: () => void;
  onApply: () => void;
}

interface PosChipProps {
  pos: string;
  selected: boolean;
  onToggle: (pos: string) => void;
}

interface JlptChipProps {
  jlpt: string;
  selected: boolean;
  onToggle: (jlpt: string) => void;
}

const PosChip = React.memo(function PosChip({ pos, selected, onToggle }: PosChipProps) {
  const handlePress = useCallback(() => {
    onToggle(pos);
  }, [onToggle, pos]);
  const color = getPosColor(pos);

  return (
    <TouchableOpacity
      style={[styles.chip, selected && { backgroundColor: `${color}20`, borderColor: color }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && { color }]}>{getPosLabel(pos)}</Text>
    </TouchableOpacity>
  );
});

const JlptChip = React.memo(function JlptChip({ jlpt, selected, onToggle }: JlptChipProps) {
  const handlePress = useCallback(() => {
    onToggle(jlpt);
  }, [onToggle, jlpt]);
  const color = getJlptColor(jlpt);

  return (
    <TouchableOpacity
      style={[styles.chip, selected && { backgroundColor: `${color}20`, borderColor: color }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && { color }]}>{jlpt}</Text>
    </TouchableOpacity>
  );
});

export default function SongDetailFilterSheet({
  availablePos,
  selectedPos,
  availableJlpt,
  selectedJlpt,
  includeUnknownJlpt,
  onTogglePos,
  onToggleJlpt,
  onToggleUnknownJlpt,
  onReset,
  onApply,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.handle} />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>품사</Text>
        <View style={styles.chipGrid}>
          {availablePos.map(pos => (
            <PosChip
              key={pos}
              pos={pos}
              selected={selectedPos.has(pos)}
              onToggle={onTogglePos}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>JLPT</Text>
        <View style={styles.chipGrid}>
          {availableJlpt.map(jlpt => (
            <JlptChip
              key={jlpt}
              jlpt={jlpt}
              selected={selectedJlpt.has(jlpt)}
              onToggle={onToggleJlpt}
            />
          ))}
          <TouchableOpacity
            style={[styles.chip, includeUnknownJlpt && styles.unknownChipSelected]}
            onPress={onToggleUnknownJlpt}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, includeUnknownJlpt && styles.unknownChipTextSelected]}>
              알 수 없음
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.resetButton} onPress={onReset} activeOpacity={0.7}>
          <Feather name="rotate-ccw" size={15} color={Colors.textPrimary} />
          <Text style={styles.resetText}>초기화</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={onApply} activeOpacity={0.7}>
          <Text style={styles.applyText}>적용</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getJlptColor(jlpt: string): string {
  switch (jlpt) {
    case 'N1':
      return Colors.jlptN1;
    case 'N2':
      return Colors.jlptN2;
    case 'N3':
      return Colors.jlptN3;
    case 'N4':
      return Colors.jlptN4;
    case 'N5':
      return Colors.jlptN5;
    default:
      return Colors.primary;
  }
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    backgroundColor: Colors.background,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  unknownChipSelected: {
    borderColor: Colors.textMuted,
    backgroundColor: Colors.elevated,
  },
  unknownChipTextSelected: {
    color: Colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  resetButton: {
    height: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 9999,
    backgroundColor: Colors.elevated,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  applyButton: {
    height: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: Colors.primary,
  },
  applyText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
