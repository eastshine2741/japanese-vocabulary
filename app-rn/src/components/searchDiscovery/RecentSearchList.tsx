import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useShallow } from 'zustand/react/shallow';
import { useSearchHistoryStore } from '../../stores/searchHistoryStore';
import { Colors, Dimens } from '../../theme/theme';

const MAX_TERMS = 5;

interface Props {
  onSelectTerm: (term: string) => void;
}

export default function RecentSearchList({ onSelectTerm }: Props) {
  const { terms, removeTerm } = useSearchHistoryStore(
    useShallow((s) => ({ terms: s.terms, removeTerm: s.remove })),
  );

  const termRows = useMemo(() => terms.slice(0, MAX_TERMS), [terms]);

  if (termRows.length === 0) return null;

  return (
    <View>
      {termRows.map((term) => (
        <TermRow key={term} term={term} onSelect={onSelectTerm} onRemove={removeTerm} />
      ))}
    </View>
  );
}

interface TermRowProps {
  term: string;
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
}

const TermRow = React.memo(function TermRow({ term, onSelect, onRemove }: TermRowProps) {
  const handleSelect = useCallback(() => onSelect(term), [onSelect, term]);
  const handleRemove = useCallback(() => onRemove(term), [onRemove, term]);

  return (
    <TouchableOpacity style={styles.termRow} onPress={handleSelect} activeOpacity={0.72}>
      <HistoryIcon />
      <View style={styles.termClip}>
        <Text style={styles.termText} numberOfLines={1} ellipsizeMode="clip">
          {term}
        </Text>
      </View>
      <TouchableOpacity onPress={handleRemove} hitSlop={8}>
        <XIcon />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

function HistoryIcon() {
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={Colors.textMuted}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 12a9 9 0 1 0 3-6.7" />
      <Path d="M3 3v6h6" />
      <Path d="M12 7v5l4 2" />
    </Svg>
  );
}

function XIcon() {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={Colors.textMuted}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  termRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Dimens.screenPadding,
  },
  termClip: {
    flex: 1,
    height: 22,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  termText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
});
