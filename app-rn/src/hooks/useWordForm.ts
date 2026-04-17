import { useState, useMemo, useCallback } from 'react';
import { WordMeaning } from '../types/word';

export function useWordForm(initialReading: string, initialMeanings: WordMeaning[]) {
  const [reading, setReading] = useState(initialReading);
  const [meanings, setMeanings] = useState<WordMeaning[]>(initialMeanings);
  const [touchedIndices, setTouchedIndices] = useState<Set<number>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const updateMeaningText = useCallback((index: number, text: string) => {
    setMeanings(prev => prev.map((m, i) => (i === index ? { ...m, text } : m)));
  }, []);

  const updateMeaningPos = useCallback((index: number, pos: string) => {
    setMeanings(prev => prev.map((m, i) => (i === index ? { ...m, partOfSpeech: pos } : m)));
  }, []);

  const addMeaning = useCallback(() => {
    setMeanings(prev => {
      const lastPos = prev.length > 0 ? prev[prev.length - 1].partOfSpeech : 'NOUN';
      return [...prev, { text: '', partOfSpeech: lastPos }];
    });
  }, []);

  const removeMeaning = useCallback((index: number) => {
    setMeanings(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setTouchedIndices(prev => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      }
      return next;
    });
  }, []);

  const markTouched = useCallback((index: number) => {
    setTouchedIndices(prev => new Set(prev).add(index));
  }, []);

  const hasEmptyMeaning = useMemo(() => meanings.some(m => m.text.trim() === ''), [meanings]);

  const shouldShowError = (index: number): boolean => {
    return (submitAttempted || touchedIndices.has(index)) && meanings[index]?.text.trim() === '';
  };

  const reset = useCallback((newReading: string, newMeanings: WordMeaning[]) => {
    setReading(newReading);
    setMeanings(newMeanings);
    setTouchedIndices(new Set());
    setSubmitAttempted(false);
  }, []);

  return {
    reading, setReading,
    meanings, setMeanings,
    submitAttempted, setSubmitAttempted,
    updateMeaningText, updateMeaningPos,
    addMeaning, removeMeaning,
    markTouched, shouldShowError,
    hasEmptyMeaning,
    reset,
  };
}
