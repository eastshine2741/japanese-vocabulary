import { useState, useCallback, useEffect } from "react";
import "./EnsembleExperiment.css";

// --- Types ---

interface Token {
  surface: string;
  baseForm: string;
  reading: string | null;
  baseFormReading: string | null;
  partOfSpeech: string;
  charStart: number;
  charEnd: number;
}

interface AnalyzerLineResult {
  index: number;
  tokens: Token[];
  latencyMs: number;
}

interface AnalyzerResult {
  displayName: string;
  lines: AnalyzerLineResult[] | null;
  error: string | null;
}

interface CompareResponse {
  results: Record<string, AnalyzerResult>;
}

interface EnsembleToken {
  surface: string;
  baseForm: string;
  partOfSpeech: string;
  charStart: number;
  charEnd: number;
  source: string; // which analyzer it came from
}

interface LlmWordResult {
  surface: string;
  baseForm: string;
  koreanText: string;
}

interface LlmLineResult {
  index: number;
  words: LlmWordResult[];
}

type Strategy = "majority" | "least-split" | "no-fragment" | "llm-pick";

// --- Constants ---

const STRATEGIES: { value: Strategy; label: string; description: string }[] = [
  { value: "majority", label: "다수결", description: "같은 분절에 동의하는 분석기가 많으면 채택" },
  { value: "least-split", label: "Least Split", description: "같은 구간에서 토큰 수가 적은 쪽 채택" },
  { value: "no-fragment", label: "No Fragment", description: "1글자 토큰 연속 시 다른 분석기로 대체" },
  { value: "llm-pick", label: "LLM Pick", description: "분석기 결과가 다른 구간만 LLM에게 선택 요청" },
];

const GEMINI_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

/** Check if a token is a pure symbol/whitespace that should be skipped for LLM/display */
function isSkippableToken(token: { surface: string; partOfSpeech?: string }): boolean {
  // Always skip whitespace
  if (token.partOfSpeech === "WHITESPACE") return true;
  // If POS says symbol, check if surface is actually a meaningful character (kana/kanji)
  if (token.partOfSpeech === "SYMBOL" || token.partOfSpeech === "SUPPLEMENTARY_SYMBOL") {
    return !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/.test(token.surface);
  }
  return false;
}

const DEFAULT_PROMPT = `You receive a JSON array of lyric lines.
Each line has "index", "text", and "words" (morphological analysis results with surface, baseForm, and pos).

The goal is to help a Korean-speaking learner study Japanese vocabulary from lyrics.

STRICT RULES:
1. Output one entry for EACH word in the input "words" array, in the same order.
2. You may correct a wrong baseForm (e.g. いう → いい when context means "good").
3. Do NOT merge or split words. Keep the input segmentation exactly as given.
4. Skip entries where baseForm is a symbol (*, （, ）, ！, 　).
5. When a conjugated form has its own dictionary entry with a meaning distinct from the base word, use that form as baseForm so the learner can look it up directly (e.g. なら → なら "~라면", not だ "~이다").

For each word, return:
- "surface": the exact characters as they appear in the original text
- "baseForm": the form most useful for a learner to look up in a dictionary
- "koreanText": Korean meaning suitable for flashcard study. If the word has multiple relevant meanings, return all with comma-joined.

Korean meaning rules by part of speech:
- NOUN → Korean noun (夜→밤, 人生→인생)
- VERB → Korean verb ending in -다 (走る→달리다)
- ADJECTIVE → Korean adjective ending in -다 (美しい→아름답다)
- NA_ADJECTIVE → Korean adjective ending in -하다 (静か→조용하다)
- ADVERB → Korean adverb (そろそろ→슬슬)
- PRONOUN → Korean pronoun (私→나)
- PARTICLE → Korean grammatical equivalent (は→~은/는)
- AUXILIARY_VERB → Korean grammatical equivalent (です→~입니다)
- PREFIX → meaning of the prefix
- SUFFIX → meaning of the suffix
- CONJUNCTION → Korean conjunction (しかし→하지만)
- INTERJECTION → Korean equivalent

Return ONLY a JSON array:
[{"index": N, "words": [{"surface": "...", "baseForm": "...", "koreanText": "..."}]}]`;

const SK_INPUT = "ens-pg-input";
const SK_ANALYZERS = "ens-pg-analyzers";
const SK_STRATEGY = "ens-pg-strategy";
const SK_FALLBACK = "ens-pg-fallback";
const SK_API = "ens-pg-api-key";
const SK_MODEL = "ens-pg-model";
const SK_PROMPT = "ens-pg-prompt";

// --- Position normalization ---

/** Re-calculate charStart/charEnd by finding each token's surface in the original text sequentially */
function normalizePositions(tokens: Token[], text: string): Token[] {
  let searchFrom = 0;
  return tokens.map((t) => {
    const idx = text.indexOf(t.surface, searchFrom);
    if (idx === -1) return t; // can't find, keep original
    const normalized = { ...t, charStart: idx, charEnd: idx + t.surface.length };
    searchFrom = normalized.charEnd;
    return normalized;
  });
}

/** Normalize all analyzer results for a line */
function normalizeAllPositions(
  analyzerResults: Record<string, Token[]>,
  text: string
): Record<string, Token[]> {
  return Object.fromEntries(
    Object.entries(analyzerResults).map(([name, tokens]) => [name, normalizePositions(tokens, text)])
  );
}

// --- Ensemble logic ---

function buildSegmentKey(tokens: Token[]): string {
  return tokens.map((t) => `${t.charStart}-${t.charEnd}`).join("|");
}

function ensembleMajority(
  analyzerResults: Record<string, Token[]>,
  fallback: string
): EnsembleToken[] {
  const analyzerNames = Object.keys(analyzerResults);
  if (analyzerNames.length === 0) return [];
  if (analyzerNames.length === 1) {
    const name = analyzerNames[0];
    return analyzerResults[name].map((t) => ({ ...t, source: name }));
  }

  // Find the full char range
  let maxEnd = 0;
  for (const tokens of Object.values(analyzerResults)) {
    for (const t of tokens) if (t.charEnd > maxEnd) maxEnd = t.charEnd;
  }

  // For each analyzer, build a map: charStart -> token
  const tokenMaps = Object.fromEntries(
    analyzerNames.map((name) => [
      name,
      new Map(analyzerResults[name].map((t) => [t.charStart, t])),
    ])
  );

  const result: EnsembleToken[] = [];
  let pos = 0;

  while (pos < maxEnd) {
    // Collect what each analyzer has at this position
    const candidates: { name: string; token: Token }[] = [];
    for (const name of analyzerNames) {
      const token = tokenMaps[name].get(pos);
      if (token) candidates.push({ name, token });
    }

    if (candidates.length === 0) {
      pos++;
      continue;
    }

    // Group by charEnd (same segmentation boundary)
    const groups: Record<number, { name: string; token: Token }[]> = {};
    for (const c of candidates) {
      const key = c.token.charEnd;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }

    // Pick group with most votes
    let bestGroup: { name: string; token: Token }[] = [];
    let bestCount = 0;
    for (const group of Object.values(groups)) {
      if (group.length > bestCount) {
        bestCount = group.length;
        bestGroup = group;
      } else if (group.length === bestCount) {
        // Tie: prefer the group containing the fallback analyzer
        if (group.some((g) => g.name === fallback)) {
          bestGroup = group;
        }
      }
    }

    // From the winning group, prefer the fallback analyzer's token
    const winner = bestGroup.find((g) => g.name === fallback) ?? bestGroup[0];
    result.push({ ...winner.token, source: winner.name });
    pos = winner.token.charEnd;
  }

  return result;
}

function ensembleLeastSplit(
  analyzerResults: Record<string, Token[]>,
  fallback: string
): EnsembleToken[] {
  const analyzerNames = Object.keys(analyzerResults);
  if (analyzerNames.length === 0) return [];
  if (analyzerNames.length === 1) {
    const name = analyzerNames[0];
    return analyzerResults[name].map((t) => ({ ...t, source: name }));
  }

  let maxEnd = 0;
  for (const tokens of Object.values(analyzerResults)) {
    for (const t of tokens) if (t.charEnd > maxEnd) maxEnd = t.charEnd;
  }

  const tokenMaps = Object.fromEntries(
    analyzerNames.map((name) => [
      name,
      new Map(analyzerResults[name].map((t) => [t.charStart, t])),
    ])
  );

  const result: EnsembleToken[] = [];
  let pos = 0;

  while (pos < maxEnd) {
    const candidates: { name: string; token: Token }[] = [];
    for (const name of analyzerNames) {
      const token = tokenMaps[name].get(pos);
      if (token) candidates.push({ name, token });
    }

    if (candidates.length === 0) { pos++; continue; }

    // Pick the candidate with the longest span (least split = bigger tokens)
    candidates.sort((a, b) => {
      const diff = (b.token.charEnd - b.token.charStart) - (a.token.charEnd - a.token.charStart);
      if (diff !== 0) return diff;
      return a.name === fallback ? -1 : b.name === fallback ? 1 : 0;
    });

    const winner = candidates[0];
    result.push({ ...winner.token, source: winner.name });
    pos = winner.token.charEnd;
  }

  return result;
}

function ensembleNoFragment(
  analyzerResults: Record<string, Token[]>,
  fallback: string
): EnsembleToken[] {
  const analyzerNames = Object.keys(analyzerResults);
  if (analyzerNames.length === 0) return [];

  // Start with fallback analyzer
  const primary = analyzerResults[fallback] ?? Object.values(analyzerResults)[0];
  const primaryName = analyzerResults[fallback] ? fallback : analyzerNames[0];
  if (!primary) return [];

  // Find consecutive single-char tokens (fragments)
  const result: EnsembleToken[] = [];
  let i = 0;

  while (i < primary.length) {
    const token = primary[i];
    const isFragment = (token.charEnd - token.charStart) === 1;

    if (!isFragment) {
      result.push({ ...token, source: primaryName });
      i++;
      continue;
    }

    // Found a single-char token. Check if there are consecutive ones.
    let fragEnd = i;
    while (fragEnd < primary.length && (primary[fragEnd].charEnd - primary[fragEnd].charStart) === 1) {
      fragEnd++;
    }
    const consecutiveFrags = fragEnd - i;

    if (consecutiveFrags < 2) {
      // Single 1-char token is OK (e.g., a particle like の)
      result.push({ ...token, source: primaryName });
      i++;
      continue;
    }

    // Multiple consecutive fragments - try to find a better analysis from other analyzers
    const fragCharStart = primary[i].charStart;
    const fragCharEnd = primary[fragEnd - 1].charEnd;
    let replaced = false;

    for (const altName of analyzerNames) {
      if (altName === primaryName) continue;
      const altTokens = analyzerResults[altName];
      if (!altTokens) continue;

      // Find tokens that cover this fragment range
      const covering = altTokens.filter(
        (t) => t.charStart >= fragCharStart && t.charEnd <= fragCharEnd
      );
      const coversFullRange =
        covering.length > 0 &&
        covering[0].charStart === fragCharStart &&
        covering[covering.length - 1].charEnd === fragCharEnd;

      if (coversFullRange && covering.length < consecutiveFrags) {
        // Alternative has fewer tokens for same range - use it
        for (const t of covering) {
          result.push({ ...t, source: altName });
        }
        replaced = true;
        break;
      }
    }

    if (!replaced) {
      // No better alternative - keep original fragments
      for (let j = i; j < fragEnd; j++) {
        result.push({ ...primary[j], source: primaryName });
      }
    }

    i = fragEnd;
  }

  return result;
}

// --- Find conflicts between analyzers for a line ---

interface Conflict {
  charStart: number;
  charEnd: number;
  options: Record<string, Token[]>; // analyzerName -> tokens covering this range
}

function findConflicts(analyzerResults: Record<string, Token[]>): Conflict[] {
  const analyzerNames = Object.keys(analyzerResults);
  if (analyzerNames.length < 2) return [];

  const tokenMaps = Object.fromEntries(
    analyzerNames.map((name) => [
      name,
      new Map(analyzerResults[name].map((t) => [t.charStart, t])),
    ])
  );

  let maxEnd = 0;
  for (const tokens of Object.values(analyzerResults)) {
    for (const t of tokens) if (t.charEnd > maxEnd) maxEnd = t.charEnd;
  }

  const conflicts: Conflict[] = [];
  let pos = 0;

  while (pos < maxEnd) {
    const candidates: { name: string; token: Token }[] = [];
    for (const name of analyzerNames) {
      const token = tokenMaps[name].get(pos);
      if (token) candidates.push({ name, token });
    }
    if (candidates.length === 0) { pos++; continue; }

    // Check if all agree on charEnd
    const charEnds = new Set(candidates.map((c) => c.token.charEnd));
    if (charEnds.size === 1) {
      // All agree on this boundary
      pos = candidates[0].token.charEnd;
      continue;
    }

    // Conflict found - determine the full conflict range
    const conflictStart = pos;
    const conflictEnd = Math.max(...candidates.map((c) => c.token.charEnd));

    // Collect each analyzer's tokens covering this range
    const options: Record<string, Token[]> = {};
    for (const name of analyzerNames) {
      const tokens: Token[] = [];
      for (const t of analyzerResults[name]) {
        if (t.charStart >= conflictStart && t.charEnd <= conflictEnd) {
          tokens.push(t);
        }
      }
      if (tokens.length > 0) options[name] = tokens;
    }

    // Deduplicate options by segmentation pattern
    const seen = new Set<string>();
    const dedupedOptions: Record<string, Token[]> = {};
    for (const [name, tokens] of Object.entries(options)) {
      const key = tokens.map((t) => `${t.charStart}-${t.charEnd}`).join("|");
      if (!seen.has(key)) {
        seen.add(key);
        dedupedOptions[name] = tokens;
      }
    }

    if (Object.keys(dedupedOptions).length > 1) {
      conflicts.push({ charStart: conflictStart, charEnd: conflictEnd, options: dedupedOptions });
    }

    pos = conflictEnd;
  }

  return conflicts;
}

interface LlmPickStats {
  latencyMs: number;
  promptTokens: number;
  candidateTokens: number;
  cost: number;
  conflicts: number;
}

async function ensembleLlmPick(
  analyzerResults: Record<string, Token[]>,
  fallback: string,
  lineText: string,
  apiKey: string,
  model: string
): Promise<{ tokens: EnsembleToken[]; stats: LlmPickStats | null }> {
  const analyzerNames = Object.keys(analyzerResults);
  if (analyzerNames.length === 0) return { tokens: [], stats: null };
  if (analyzerNames.length === 1) {
    const name = analyzerNames[0];
    return { tokens: analyzerResults[name].map((t) => ({ ...t, source: name })), stats: null };
  }

  const conflicts = findConflicts(analyzerResults);

  if (conflicts.length === 0) {
    const tokens = analyzerResults[fallback] ?? Object.values(analyzerResults)[0];
    const name = analyzerResults[fallback] ? fallback : analyzerNames[0];
    return { tokens: tokens.map((t) => ({ ...t, source: name })), stats: { latencyMs: 0, promptTokens: 0, candidateTokens: 0, cost: 0, conflicts: 0 } };
  }

  // Build LLM request: only ask about conflicts
  const conflictQuestions = conflicts.map((c, i) => {
    const textSlice = lineText.slice(c.charStart, c.charEnd);
    const choices = Object.entries(c.options).map(([name, tokens]) => ({
      analyzer: name,
      segmentation: tokens.map((t) => t.surface).join(" + "),
    }));
    return { id: i, text: textSlice, choices };
  });

  const llmPrompt = `You are a Japanese language expert. For each conflict below, choose the better word segmentation for a language learner.

For each conflict, respond with the analyzer name that has the better segmentation.

Conflicts:
${JSON.stringify(conflictQuestions, null, 2)}

Return ONLY a JSON array of choices:
[{"id": 0, "chosen": "analyzer_name"}, ...]`;

  const start = performance.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: llmPrompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 1024 },
        }),
      }
    );

    const latencyMs = Math.round(performance.now() - start);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const usage = data?.usageMetadata;
    const promptTokens = usage?.promptTokenCount ?? 0;
    const candidateTokens = usage?.candidatesTokenCount ?? 0;
    const pricing = MODEL_PRICING[model];
    const cost = pricing ? (promptTokens / 1e6) * pricing.input + (candidateTokens / 1e6) * pricing.output : 0;
    const stats: LlmPickStats = { latencyMs, promptTokens, candidateTokens, cost, conflicts: conflicts.length };

    const choices: { id: number; chosen: string }[] = JSON.parse(text);

    const resolutions = new Map<number, string>();
    for (const c of choices) {
      resolutions.set(c.id, c.chosen);
    }

    const baseTokens = analyzerResults[fallback] ?? Object.values(analyzerResults)[0];
    const baseName = analyzerResults[fallback] ? fallback : analyzerNames[0];
    const result: EnsembleToken[] = [];

    let baseIdx = 0;
    for (let ci = 0; ci < conflicts.length; ci++) {
      const conflict = conflicts[ci];

      while (baseIdx < baseTokens.length && baseTokens[baseIdx].charStart < conflict.charStart) {
        result.push({ ...baseTokens[baseIdx], source: baseName });
        baseIdx++;
      }

      const chosenName = resolutions.get(ci) ?? fallback;
      const chosenTokens = conflict.options[chosenName] ?? conflict.options[Object.keys(conflict.options)[0]];
      for (const t of chosenTokens) {
        result.push({ ...t, source: chosenName });
      }

      while (baseIdx < baseTokens.length && baseTokens[baseIdx].charStart < conflict.charEnd) {
        baseIdx++;
      }
    }

    while (baseIdx < baseTokens.length) {
      result.push({ ...baseTokens[baseIdx], source: baseName });
      baseIdx++;
    }

    return { tokens: result, stats };
  } catch (e) {
    console.error("LLM pick failed, falling back to least-split:", e);
    return { tokens: ensembleLeastSplit(analyzerResults, fallback), stats: null };
  }
}

function runEnsemble(
  strategy: Strategy,
  analyzerResults: Record<string, Token[]>,
  fallback: string
): EnsembleToken[] {
  switch (strategy) {
    case "majority": return ensembleMajority(analyzerResults, fallback);
    case "least-split": return ensembleLeastSplit(analyzerResults, fallback);
    case "no-fragment": return ensembleNoFragment(analyzerResults, fallback);
    case "llm-pick": return ensembleLeastSplit(analyzerResults, fallback); // placeholder, actual LLM call is async
  }
}

// --- Component ---

export default function EnsembleExperiment() {
  const [input, setInput] = useState(() => localStorage.getItem(SK_INPUT) ?? "");
  const [availableAnalyzers, setAvailableAnalyzers] = useState<string[]>([]);
  const [selectedAnalyzers, setSelectedAnalyzers] = useState<Set<string>>(() => {
    try { const r = localStorage.getItem(SK_ANALYZERS); if (r) return new Set(JSON.parse(r)); } catch {}
    return new Set(["kuromoji", "sudachi"]);
  });
  const [strategy, setStrategy] = useState<Strategy>(() => (localStorage.getItem(SK_STRATEGY) as Strategy) ?? "no-fragment");
  const [fallback, setFallback] = useState(() => localStorage.getItem(SK_FALLBACK) ?? "kuromoji");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(SK_API) ?? "");
  const [model, setModel] = useState(() => localStorage.getItem(SK_MODEL) ?? "gemini-3.1-flash-lite-preview");
  const [prompt, setPrompt] = useState(() => localStorage.getItem(SK_PROMPT) ?? DEFAULT_PROMPT);

  const [morphResults, setMorphResults] = useState<CompareResponse | null>(null);
  const [ensembleResults, setEnsembleResults] = useState<Record<number, EnsembleToken[]>>({});
  const [ensembleStats, setEnsembleStats] = useState<{ latencyMs: number; promptTokens: number; candidateTokens: number; cost: number; conflicts: number } | null>(null);
  const [llmResults, setLlmResults] = useState<LlmLineResult[] | null>(null);
  const [llmRawJson, setLlmRawJson] = useState<string | null>(null);
  const [llmStats, setLlmStats] = useState<{ latencyMs: number; promptTokens: number; candidateTokens: number; cost: number } | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sendingLlm, setSendingLlm] = useState(false);
  const [parsedLines, setParsedLines] = useState<{ index: number; text: string }[]>([]);

  useEffect(() => {
    fetch("/api/dev/analyzers").then((r) => r.json()).then((names: string[]) => {
      setAvailableAnalyzers(names);
    }).catch(() => setAvailableAnalyzers(["sudachi", "sudachi-full", "kuromoji", "kagome", "mecab-neologd"]));
  }, []);

  const save = useCallback((key: string, val: string) => localStorage.setItem(key, val), []);

  const toggleAnalyzer = useCallback((name: string) => {
    setSelectedAnalyzers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      save(SK_ANALYZERS, JSON.stringify([...next]));
      return next;
    });
  }, [save]);

  // --- Run morphological analysis + ensemble ---
  const runAnalysis = useCallback(async () => {
    if (!input.trim() || analyzing) return;
    setAnalyzing(true);
    setLlmResults(null);
    setLlmRawJson(null);
    setLlmStats(null);
    setLlmError(null);

    try {
      const parsed = JSON.parse(input);
      const lines = Array.isArray(parsed)
        ? parsed.map((item: { index?: number; text?: string }, i: number) => ({ index: item.index ?? i, text: item.text ?? "" }))
        : [];
      setParsedLines(lines);

      const res = await fetch("/api/dev/morphological-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, analyzers: [...selectedAnalyzers] }),
      });

      if (!res.ok) return;

      const data: CompareResponse = await res.json();
      setMorphResults(data);

      // Run ensemble for each line
      const ensemble: Record<number, EnsembleToken[]> = {};
      let totalStats: LlmPickStats = { latencyMs: 0, promptTokens: 0, candidateTokens: 0, cost: 0, conflicts: 0 };
      setEnsembleStats(null);
      for (const line of lines) {
        let analyzerTokens: Record<string, Token[]> = {};
        for (const [name, result] of Object.entries(data.results)) {
          if (!result.lines) continue;
          const lineResult = result.lines.find((l) => l.index === line.index);
          if (lineResult) analyzerTokens[name] = lineResult.tokens;
        }
        analyzerTokens = normalizeAllPositions(analyzerTokens, line.text);
        if (strategy === "llm-pick" && apiKey.trim()) {
          const { tokens, stats } = await ensembleLlmPick(analyzerTokens, fallback, line.text, apiKey, model);
          ensemble[line.index] = tokens;
          if (stats) {
            totalStats = { latencyMs: totalStats.latencyMs + stats.latencyMs, promptTokens: totalStats.promptTokens + stats.promptTokens, candidateTokens: totalStats.candidateTokens + stats.candidateTokens, cost: totalStats.cost + stats.cost, conflicts: totalStats.conflicts + stats.conflicts };
          }
        } else {
          ensemble[line.index] = runEnsemble(strategy, analyzerTokens, fallback);
        }
      }
      setEnsembleResults(ensemble);
      if (strategy === "llm-pick") setEnsembleStats(totalStats);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  }, [input, selectedAnalyzers, strategy, fallback, analyzing, apiKey, model]);

  // --- Re-run ensemble when strategy/fallback changes ---
  const rerunEnsemble = useCallback(async () => {
    if (!morphResults) return;
    setAnalyzing(true);
    setEnsembleStats(null);
    const ensemble: Record<number, EnsembleToken[]> = {};
    let totalStats: LlmPickStats = { latencyMs: 0, promptTokens: 0, candidateTokens: 0, cost: 0, conflicts: 0 };
    for (const line of parsedLines) {
      let analyzerTokens: Record<string, Token[]> = {};
      for (const [name, result] of Object.entries(morphResults.results)) {
        if (!result.lines) continue;
        const lineResult = result.lines.find((l) => l.index === line.index);
        if (lineResult) analyzerTokens[name] = lineResult.tokens;
      }
      analyzerTokens = normalizeAllPositions(analyzerTokens, line.text);
      if (strategy === "llm-pick" && apiKey.trim()) {
        const { tokens, stats } = await ensembleLlmPick(analyzerTokens, fallback, line.text, apiKey, model);
        ensemble[line.index] = tokens;
        if (stats) {
          totalStats = { latencyMs: totalStats.latencyMs + stats.latencyMs, promptTokens: totalStats.promptTokens + stats.promptTokens, candidateTokens: totalStats.candidateTokens + stats.candidateTokens, cost: totalStats.cost + stats.cost, conflicts: totalStats.conflicts + stats.conflicts };
        }
      } else {
        ensemble[line.index] = runEnsemble(strategy, analyzerTokens, fallback);
      }
    }
    setEnsembleResults(ensemble);
    if (strategy === "llm-pick") setEnsembleStats(totalStats);
    setAnalyzing(false);
  }, [morphResults, parsedLines, strategy, fallback, apiKey, model]);

  // --- Send ensemble to LLM ---
  const sendToLlm = useCallback(async () => {
    if (!apiKey.trim() || Object.keys(ensembleResults).length === 0 || sendingLlm) return;
    setSendingLlm(true);
    setLlmError(null);
    setLlmResults(null);
    setLlmRawJson(null);
    setLlmStats(null);

    const geminiInput = parsedLines.map((line) => {
      const tokens = ensembleResults[line.index] ?? [];
      return {
        index: line.index,
        text: line.text,
        words: tokens.filter((t) => !isSkippableToken(t)).map((t) => ({
          surface: t.surface,
          baseForm: t.baseForm,
          pos: t.partOfSpeech,
        })),
      };
    });

    const requestBody: Record<string, unknown> = {
      contents: [{ parts: [{ text: JSON.stringify(geminiInput) }] }],
      generationConfig: { temperature: 0, topP: 0.95, topK: 40, maxOutputTokens: 8192, responseMimeType: "application/json" },
    };
    if (prompt.trim()) {
      requestBody.system_instruction = { parts: [{ text: prompt }] };
    }

    const start = performance.now();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }
      );
      const latencyMs = Math.round(performance.now() - start);
      const data = await res.json();

      if (!res.ok) {
        setLlmError(data?.error?.message || `HTTP ${res.status}`);
        return;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const usage = data?.usageMetadata;
      const promptTokens = usage?.promptTokenCount ?? 0;
      const candidateTokens = usage?.candidatesTokenCount ?? 0;
      const pricing = MODEL_PRICING[model];
      const cost = pricing ? (promptTokens / 1e6) * pricing.input + (candidateTokens / 1e6) * pricing.output : 0;

      setLlmStats({ latencyMs, promptTokens, candidateTokens, cost });

      try {
        const parsed = JSON.parse(text);
        setLlmResults(parsed);
        setLlmRawJson(JSON.stringify(parsed, null, 2));
      } catch {
        setLlmError(`JSON parse failed: ${text.slice(0, 200)}`);
        setLlmRawJson(text);
      }
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingLlm(false);
    }
  }, [apiKey, model, prompt, ensembleResults, parsedLines, sendingLlm]);

  const POS_COLORS: Record<string, string> = {
    VERB: "#6c8cff", AUXILIARY_VERB: "#5a7ae0", NOUN: "#4ecdc4", PRONOUN: "#3dbdb5",
    ADJECTIVE: "#ffa07a", NA_ADJECTIVE: "#ff8c5a", ADVERB: "#dda0dd", PARTICLE: "#666680",
    CONJUNCTION: "#a0c0a0", INTERJECTION: "#e0c080", PREFIX: "#80b0c0", SUFFIX: "#80b0c0",
  };

  const analyzerNames = Object.keys(morphResults?.results ?? {});

  return (
    <div className="ens-experiment">
      {/* Config bar */}
      <div className="ens-config">
        <div className="ens-config-row">
          <label>Analyzers</label>
          <div className="ens-checkboxes">
            {(availableAnalyzers.length > 0 ? availableAnalyzers : ["kuromoji", "sudachi"]).map((name) => (
              <label key={name} className="ens-cb">
                <input type="checkbox" checked={selectedAnalyzers.has(name)} onChange={() => toggleAnalyzer(name)} />
                {name}
              </label>
            ))}
          </div>
        </div>
        <div className="ens-config-row">
          <label>Strategy</label>
          <select value={strategy} onChange={(e) => { const v = e.target.value as Strategy; setStrategy(v); save(SK_STRATEGY, v); }}>
            {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.description}</option>)}
          </select>
        </div>
        <div className="ens-config-row">
          <label>Fallback Priority</label>
          <select value={fallback} onChange={(e) => { setFallback(e.target.value); save(SK_FALLBACK, e.target.value); }}>
            {[...selectedAnalyzers].map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="ens-config-row">
          <label>API Key</label>
          <input type="password" placeholder="AIza..." value={apiKey} onChange={(e) => { setApiKey(e.target.value); save(SK_API, e.target.value); }} className="ens-api-input" />
        </div>
        <div className="ens-config-row">
          <label>Model</label>
          <select value={model} onChange={(e) => { setModel(e.target.value); save(SK_MODEL, e.target.value); }}>
            {GEMINI_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Prompt */}
      <details className="ens-prompt-section">
        <summary>System Prompt</summary>
        <textarea value={prompt} onChange={(e) => { setPrompt(e.target.value); save(SK_PROMPT, e.target.value); }} rows={10} />
      </details>

      {/* Input + actions */}
      <div className="ens-input-section">
        <label>Input (JSON)</label>
        <textarea value={input} onChange={(e) => { setInput(e.target.value); save(SK_INPUT, e.target.value); }} rows={5}
          placeholder={'[{"index": 0, "text": "うるせえなもう"}]'} />
        <div className="ens-actions">
          <button className="ens-btn-primary" onClick={runAnalysis} disabled={analyzing || !input.trim() || selectedAnalyzers.size < 2}>
            {analyzing ? "Analyzing..." : "Analyze + Ensemble"}
          </button>
          {morphResults && (
            <button className="ens-btn-secondary" onClick={rerunEnsemble}>Re-ensemble</button>
          )}
          {Object.keys(ensembleResults).length > 0 && (
            <button className="ens-btn-primary" onClick={sendToLlm} disabled={sendingLlm || !apiKey.trim()}>
              {sendingLlm ? "Sending..." : "Send to LLM"}
            </button>
          )}
        </div>
      </div>

      {/* Ensemble stats (LLM Pick) */}
      {ensembleStats && (
        <div className="ens-ensemble-stats">
          <span className="ens-ensemble-stats-label">LLM Pick</span>
          <span className="ens-stat">{ensembleStats.conflicts} conflicts</span>
          <span className="ens-stat">{ensembleStats.latencyMs}ms</span>
          <span className="ens-stat">in:{ensembleStats.promptTokens}</span>
          <span className="ens-stat">out:{ensembleStats.candidateTokens}</span>
          <span className="ens-stat ens-cost">${ensembleStats.cost.toFixed(6)}</span>
        </div>
      )}

      {/* Results */}
      {parsedLines.length > 0 && morphResults && (
        <div className="ens-results">
          {parsedLines.map((line) => {
            const ensemble = ensembleResults[line.index] ?? [];
            const llmLine = llmResults?.find((l) => l.index === line.index);

            return (
              <div key={line.index} className="ens-line-block">
                <div className="ens-line-header">Line {line.index}: {line.text}</div>

                {/* Individual analyzers */}
                {analyzerNames.map((name) => {
                  const result = morphResults.results[name];
                  if (!result?.lines) return <div key={name} className="ens-analyzer-row"><span className="ens-analyzer-name">{result?.displayName ?? name}</span><span className="ens-error">{result?.error}</span></div>;
                  const tokens = result.lines.find((l) => l.index === line.index)?.tokens ?? [];
                  return (
                    <div key={name} className="ens-analyzer-row">
                      <span className="ens-analyzer-name">{result.displayName}</span>
                      <div className="ens-tokens">
                        {tokens.filter((t) => !isSkippableToken(t)).map((t, i) => (
                          <span key={i} className="ens-token" style={{ borderColor: POS_COLORS[t.partOfSpeech] ?? "#555" }}
                            title={`baseForm: ${t.baseForm}\npos: ${t.partOfSpeech}\nrange: ${t.charStart}-${t.charEnd}`}>
                            {t.surface}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Ensemble result */}
                <div className="ens-analyzer-row ens-ensemble-row">
                  <span className="ens-analyzer-name ens-ensemble-label">Ensemble</span>
                  <div className="ens-tokens">
                    {ensemble.filter((t) => !isSkippableToken(t)).map((t, i) => (
                      <span key={i} className="ens-token ens-token-ensemble" style={{ borderColor: POS_COLORS[t.partOfSpeech] ?? "#555" }}
                        title={`baseForm: ${t.baseForm}\npos: ${t.partOfSpeech}\nsource: ${t.source}\nrange: ${t.charStart}-${t.charEnd}`}>
                        <span className="ens-token-surface">{t.surface}</span>
                        <span className="ens-token-source">{t.source}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* LLM meanings */}
                {llmLine && (
                  <div className="ens-llm-row">
                    <span className="ens-analyzer-name ens-llm-label">LLM</span>
                    <div className="ens-tokens">
                      {llmLine.words.map((w, i) => (
                        <span key={i} className="ens-token ens-token-llm" title={`baseForm: ${w.baseForm}`}>
                          <span className="ens-token-surface">{w.surface}</span>
                          <span className="ens-token-meaning">{w.koreanText}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LLM stats */}
      {(llmStats || llmError) && (
        <div className="ens-llm-stats">
          {llmError && <span className="ens-error">{llmError}</span>}
          {llmStats && (
            <>
              <span className="ens-stat">{llmStats.latencyMs}ms</span>
              <span className="ens-stat">in:{llmStats.promptTokens}</span>
              <span className="ens-stat">out:{llmStats.candidateTokens}</span>
              <span className="ens-stat ens-cost">${llmStats.cost.toFixed(6)}</span>
            </>
          )}
          {llmRawJson && (
            <details className="ens-raw-json">
              <summary>Raw JSON</summary>
              <pre>{llmRawJson}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
