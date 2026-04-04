import { useState, useCallback, useRef } from "react";
import "./WordMeaningExperiment.css";

// --- Types ---

interface PanelConfig {
  id: string;
  name: string;
  model: string;
  morphOn: boolean;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
}

interface PanelResult {
  lines: { index: number; words: { baseForm: string; koreanText: string }[] }[] | null;
  rawJson: string | null;
  error: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  candidateTokens: number | null;
  totalTokens: number | null;
  cost: number | null;
  loading: boolean;
}

interface MorphLine {
  index: number;
  text: string;
  words: { surface: string; baseForm: string; pos: string }[];
}

// --- Constants ---

const GEMINI_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-pro-preview": { input: 2.0, output: 12.0 },
  "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
  "gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

const DEFAULT_PROMPT_ON = `You receive a JSON array of lyric lines.
Each line has "index", "text", and "words" (morphological analysis results with surface, baseForm, and pos).

The goal is to help a Korean-speaking learner study Japanese vocabulary from lyrics.

STRICT RULES:
1. Output one entry for EACH word in the input "words" array, in the same order.
2. You may correct a wrong baseForm (e.g. いう → いい when context means "good").
3. You may MERGE two adjacent words ONLY when they clearly form a single dictionary word that was incorrectly split (e.g. 随 + に → 随に).
4. Do NOT merge words just because they often appear together. Keep the input segmentation.
5. Skip entries where baseForm is a symbol (*, （, ）, ！, 　).
6. When a conjugated form has its own dictionary entry with a meaning distinct from the base word, use that form as baseForm so the learner can look it up directly (e.g. なら → なら "~라면", not だ "~이다").

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

const DEFAULT_PROMPT_OFF = `You receive a JSON array of lyric lines.
Each line has "index" and "text" (raw Japanese lyrics).

For each line:
1. Identify all morphemes in the text
2. For each word, determine its dictionary form (基本形/baseForm)
3. Provide the Korean meaning suitable for flashcard study. If the word has multiple relevant meanings, return all with comma-joined.

For each word, return:
- "surface": the exact characters as they appear in the original text
- "baseForm": the dictionary form (基本形)
- "koreanText": Korean meaning

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

const STORAGE_KEY_API = "wm-pg-api-key";
const STORAGE_KEY_INPUT = "wm-pg-input";
const STORAGE_KEY_PANELS = "wm-pg-panels";
const STORAGE_KEY_PROMPT_ON = "wm-pg-prompt-on";
const STORAGE_KEY_PROMPT_OFF = "wm-pg-prompt-off";

const EMPTY_RESULT: PanelResult = {
  lines: null, rawJson: null, error: null, latencyMs: null, promptTokens: null, candidateTokens: null, totalTokens: null, cost: null, loading: false,
};

function createPanel(index: number, morphOn: boolean): PanelConfig {
  return {
    id: crypto.randomUUID(),
    name: `Panel ${index}`,
    model: "gemini-2.5-flash-lite",
    morphOn,
    temperature: 0,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
  };
}

function loadPanels(): PanelConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PANELS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [createPanel(1, true), createPanel(2, false)];
}

function calcCost(model: string, promptTokens: number, candidateTokens: number): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  return (promptTokens / 1_000_000) * p.input + (candidateTokens / 1_000_000) * p.output;
}

// --- Component ---

export default function WordMeaningExperiment() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY_API) ?? "");
  const [input, setInput] = useState(() => localStorage.getItem(STORAGE_KEY_INPUT) ?? "");
  const [promptOn, setPromptOn] = useState(() => localStorage.getItem(STORAGE_KEY_PROMPT_ON) ?? DEFAULT_PROMPT_ON);
  const [promptOff, setPromptOff] = useState(() => localStorage.getItem(STORAGE_KEY_PROMPT_OFF) ?? DEFAULT_PROMPT_OFF);
  const [panels, setPanels] = useState<PanelConfig[]>(loadPanels);
  const [results, setResults] = useState<Record<string, PanelResult>>({});
  const [morphLines, setMorphLines] = useState<MorphLine[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [sending, setSending] = useState(false);
  const [morphError, setMorphError] = useState<string | null>(null);
  const panelCounter = useRef(panels.length);

  // --- Persistence helpers ---
  const saveApiKey = useCallback((v: string) => { setApiKey(v); localStorage.setItem(STORAGE_KEY_API, v); }, []);
  const saveInput = useCallback((v: string) => { setInput(v); localStorage.setItem(STORAGE_KEY_INPUT, v); }, []);
  const savePromptOn = useCallback((v: string) => { setPromptOn(v); localStorage.setItem(STORAGE_KEY_PROMPT_ON, v); }, []);
  const savePromptOff = useCallback((v: string) => { setPromptOff(v); localStorage.setItem(STORAGE_KEY_PROMPT_OFF, v); }, []);
  const savePanels = useCallback((p: PanelConfig[]) => { setPanels(p); localStorage.setItem(STORAGE_KEY_PANELS, JSON.stringify(p)); }, []);

  const addPanel = useCallback((morphOn: boolean) => {
    panelCounter.current += 1;
    savePanels([...panels, createPanel(panelCounter.current, morphOn)]);
  }, [panels, savePanels]);

  const removePanel = useCallback((id: string) => {
    savePanels(panels.filter((p) => p.id !== id));
  }, [panels, savePanels]);

  const updatePanel = useCallback((id: string, patch: Partial<PanelConfig>) => {
    savePanels(panels.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, [panels, savePanels]);

  // --- Morphological analysis (kuromoji via compare endpoint) ---
  const runMorphAnalysis = useCallback(async () => {
    if (!input.trim() || analyzing) return;
    setAnalyzing(true);
    setMorphError(null);
    try {
      const parsed = JSON.parse(input);
      const lines = Array.isArray(parsed)
        ? parsed.map((item: { index?: number; text?: string }, i: number) => ({ index: item.index ?? i, text: item.text ?? "" }))
        : [];
      const res = await fetch("/api/dev/morphological-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, analyzers: ["kuromoji"] }),
      });
      if (!res.ok) {
        setMorphError(`${res.status} ${await res.text()}`);
      } else {
        const data: { results: Record<string, { lines: { index: number; tokens: { surface: string; baseForm: string; partOfSpeech: string }[] }[] | null }> } = await res.json();
        const kuromojiResult = data.results["kuromoji"];
        if (!kuromojiResult?.lines) {
          setMorphError("Kuromoji analysis failed");
        } else {
          const morphData: MorphLine[] = kuromojiResult.lines.map((l) => ({
            index: l.index,
            text: lines.find((li: { index: number }) => li.index === l.index)?.text ?? "",
            words: l.tokens.map((t) => ({ surface: t.surface, baseForm: t.baseForm, pos: t.partOfSpeech })),
          }));
          setMorphLines(morphData);
        }
      }
    } catch (e) {
      setMorphError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }, [input, analyzing]);

  // --- Send single panel to Gemini ---
  const sendPanel = useCallback(async (panel: PanelConfig) => {
    if (!apiKey.trim() || morphLines.length === 0) return;

    setResults((prev) => ({ ...prev, [panel.id]: { ...EMPTY_RESULT, loading: true } }));

    const SKIP_POS = new Set(["SYMBOL", "SUPPLEMENTARY_SYMBOL", "WHITESPACE"]);
    const geminiInput = panel.morphOn
      ? morphLines.map((l) => ({ index: l.index, text: l.text, words: l.words.filter((w) => !SKIP_POS.has(w.pos)) }))
      : morphLines.map((l) => ({ index: l.index, text: l.text }));

    const systemPrompt = panel.morphOn ? promptOn : promptOff;

    const requestBody: Record<string, unknown> = {
      contents: [{ parts: [{ text: JSON.stringify(geminiInput) }] }],
      generationConfig: {
        temperature: panel.temperature,
        topP: panel.topP,
        topK: panel.topK,
        maxOutputTokens: panel.maxOutputTokens,
        responseMimeType: "application/json",
      },
    };
    if (systemPrompt.trim()) {
      requestBody.system_instruction = { parts: [{ text: systemPrompt }] };
    }

    console.log(`[${panel.name}] model=${panel.model} morphOn=${panel.morphOn} temp=${panel.temperature}`);
    console.log(`[${panel.name}] system prompt (first 200 chars):`, systemPrompt.slice(0, 200));
    console.log(`[${panel.name}] input words count per line:`, geminiInput.map((l: Record<string, unknown>) => ({ index: l.index, words: (l as { words?: unknown[] }).words?.length ?? "no words" })));
    console.log(`[${panel.name}] full request body:`, JSON.stringify(requestBody).slice(0, 500));

    const start = performance.now();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${panel.model}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }
      );
      const latencyMs = Math.round(performance.now() - start);
      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        setResults((prev) => ({ ...prev, [panel.id]: { ...EMPTY_RESULT, error: msg, latencyMs } }));
        return;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const usage = data?.usageMetadata;
      const promptTokens = usage?.promptTokenCount ?? 0;
      const candidateTokens = usage?.candidatesTokenCount ?? 0;
      const totalTokens = usage?.totalTokenCount ?? 0;
      const cost = calcCost(panel.model, promptTokens, candidateTokens);

      let lines: { index: number; words: { baseForm: string; koreanText: string }[] }[] | null = null;
      let rawJson: string | null = text;
      try {
        lines = JSON.parse(text);
        rawJson = JSON.stringify(lines, null, 2);
      } catch {
        setResults((prev) => ({
          ...prev,
          [panel.id]: { ...EMPTY_RESULT, rawJson: text, error: `JSON parse failed: ${text.slice(0, 200)}`, latencyMs, promptTokens, candidateTokens, totalTokens, cost },
        }));
        return;
      }

      setResults((prev) => ({
        ...prev,
        [panel.id]: { lines, rawJson, error: null, latencyMs, promptTokens, candidateTokens, totalTokens, cost, loading: false },
      }));
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [panel.id]: { ...EMPTY_RESULT, error: e instanceof Error ? e.message : String(e), latencyMs: Math.round(performance.now() - start) },
      }));
    }
  }, [apiKey, morphLines, promptOn, promptOff]);

  // --- Send all panels ---
  const sendAll = useCallback(async () => {
    if (!apiKey.trim() || morphLines.length === 0 || sending) return;
    setSending(true);
    await Promise.allSettled(panels.map((p) => sendPanel(p)));
    setSending(false);
  }, [apiKey, morphLines, panels, sending, sendPanel]);

  // --- Build word list for result table (from morphological analysis) ---
  const morphWordsByLine: Record<number, { baseForm: string; pos: string }[]> = {};
  for (const line of morphLines) {
    morphWordsByLine[line.index] = line.words;
  }

  return (
    <div className="wm-experiment">
      {/* API Key */}
      <div className="wm-header">
        <div className="wm-api-row">
          <label>API Key</label>
          <input type="password" placeholder="AIza..." value={apiKey} onChange={(e) => saveApiKey(e.target.value)} className="wm-api-input" />
        </div>
      </div>

      {/* System prompts side by side */}
      <div className="wm-prompts">
        <div className="wm-prompt-box">
          <label>System Prompt A (morph ON)</label>
          <textarea value={promptOn} onChange={(e) => savePromptOn(e.target.value)} rows={8} />
        </div>
        <div className="wm-prompt-box">
          <label>System Prompt B (morph OFF)</label>
          <textarea value={promptOff} onChange={(e) => savePromptOff(e.target.value)} rows={8} />
        </div>
      </div>

      {/* Input pipeline */}
      <div className="wm-pipeline">
        <div className="wm-pipe-step">
          <label>Input (JSON)</label>
          <textarea value={input} onChange={(e) => saveInput(e.target.value)} rows={6}
            placeholder={'[{"index": 0, "text": "全部全部アンタのせいだ"}]'} />
        </div>
        <div className="wm-pipe-arrow">
          <button className="wm-morph-btn" onClick={runMorphAnalysis} disabled={analyzing || !input.trim()}>
            {analyzing ? "Analyzing..." : "Morphological Analysis \u2192"}
          </button>
          {morphError && <div className="wm-morph-error">{morphError}</div>}
        </div>
        <div className="wm-pipe-step">
          <label>Gemini Input (morph ON preview)</label>
          <textarea readOnly value={morphLines.length > 0 ? JSON.stringify(morphLines.map((l) => ({ index: l.index, text: l.text, words: l.words })), null, 2) : ""} rows={6} />
          <div className="wm-send-row">
            <button className="wm-send-btn" onClick={sendAll} disabled={sending || !apiKey.trim() || morphLines.length === 0}>
              {sending ? "Sending..." : "Send All"}
            </button>
          </div>
        </div>
      </div>

      {/* Panel toolbar */}
      <div className="wm-panel-toolbar">
        <button className="wm-add-btn" onClick={() => addPanel(true)}>+ Morph ON</button>
        <button className="wm-add-btn" onClick={() => addPanel(false)}>+ Morph OFF</button>
        <span className="wm-panel-count">{panels.length} panel{panels.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Panels */}
      <div className="wm-panels">
        {panels.map((panel) => (
          <div className="wm-panel" key={panel.id}>
            <div className="wm-panel-header">
              <input className="wm-panel-name" value={panel.name} onChange={(e) => updatePanel(panel.id, { name: e.target.value })} />
              <label className={`wm-morph-tag ${panel.morphOn ? "on" : "off"}`}>
                <input type="checkbox" checked={panel.morphOn} onChange={(e) => updatePanel(panel.id, { morphOn: e.target.checked })} />
                {panel.morphOn ? "morph ON" : "morph OFF"}
              </label>
              <button className="wm-remove-btn" onClick={() => removePanel(panel.id)}>x</button>
            </div>
            <div className="wm-panel-config">
              <div className="wm-cfg">
                <label>Model</label>
                <select value={panel.model} onChange={(e) => updatePanel(panel.id, { model: e.target.value })}>
                  {GEMINI_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="wm-cfg">
                <label>Temp</label>
                <input type="number" min={0} max={2} step={0.1} value={panel.temperature} onChange={(e) => updatePanel(panel.id, { temperature: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="wm-cfg">
                <label>Top P</label>
                <input type="number" min={0} max={1} step={0.05} value={panel.topP} onChange={(e) => updatePanel(panel.id, { topP: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="wm-cfg">
                <label>Top K</label>
                <input type="number" min={1} max={100} step={1} value={panel.topK} onChange={(e) => updatePanel(panel.id, { topK: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="wm-cfg">
                <label>Max Tokens</label>
                <input type="number" min={1} max={65536} step={256} value={panel.maxOutputTokens} onChange={(e) => updatePanel(panel.id, { maxOutputTokens: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
            {/* Panel stats + raw JSON */}
            {(() => {
              const r = results[panel.id];
              if (!r || (!r.latencyMs && !r.loading && !r.error)) return null;
              return (
                <>
                  <div className="wm-panel-stats">
                    {r.loading && <span className="wm-loading">Loading...</span>}
                    {r.error && (
                      <>
                        <span className="wm-error">{r.error}</span>
                        <button className="wm-retry-btn" onClick={() => sendPanel(panel)} disabled={r.loading}>Retry</button>
                      </>
                    )}
                    {r.latencyMs !== null && <span className="wm-stat">{r.latencyMs}ms</span>}
                    {r.promptTokens !== null && <span className="wm-stat">in:{r.promptTokens}</span>}
                    {r.candidateTokens !== null && <span className="wm-stat">out:{r.candidateTokens}</span>}
                    {r.cost !== null && <span className="wm-stat wm-cost">${r.cost.toFixed(6)}</span>}
                  </div>
                  {r.rawJson && (
                    <details className="wm-raw-json">
                      <summary>Raw JSON</summary>
                      <pre>{r.rawJson}</pre>
                    </details>
                  )}
                </>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Results table */}
      {morphLines.length > 0 && Object.keys(results).length > 0 && (
        <div className="wm-results">
          {morphLines.map((line) => (
            <div key={line.index} className="wm-line-block">
              <div className="wm-line-header">Line {line.index}: {line.text}</div>
              <table className="wm-table">
                <thead>
                  <tr>
                    <th>baseForm</th>
                    <th>POS</th>
                    {panels.map((p) => (
                      <th key={p.id}>{p.name} ({p.morphOn ? "ON" : "OFF"})</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Build union word list: morph words first, then extras from all panels
                    const morphWords = morphWordsByLine[line.index] ?? [];
                    const seenBaseForms = new Set(morphWords.map((w) => w.baseForm));
                    const extraWords: { baseForm: string; source: string }[] = [];

                    for (const p of panels) {
                      const r = results[p.id];
                      if (!r?.lines) continue;
                      const rl = r.lines.find((l) => l.index === line.index);
                      if (!rl) continue;
                      for (const w of rl.words) {
                        if (!seenBaseForms.has(w.baseForm)) {
                          seenBaseForms.add(w.baseForm);
                          extraWords.push({ baseForm: w.baseForm, source: p.name });
                        }
                      }
                    }

                    const allRows = [
                      ...morphWords.map((w) => ({ baseForm: w.baseForm, pos: w.pos, isExtra: false })),
                      ...extraWords.map((w) => ({ baseForm: w.baseForm, pos: null as string | null, isExtra: true })),
                    ];

                    return allRows.map((word, wi) => {
                      const panelMeanings = panels.map((p) => {
                        const r = results[p.id];
                        if (!r?.lines) return null;
                        const rl = r.lines.find((l) => l.index === line.index);
                        if (!rl) return null;
                        const match = rl.words.find((w) => w.baseForm === word.baseForm);
                        if (!match) return null;
                        return match.koreanText;
                      });
                      const uniqueMeanings = new Set(panelMeanings.filter(Boolean));
                      const hasDiff = uniqueMeanings.size > 1;

                      return (
                        <tr key={wi} className={word.isExtra ? "wm-extra-row" : ""}>
                          <td className="wm-cell-base">{word.baseForm}</td>
                          <td className="wm-cell-pos">{word.pos ?? "?"}</td>
                          {panelMeanings.map((meaning, pi) => (
                            <td key={pi} className={`wm-cell-meaning${hasDiff ? " wm-diff" : ""}`}>
                              {meaning ?? <span className="wm-missing">-</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
