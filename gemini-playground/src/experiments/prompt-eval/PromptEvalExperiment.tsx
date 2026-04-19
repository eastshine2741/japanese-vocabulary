import { useState, useCallback, useRef } from "react";
import type { EvalMode, TestCase, TestData, TestCaseResult, EvalRun, GraderResult } from "./types";
import {
  GEMINI_MODELS,
  callGemini,
  TRANSLATION_RESPONSE_SCHEMA,
  WORD_MEANING_RESPONSE_SCHEMA,
  GRADER_RESPONSE_SCHEMA,
} from "./geminiApi";
import { buildGraderPrompt } from "./graderPrompt";
import "./PromptEvalExperiment.css";

const DEFAULT_TRANSLATION_PROMPT = `You are a Japanese-to-Korean lyrics translator. You receive a JSON array of lyric lines, each with "index" and "text" fields.

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

const DEFAULT_WORD_MEANING_PROMPT = `You receive a JSON array of lyric lines.
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

function storageKey(mode: EvalMode, field: string): string {
  return `pe-${mode}-${field}`;
}

function useLocalState(key: string, defaultValue: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? defaultValue);
  const update = useCallback(
    (v: string) => {
      setValue(v);
      localStorage.setItem(key, v);
    },
    [key]
  );
  return [value, update];
}

function scoreClass(score: number): string {
  if (score >= 8) return "good";
  if (score >= 5) return "mid";
  return "bad";
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PromptEvalExperiment({ mode }: { mode: EvalMode }) {
  const defaultPrompt = mode === "translation" ? DEFAULT_TRANSLATION_PROMPT : DEFAULT_WORD_MEANING_PROMPT;
  const defaultModel = mode === "translation" ? "gemini-3.1-pro-preview" : "gemini-3.1-flash-lite-preview";
  const defaultTemp = mode === "translation" ? "0.3" : "0";

  const [apiKey, setApiKey] = useLocalState("pe-api-key", "");
  const [executionModel, setExecutionModel] = useLocalState(storageKey(mode, "exec-model"), defaultModel);
  const [graderModel, setGraderModel] = useLocalState(storageKey(mode, "grader-model"), "gemini-2.5-flash");
  const [temperature, setTemperature] = useLocalState(storageKey(mode, "temperature"), defaultTemp);
  const [systemPrompt, setSystemPrompt] = useLocalState(storageKey(mode, "prompt"), defaultPrompt);
  const [guidelines, setGuidelines] = useLocalState(storageKey(mode, "guidelines"), "");

  const [testCases, setTestCases] = useState<TestCase[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey(mode, "test-data"));
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  });
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [expandedOutputs, setExpandedOutputs] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const responseSchema =
    mode === "translation" ? TRANSLATION_RESPONSE_SCHEMA : WORD_MEANING_RESPONSE_SCHEMA;

  const loadTestData = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data: TestData = JSON.parse(reader.result as string);
          if (!data.testCases || !Array.isArray(data.testCases)) {
            alert("Invalid format: expected { testCases: [...] }");
            return;
          }
          setTestCases(data.testCases);
          localStorage.setItem(storageKey(mode, "test-data"), JSON.stringify(data.testCases));
        } catch {
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [mode]
  );

  const toggleCard = useCallback((idx: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleOutput = useCallback((idx: number) => {
    setExpandedOutputs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const runEvaluation = useCallback(async () => {
    if (!apiKey.trim() || testCases.length === 0 || running) return;
    setRunning(true);
    setResults([]);
    setExpandedCards(new Set());
    setExpandedOutputs(new Set());

    const temp = parseFloat(temperature) || 0;
    const totalTests = testCases.length;
    const newResults: TestCaseResult[] = [];

    // Step 1: Execute prompts in parallel
    setProgress(`Executing prompts... 0/${totalTests}`);
    let executionDone = 0;

    const executionResults = await Promise.all(
      testCases.map(async (tc) => {
        const inputJson = JSON.stringify(tc.input);
        const result = await callGemini(apiKey, executionModel, systemPrompt, inputJson, temp, responseSchema);
        executionDone++;
        setProgress(`Executing prompts... ${executionDone}/${totalTests}`);
        return result;
      })
    );

    // Step 2: Grade results in parallel
    setProgress(`Grading... 0/${totalTests}`);
    let gradingDone = 0;

    const gradingResults = await Promise.all(
      testCases.map(async (tc, i) => {
        const execResult = executionResults[i];
        if (execResult.error || !execResult.text) {
          gradingDone++;
          setProgress(`Grading... ${gradingDone}/${totalTests}`);
          return { text: null, error: "Skipped: execution failed", latencyMs: 0, cost: 0 };
        }

        const graderInput = buildGraderPrompt(
          guidelines,
          tc.criteria,
          JSON.stringify(tc.input, null, 2),
          execResult.text
        );
        const result = await callGemini(apiKey, graderModel, "", graderInput, 0, GRADER_RESPONSE_SCHEMA);
        gradingDone++;
        setProgress(`Grading... ${gradingDone}/${totalTests}`);
        return result;
      })
    );

    // Build results
    for (let i = 0; i < totalTests; i++) {
      const exec = executionResults[i];
      const grade = gradingResults[i];

      let graderResult: GraderResult | null = null;
      let graderError: string | null = null;

      if (grade.text && !grade.error) {
        try {
          graderResult = JSON.parse(grade.text);
        } catch {
          graderError = "Failed to parse grader response";
        }
      } else {
        graderError = grade.error;
      }

      newResults.push({
        testCaseName: testCases[i].name,
        criteria: testCases[i].criteria,
        input: testCases[i].input,
        geminiOutput: exec.text,
        geminiError: exec.error,
        graderResult,
        graderError,
        executionLatencyMs: exec.latencyMs,
        gradingLatencyMs: grade.latencyMs,
        executionCost: exec.cost,
        gradingCost: grade.cost,
      });
    }

    setResults(newResults);
    setExpandedCards(new Set(newResults.map((_, i) => i)));
    setProgress("");
    setRunning(false);
  }, [apiKey, testCases, running, temperature, executionModel, graderModel, systemPrompt, guidelines, responseSchema]);

  const averageScore =
    results.length > 0
      ? (() => {
          const scored = results.filter((r) => r.graderResult?.score != null);
          if (scored.length === 0) return null;
          return scored.reduce((sum, r) => sum + r.graderResult!.score, 0) / scored.length;
        })()
      : null;

  const totalCost = results.reduce((sum, r) => sum + r.executionCost + r.gradingCost, 0);

  const handleDownload = useCallback(() => {
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const run: EvalRun = {
      timestamp: now.toISOString(),
      mode,
      executionModel,
      graderModel,
      temperature: parseFloat(temperature) || 0,
      systemPrompt,
      guidelines,
      averageScore: averageScore ?? null,
      totalCost,
      results,
    };
    downloadJson(run, `eval-${mode}-${ts}.json`);
  }, [mode, executionModel, graderModel, temperature, systemPrompt, guidelines, averageScore, totalCost, results]);

  return (
    <div className="prompt-eval">
      {/* Config bar */}
      <div className="pe-config-bar">
        <div className="pe-config-field">
          <label>Execution Model</label>
          <select value={executionModel} onChange={(e) => setExecutionModel(e.target.value)}>
            {GEMINI_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="pe-config-field">
          <label>Temperature</label>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            style={{ width: 70 }}
          />
        </div>
        <div className="pe-config-field">
          <label>Grader Model</label>
          <select value={graderModel} onChange={(e) => setGraderModel(e.target.value)}>
            {GEMINI_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="pe-config-field">
          <label>API Key</label>
          <input
            className="pe-api-key-input"
            type="password"
            placeholder="AIza..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      </div>

      {/* Two-column: Prompt + Guidelines */}
      <div className="pe-columns">
        <div className="pe-section">
          <label>System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={12}
          />
        </div>
        <div className="pe-section">
          <label>Grading Guidelines</label>
          <textarea
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder="채점 기준을 입력하세요. 모든 테스트 케이스에 공통 적용됩니다."
            rows={12}
          />
        </div>
      </div>

      {/* Test data */}
      <div className="pe-test-data">
        <label>Test Data</label>
        <div className="pe-file-row">
          <input
            ref={fileInputRef}
            className="pe-file-input"
            type="file"
            accept=".json"
            onChange={loadTestData}
          />
          <button className="pe-file-btn" onClick={() => fileInputRef.current?.click()}>
            Load JSON File
          </button>
          <span className="pe-file-info">
            {testCases.length > 0
              ? `${testCases.length} test case${testCases.length !== 1 ? "s" : ""} loaded`
              : "No test data loaded"}
          </span>
        </div>
        {testCases.length > 0 && (
          <div className="pe-test-list">
            {testCases.map((tc, i) => (
              <div key={i} className="pe-test-item">
                {i + 1}. {tc.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run bar */}
      <div className="pe-run-bar">
        <button
          className="pe-run-btn"
          onClick={runEvaluation}
          disabled={running || !apiKey.trim() || testCases.length === 0}
        >
          {running ? "Running..." : "Run Evaluation"}
        </button>
        {progress && <span className="pe-progress">{progress}</span>}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="pe-results">
          <div className="pe-summary">
            <div>
              {averageScore != null ? (
                <span className={`pe-avg-score ${scoreClass(averageScore)}`}>
                  {averageScore.toFixed(1)} / 10
                </span>
              ) : (
                <span className="pe-avg-score bad">N/A</span>
              )}
            </div>
            <div className="pe-summary-stats">
              <span>
                {results.filter((r) => r.graderResult).length}/{results.length} graded
              </span>
              <span>
                Cost: <span className="pe-stat-value cost">${totalCost.toFixed(4)}</span>
              </span>
            </div>
            <div className="pe-summary-actions">
              <button className="pe-download-btn" onClick={handleDownload}>
                Download Results
              </button>
            </div>
          </div>

          {results.map((r, i) => (
            <div key={i} className="pe-result-card">
              <div className="pe-result-header" onClick={() => toggleCard(i)}>
                <span className="pe-result-name">
                  {expandedCards.has(i) ? "\u25BC" : "\u25B6"} {r.testCaseName}
                </span>
                {r.graderResult ? (
                  <span className={`pe-result-score ${scoreClass(r.graderResult.score)}`}>
                    {r.graderResult.score}/10
                  </span>
                ) : r.geminiError ? (
                  <span className="pe-result-error">Exec Error</span>
                ) : r.graderError ? (
                  <span className="pe-result-error">Grade Error</span>
                ) : null}
              </div>

              {expandedCards.has(i) && (
                <div className="pe-result-body">
                  {r.geminiError && (
                    <div className="pe-deduction">
                      Execution error: {r.geminiError}
                    </div>
                  )}

                  {r.graderError && !r.geminiError && (
                    <div className="pe-deduction">
                      Grading error: {r.graderError}
                    </div>
                  )}

                  {r.graderResult && (
                    <>
                      {r.graderResult.deductions.length > 0 && (
                        <div className="pe-deductions">
                          {r.graderResult.deductions.map((d, j) => (
                            <div key={j} className="pe-deduction">
                              <span className="pe-deduction-points">-{d.points}</span>{" "}
                              {d.reason}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="pe-comment">{r.graderResult.comment}</div>
                    </>
                  )}

                  <div className="pe-result-stats">
                    <span>
                      Exec: <span className="pe-stat-value latency">{r.executionLatencyMs}ms</span>
                    </span>
                    <span>
                      Grade: <span className="pe-stat-value latency">{r.gradingLatencyMs}ms</span>
                    </span>
                    <span>
                      Cost: <span className="pe-stat-value cost">${(r.executionCost + r.gradingCost).toFixed(4)}</span>
                    </span>
                  </div>

                  {r.geminiOutput && (
                    <>
                      <button className="pe-output-toggle" onClick={() => toggleOutput(i)}>
                        {expandedOutputs.has(i) ? "\u25B2 Hide output" : "\u25BC Show output"}
                      </button>
                      {expandedOutputs.has(i) && (
                        <div className="pe-output-raw">{formatJson(r.geminiOutput)}</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
