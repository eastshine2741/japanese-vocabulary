import { useState, useMemo, useCallback } from 'react';
import { WordSense } from '../types/word';

/**
 * 뜻 단위 편집 폼. 폼이 직접 다루는 건 meaning 과 partOfSpeech 뿐이고,
 * jlpt·examples 는 그 뜻에 붙은 채로 그대로 실려 나간다 — 저장이 senses 전체 replace 라서
 * 폼이 들고 있지 않은 필드는 그대로 사라지기 때문이다.
 */
export function useWordForm(initialReading: string, initialSenses: WordSense[]) {
  const [reading, setReading] = useState(initialReading);
  const [senses, setSenses] = useState<WordSense[]>(initialSenses);
  const [touchedIndices, setTouchedIndices] = useState<Set<number>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const updateMeaningText = useCallback((index: number, meaning: string) => {
    setSenses(prev => prev.map((s, i) => (i === index ? { ...s, meaning } : s)));
  }, []);

  const updateMeaningPos = useCallback((index: number, partOfSpeech: string) => {
    setSenses(prev => prev.map((s, i) => (i === index ? { ...s, partOfSpeech } : s)));
  }, []);

  const addMeaning = useCallback(() => {
    setSenses(prev => {
      const lastPos = prev.length > 0 ? prev[prev.length - 1].partOfSpeech : 'NOUN';
      return [...prev, { meaning: '', partOfSpeech: lastPos, jlpt: null, examples: [] }];
    });
  }, []);

  const removeMeaning = useCallback((index: number) => {
    setSenses(prev => {
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

  const removeExample = useCallback((senseIndex: number, exampleIndex: number) => {
    setSenses(prev => prev.map((s, i) => (
      i === senseIndex
        ? { ...s, examples: (s.examples ?? []).filter((_, j) => j !== exampleIndex) }
        : s
    )));
  }, []);

  const markTouched = useCallback((index: number) => {
    setTouchedIndices(prev => new Set(prev).add(index));
  }, []);

  const hasEmptyMeaning = useMemo(() => senses.some(s => s.meaning.trim() === ''), [senses]);

  const shouldShowError = (index: number): boolean => {
    return (submitAttempted || touchedIndices.has(index)) && senses[index]?.meaning.trim() === '';
  };

  const reset = useCallback((newReading: string, newSenses: WordSense[]) => {
    setReading(newReading);
    setSenses(newSenses);
    setTouchedIndices(new Set());
    setSubmitAttempted(false);
  }, []);

  return {
    reading, setReading,
    senses, setSenses,
    submitAttempted, setSubmitAttempted,
    updateMeaningText, updateMeaningPos,
    addMeaning, removeMeaning, removeExample,
    markTouched, shouldShowError,
    hasEmptyMeaning,
    reset,
  };
}
