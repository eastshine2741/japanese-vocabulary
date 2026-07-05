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
  onClose?: () => void;
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
      style={[styles.chip, selected && { backgroundColor: `${color}33`, borderColor: color }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && { color, fontWeight: '800' }]}>{getPosLabel(pos)}</Text>
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
      style={[styles.chip, selected && { backgroundColor: `${color}33`, borderColor: color }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && { color, fontWeight: '800' }]}>{jlpt}</Text>
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
  onClose,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>필터</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            disabled={onClose == null}
            accessibilityRole="button"
            accessibilityLabel="필터 닫기"
          >
            <Feather name="x" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

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
                알수없음
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.resetButton} onPress={onReset} activeOpacity={0.7}>
            <Feather name="rotate-ccw" size={14} color={Colors.textSecondary} />
            <Text style={styles.resetText}>초기화</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={onApply} activeOpacity={0.7}>
            <Text style={styles.applyText}>적용</Text>
          </TouchableOpacity>
        </View>
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
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: Colors.background,
  },
  content: {
    gap: 20,
    paddingTop: 4,
    paddingRight: 20,
    paddingBottom: 28,
    paddingLeft: 20,
    backgroundColor: Colors.background,
  },
  header: {
    width: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flexShrink: 1,
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: '#F6F6F6',
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 38,
    justifyContent: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#F6F6F6',
    paddingHorizontal: 20,
    backgroundColor: '#F6F6F6',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  unknownChipSelected: {
    borderColor: Colors.textMuted,
    backgroundColor: '#F6F6F6',
  },
  unknownChipTextSelected: {
    color: Colors.textSecondary,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  resetButton: {
    height: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 9999,
    backgroundColor: Colors.elevated,
  },
  resetText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  applyButton: {
    height: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: Colors.primary,
  },
  applyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
