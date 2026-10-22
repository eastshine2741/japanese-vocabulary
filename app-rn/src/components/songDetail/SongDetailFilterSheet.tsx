import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../../theme/theme';
import { getPosColor, getPosLabel } from '../../types/pos';
import { getJlptColor } from '../Badges';
import { Button, Chip, SectionLabel, SheetHeader } from '../ui';

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
  onClose: () => void;
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
  return <Chip label={getPosLabel(pos)} selected={selected} onPress={handlePress} tint={getPosColor(pos)} />;
});

const JlptChip = React.memo(function JlptChip({ jlpt, selected, onToggle }: JlptChipProps) {
  const handlePress = useCallback(() => {
    onToggle(jlpt);
  }, [onToggle, jlpt]);
  return <Chip label={jlpt} selected={selected} onPress={handlePress} tint={getJlptColor(jlpt)} />;
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
        <SheetHeader title="필터" onClose={onClose} closeAccessibilityLabel="필터 닫기" />

        <View style={styles.section}>
          <SectionLabel>품사</SectionLabel>
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
          <SectionLabel>JLPT</SectionLabel>
          <View style={styles.chipGrid}>
            {availableJlpt.map(jlpt => (
              <JlptChip
                key={jlpt}
                jlpt={jlpt}
                selected={selectedJlpt.has(jlpt)}
                onToggle={onToggleJlpt}
              />
            ))}
            <Chip
              label="알 수 없음"
              selected={includeUnknownJlpt}
              onPress={onToggleUnknownJlpt}
              tint={Colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Button label="초기화" icon="refresh" variant="secondary" onPress={onReset} style={styles.action} />
          <Button label="적용" onPress={onApply} style={styles.action} />
        </View>
      </View>
    </View>
  );
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
  section: {
    gap: 10,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
