import { useState, useCallback, useEffect } from "react";
import "./MorphologicalExperiment.css";

interface TokenOutput {
  surface: string;
  baseForm: string;
  reading: string | null;
  baseFormReading: string | null;
  partOfSpeech: string;
  charStart: number;
  charEnd: number;
}

interface AnalyzedLineOutput {
  index: number;
  tokens: TokenOutput[];
  latencyMs: number;
}

interface AnalyzerResult {
  displayName: string;
  lines: AnalyzedLineOutput[] | null;
  error: string | null;
}

interface CompareResponse {
  results: Record<string, AnalyzerResult>;
}

const POS_COLORS: Record<string, string> = {
  VERB: "#6c8cff",
  AUXILIARY_VERB: "#5a7ae0",
  NOUN: "#4ecdc4",
  PRONOUN: "#3dbdb5",
  ADJECTIVE: "#ffa07a",
  NA_ADJECTIVE: "#ff8c5a",
  ADVERB: "#dda0dd",
  PARTICLE: "#666680",
  ADNOMINAL: "#b0a0d0",
  CONJUNCTION: "#a0c0a0",
  INTERJECTION: "#e0c080",
  PREFIX: "#80b0c0",
  SUFFIX: "#80b0c0",
  FILLER: "#c0a060",
  OTHER: "#808080",
  SYMBOL: "#555568",
  SUPPLEMENTARY_SYMBOL: "#555568",
  WHITESPACE: "#444458",
};

const POS_LABELS: Record<string, string> = {
  VERB: "\u52D5\u8A5E",
  AUXILIARY_VERB: "\u52A9\u52D5\u8A5E",
  NOUN: "\u540D\u8A5E",
  PRONOUN: "\u4EE3\u540D\u8A5E",
  ADJECTIVE: "\u5F62\u5BB9\u8A5E",
  NA_ADJECTIVE: "\u5F62\u5BB9\u52D5\u8A5E",
  ADVERB: "\u526F\u8A5E",
  PARTICLE: "\u52A9\u8A5E",
  ADNOMINAL: "\u9023\u4F53\u8A5E",
  CONJUNCTION: "\u63A5\u7D9A\u8A5E",
  INTERJECTION: "\u611F\u52D5\u8A5E",
  PREFIX: "\u63A5\u982D\u8F9E",
  SUFFIX: "\u63A5\u5C3E\u8F9E",
  FILLER: "\u30D5\u30A3\u30E9\u30FC",
  OTHER: "\u305D\u306E\u4ED6",
  SYMBOL: "\u8A18\u53F7",
  SUPPLEMENTARY_SYMBOL: "\u88DC\u52A9\u8A18\u53F7",
  WHITESPACE: "\u7A7A\u767D",
};

const STORAGE_KEY_INPUT = "morph-pg-input";
const STORAGE_KEY_ANALYZERS = "morph-pg-analyzers";

export default function MorphologicalExperiment() {
  const [input, setInput] = useState(() => localStorage.getItem(STORAGE_KEY_INPUT) ?? "");
  const [availableAnalyzers, setAvailableAnalyzers] = useState<string[]>([]);
  const [selectedAnalyzers, setSelectedAnalyzers] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ANALYZERS);
      if (raw) return new Set(JSON.parse(raw));
    } catch { /* ignore */ }
    return new Set<string>();
  });
  const [results, setResults] = useState<CompareResponse | null>(null);
  const [parsedLines, setParsedLines] = useState<{ index: number; text: string }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available analyzers on mount
  useEffect(() => {
    fetch("/api/dev/analyzers")
      .then((res) => res.json())
      .then((names: string[]) => {
        setAvailableAnalyzers(names);
        setSelectedAnalyzers((prev) => {
          // Select all by default, or add any new analyzers not yet in saved selection
          if (prev.size === 0) return new Set(names);
          const next = new Set(prev);
          for (const name of names) {
            if (!next.has(name)) next.add(name);
          }
          localStorage.setItem(STORAGE_KEY_ANALYZERS, JSON.stringify([...next]));
          return next;
        });
      })
      .catch(() => {
        setAvailableAnalyzers(["sudachi", "sudachi-full", "kuromoji", "kagome", "mecab-neologd"]);
      });
  }, []);

  const toggleAnalyzer = useCallback((name: string) => {
    setSelectedAnalyzers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      localStorage.setItem(STORAGE_KEY_ANALYZERS, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const saveInput = useCallback((v: string) => {
    setInput(v);
    localStorage.setItem(STORAGE_KEY_INPUT, v);
  }, []);

  const parseInputLines = useCallback((): { index: number; text: string }[] | null => {
    try {
      const parsed = JSON.parse(input);
      if (!Array.isArray(parsed)) return null;
      return parsed.map((item: { index?: number; text?: string }, i: number) => ({
        index: item.index ?? i,
        text: item.text ?? "",
      })).filter((l: { text: string }) => l.text.trim());
    } catch {
      return null;
    }
  }, [input]);

  const runAnalysis = useCallback(async () => {
    if (!input.trim() || analyzing || selectedAnalyzers.size === 0) return;
    setAnalyzing(true);
    setError(null);

    const lines = parseInputLines();
    if (!lines) {
      setError("Invalid JSON. Expected: [{\"index\": 0, \"text\": \"...\"}]");
      setAnalyzing(false);
      return;
    }

    try {
      const res = await fetch("/api/dev/morphological-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, analyzers: [...selectedAnalyzers] }),
      });

      if (!res.ok) {
        const body = await res.text();
        setError(`${res.status} ${body}`);
      } else {
        const data: CompareResponse = await res.json();
        setResults(data);
        setParsedLines(lines);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }, [input, selectedAnalyzers, analyzing, parseInputLines]);

  return (
    <div className="morph-experiment">
      {/* Analyzer selection */}
      <div className="analyzer-selector">
        <label>Analyzers</label>
        <div className="analyzer-checkboxes">
          {(availableAnalyzers.length > 0 ? availableAnalyzers : ["sudachi", "kuromoji", "kagome", "mecab-neologd"]).map((name) => (
            <label key={name} className="analyzer-checkbox">
              <input
                type="checkbox"
                checked={selectedAnalyzers.has(name)}
                onChange={() => toggleAnalyzer(name)}
              />
              {name}
            </label>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="morph-input-section">
        <label>Input (JSON array)</label>
        <textarea
          value={input}
          onChange={(e) => saveInput(e.target.value)}
          placeholder={'[{"index": 0, "text": "沈むように溶けてゆくように"}, {"index": 1, "text": "二人だけの空が広がる夜に"}]'}
          rows={8}
        />
        <div className="morph-actions">
          <button
            className="morph-analyze-btn"
            onClick={runAnalysis}
            disabled={analyzing || !input.trim() || selectedAnalyzers.size === 0}
          >
            {analyzing ? "Analyzing..." : "Analyze"}
          </button>
          {error && <div className="morph-error-msg">{error}</div>}
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="morph-results">
          {parsedLines.map((line) => (
            <div key={line.index} className="morph-line-block">
              <div className="morph-line-header">
                Line {line.index}: {line.text}
              </div>
              {Object.entries(results.results)
                .sort(([a], [b]) => {
                  const order = availableAnalyzers;
                  const ai = order.indexOf(a);
                  const bi = order.indexOf(b);
                  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                })
                .map(([analyzerName, analyzerResult]) => (
                <div key={analyzerName} className="morph-analyzer-row">
                  <div className="morph-analyzer-label">
                    <span className="morph-analyzer-name">{analyzerResult.displayName}</span>
                    {analyzerResult.lines && (
                      <span className="morph-latency">
                        {analyzerResult.lines.find((l) => l.index === line.index)?.latencyMs ?? "?"}ms
                      </span>
                    )}
                  </div>
                  {analyzerResult.error ? (
                    <div className="morph-analyzer-error">{analyzerResult.error}</div>
                  ) : analyzerResult.lines ? (
                    <div className="morph-tokens">
                      {(analyzerResult.lines.find((l) => l.index === line.index)?.tokens ?? []).map((token, ti) => (
                        <div
                          key={ti}
                          className="morph-token"
                          style={{ borderColor: POS_COLORS[token.partOfSpeech] ?? "#555" }}
                          title={[
                            `baseForm: ${token.baseForm}`,
                            token.reading ? `reading: ${token.reading}` : null,
                            token.baseFormReading ? `baseFormReading: ${token.baseFormReading}` : null,
                            `pos: ${token.partOfSpeech}`,
                            `range: ${token.charStart}-${token.charEnd}`,
                          ].filter(Boolean).join("\n")}
                        >
                          <span className="morph-token-surface">{token.surface}</span>
                          <span
                            className="morph-token-pos"
                            style={{ color: POS_COLORS[token.partOfSpeech] ?? "#555" }}
                          >
                            {POS_LABELS[token.partOfSpeech] ?? token.partOfSpeech}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
