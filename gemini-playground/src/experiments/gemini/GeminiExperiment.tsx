import { useState, useCallback, useRef } from "react";
import "./GeminiExperiment.css";

const GEMINI_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

// per 1M tokens (input, output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-pro-preview": { input: 2.0, output: 12.0 },
  "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
  "gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

const RESPONSE_MIME_TYPES = ["text/plain", "application/json"];

interface PanelConfig {
  id: string;
  name: string;
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  responseMimeType: string;
}

interface PanelResult {
  text: string | null;
  error: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  candidateTokens: number | null;
  totalTokens: number | null;
  cost: number | null;
  loading: boolean;
}

function createPanel(index: number): PanelConfig {
  return {
    id: crypto.randomUUID(),
    name: `Panel ${index}`,
    model: "gemini-2.5-flash",
    temperature: 0.3,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
  };
}

function calcCost(
  model: string,
  promptTokens: number,
  candidateTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (
    (promptTokens / 1_000_000) * pricing.input +
    (candidateTokens / 1_000_000) * pricing.output
  );
}

async function callGemini(
  apiKey: string,
  config: PanelConfig,
  systemInstruction: string,
  input: string
): Promise<PanelResult> {
  const start = performance.now();

  const requestBody: Record<string, unknown> = {
    contents: [{ parts: [{ text: input }] }],
    generationConfig: {
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK,
      maxOutputTokens: config.maxOutputTokens,
      responseMimeType: config.responseMimeType,
    },
  };

  if (systemInstruction.trim()) {
    requestBody.system_instruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const latencyMs = Math.round(performance.now() - start);
    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      return { text: null, error: msg, latencyMs, promptTokens: null, candidateTokens: null, totalTokens: null, cost: null, loading: false };
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(empty response)";
    const usage = data?.usageMetadata;
    const promptTokens = usage?.promptTokenCount ?? 0;
    const candidateTokens = usage?.candidatesTokenCount ?? 0;
    const totalTokens = usage?.totalTokenCount ?? 0;
    const cost = calcCost(config.model, promptTokens, candidateTokens);

    return { text, error: null, latencyMs, promptTokens, candidateTokens, totalTokens, cost, loading: false };
  } catch (e) {
    return { text: null, error: e instanceof Error ? e.message : String(e), latencyMs: Math.round(performance.now() - start), promptTokens: null, candidateTokens: null, totalTokens: null, cost: null, loading: false };
  }
}

const EMPTY_RESULT: PanelResult = {
  text: null, error: null, latencyMs: null, promptTokens: null, candidateTokens: null, totalTokens: null, cost: null, loading: false,
};

const DEFAULT_SYSTEM_PROMPT = `You are a Japanese-to-Korean lyrics translator. You receive a JSON array of lyric lines, each with "index" and "text" fields.

For each line, produce:
- "index": same as input
- "koreanLyrics": natural Korean translation of the Japanese text
- "koreanPronounciation": Korean pronunciation of the original Japanese text (한국어로 표기한 일본어 발음)

Translation guidelines:
1. Read all lyrics first. Analyze the overall theme and tone, then reflect them in the Korean translation.
2. Preserve the tone and politeness level (경어체/반말) of each line.
3. For Japan-specific cultural terms: use the equivalent Korean word if one exists; otherwise keep the original Japanese pronunciation in Korean (한국어 발음).
4. If the original uses rhyme or wordplay based on Japanese pronunciation, recreate it with Korean words of similar meaning.
5. Use four-character idioms (사자성어/四字熟語) when appropriate. However, if an idiom carries a different meaning in Korean vs Japanese, write it out in plain Korean instead.
6. Do not use Korean slang or neologisms (신조어).

Rules:
- Translate all lines, preserving the order and count
- Return ONLY a JSON array of objects with the three fields above
- Do not skip empty lines — return empty strings for them`;

const STORAGE_KEY_API = "gemini-pg-api-key";
const STORAGE_KEY_PANELS = "gemini-pg-panels";
const STORAGE_KEY_SYSTEM = "gemini-pg-system";

function loadPanels(): PanelConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PANELS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [createPanel(1), createPanel(2)];
}

function formatResponseText(text: string, mimeType: string): string {
  if (mimeType === "application/json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

export default function GeminiExperiment() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY_API) ?? "");
  const [systemInstruction, setSystemInstruction] = useState(() => localStorage.getItem(STORAGE_KEY_SYSTEM) ?? DEFAULT_SYSTEM_PROMPT);
  const [panels, setPanels] = useState<PanelConfig[]>(loadPanels);
  const [results, setResults] = useState<Record<string, PanelResult>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const panelCounter = useRef(panels.length);

  const savePanels = useCallback((p: PanelConfig[]) => {
    setPanels(p);
    localStorage.setItem(STORAGE_KEY_PANELS, JSON.stringify(p));
  }, []);

  const updateApiKey = useCallback((v: string) => {
    setApiKey(v);
    localStorage.setItem(STORAGE_KEY_API, v);
  }, []);

  const updateSystem = useCallback((v: string) => {
    setSystemInstruction(v);
    localStorage.setItem(STORAGE_KEY_SYSTEM, v);
  }, []);

  const addPanel = useCallback(() => {
    panelCounter.current += 1;
    savePanels([...panels, createPanel(panelCounter.current)]);
  }, [panels, savePanels]);

  const removePanel = useCallback((id: string) => {
    savePanels(panels.filter((p) => p.id !== id));
  }, [panels, savePanels]);

  const updatePanel = useCallback((id: string, patch: Partial<PanelConfig>) => {
    savePanels(panels.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, [panels, savePanels]);

  const sendAll = useCallback(async () => {
    if (!apiKey.trim() || !input.trim() || sending) return;
    setSending(true);

    const loadingResults: Record<string, PanelResult> = {};
    for (const p of panels) {
      loadingResults[p.id] = { ...EMPTY_RESULT, loading: true };
    }
    setResults(loadingResults);

    const promises = panels.map(async (panel) => {
      const result = await callGemini(apiKey, panel, systemInstruction, input.trim());
      setResults((prev) => ({ ...prev, [panel.id]: result }));
    });

    await Promise.allSettled(promises);
    setSending(false);
  }, [apiKey, input, panels, systemInstruction, sending]);

  return (
    <div className="gemini-experiment">
      {/* Header */}
      <div className="header">
        <div className="api-key-row">
          <label>API Key</label>
          <input
            className="api-key-input"
            type="password"
            placeholder="AIza..."
            value={apiKey}
            onChange={(e) => updateApiKey(e.target.value)}
          />
        </div>
      </div>

      {/* System instruction */}
      <div className="shared-section">
        <label>System Instruction (all panels)</label>
        <textarea
          value={systemInstruction}
          onChange={(e) => updateSystem(e.target.value)}
          placeholder="You are a Japanese-to-Korean lyrics translator..."
          rows={4}
        />
      </div>

      {/* Input */}
      <div className="shared-section">
        <label>Input (lyrics JSON)</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'[{"index":0,"text":"夜に駆ける"},{"index":1,"text":"沈むように溶けてゆくように"}]'}
          rows={6}
        />
        <div className="send-row">
          <button
            className="send-btn"
            onClick={sendAll}
            disabled={sending || !apiKey.trim() || !input.trim()}
          >
            {sending ? "Sending..." : "Send All"}
          </button>
        </div>
      </div>

      {/* Panel toolbar */}
      <div className="panel-toolbar">
        <button className="add-panel-btn" onClick={addPanel}>+ Add Panel</button>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
          {panels.length} panel{panels.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Panels */}
      <div className="panels">
        {panels.map((panel) => {
          const result = results[panel.id] ?? EMPTY_RESULT;
          return (
            <div className="panel" key={panel.id}>
              <div className="panel-header">
                <div className="panel-header-left">
                  <input
                    className="panel-name"
                    value={panel.name}
                    onChange={(e) => updatePanel(panel.id, { name: e.target.value })}
                    style={{ background: "transparent", border: "none", width: 120 }}
                  />
                </div>
                <button className="remove-btn" onClick={() => removePanel(panel.id)} title="Remove panel">x</button>
              </div>

              <div className="panel-config">
                <div className="config-field">
                  <label>Model</label>
                  <select value={panel.model} onChange={(e) => updatePanel(panel.id, { model: e.target.value })}>
                    {GEMINI_MODELS.map((m) => (<option key={m} value={m}>{m}</option>))}
                  </select>
                </div>
                <div className="config-field">
                  <label>Temperature</label>
                  <input type="number" min={0} max={2} step={0.1} value={panel.temperature}
                    onChange={(e) => updatePanel(panel.id, { temperature: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="config-field">
                  <label>Top P</label>
                  <input type="number" min={0} max={1} step={0.05} value={panel.topP}
                    onChange={(e) => updatePanel(panel.id, { topP: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="config-field">
                  <label>Top K</label>
                  <input type="number" min={1} max={100} step={1} value={panel.topK}
                    onChange={(e) => updatePanel(panel.id, { topK: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="config-field">
                  <label>Max Tokens</label>
                  <input type="number" min={1} max={65536} step={256} value={panel.maxOutputTokens}
                    onChange={(e) => updatePanel(panel.id, { maxOutputTokens: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="config-field">
                  <label>Response MIME</label>
                  <select value={panel.responseMimeType} onChange={(e) => updatePanel(panel.id, { responseMimeType: e.target.value })}>
                    {RESPONSE_MIME_TYPES.map((m) => (<option key={m} value={m}>{m}</option>))}
                  </select>
                </div>
              </div>

              <div className="panel-response">
                <div className={`response-text${result.error ? " error" : ""}${result.loading ? " loading" : ""}`}>
                  {result.loading ? "Waiting for response..."
                    : result.error ? result.error
                    : result.text ? formatResponseText(result.text, panel.responseMimeType)
                    : ""}
                </div>
                {(result.latencyMs !== null || result.cost !== null) && (
                  <div className="stats-bar">
                    {result.latencyMs !== null && (
                      <div className="stat">Latency <span className="stat-value latency">{result.latencyMs}ms</span></div>
                    )}
                    {result.promptTokens !== null && (
                      <div className="stat">In <span className="stat-value">{result.promptTokens}</span></div>
                    )}
                    {result.candidateTokens !== null && (
                      <div className="stat">Out <span className="stat-value">{result.candidateTokens}</span></div>
                    )}
                    {result.totalTokens !== null && (
                      <div className="stat">Total <span className="stat-value">{result.totalTokens}</span></div>
                    )}
                    {result.cost !== null && (
                      <div className="stat">Cost <span className="stat-value cost">${result.cost.toFixed(6)}</span></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
