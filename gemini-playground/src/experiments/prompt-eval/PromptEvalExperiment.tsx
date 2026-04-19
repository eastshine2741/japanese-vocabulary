import { useState, useCallback, useMemo } from "react";
import type {
  EvalMode,
  TestData,
  TestCaseResult,
  EvalRun,
  GraderResult,
} from "./types";
import {
  GEMINI_MODELS,
  callGemini,
  TRANSLATION_RESPONSE_SCHEMA,
  WORD_MEANING_RESPONSE_SCHEMA,
  GRADER_RESPONSE_SCHEMA,
} from "./geminiApi";
import { buildGraderPrompt } from "./graderPrompt";
import "./PromptEvalExperiment.css";

// --- Load prompts and test data from filesystem via import.meta.glob ---

const translationPromptFiles = import.meta.glob<string>(
  "./translation/prompt/*.txt",
  { eager: true, query: "?raw", import: "default" }
);
const wordMeaningPromptFiles = import.meta.glob<string>(
  "./word-meaning/prompt/*.txt",
  { eager: true, query: "?raw", import: "default" }
);
const translationInputFiles = import.meta.glob<TestData>(
  "./translation/input/*.json",
  { eager: true, import: "default" }
);
const wordMeaningInputFiles = import.meta.glob<TestData>(
  "./word-meaning/input/*.json",
  { eager: true, import: "default" }
);

function extractFilename(path: string): string {
  return path.split("/").pop()?.replace(/\.\w+$/, "") ?? path;
}

function storageKey(mode: EvalMode, field: string): string {
  return `pe-${mode}-${field}`;
}

function useLocalState(
  key: string,
  defaultValue: string
): [string, (v: string) => void] {
  const [value, setValue] = useState(
    () => localStorage.getItem(key) ?? defaultValue
  );
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

async function saveResultToServer(
  mode: string,
  filename: string,
  data: EvalRun
): Promise<string> {
  const res = await fetch("/api/prompt-eval/save-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: mode === "translation" ? "translation" : "word-meaning",
      filename,
      data,
    }),
  });
  if (!res.ok) throw new Error("Failed to save result");
  const json = await res.json();
  return json.path;
}

export default function PromptEvalExperiment({ mode }: { mode: EvalMode }) {
  // --- Resolve prompts and test data for current mode ---
  const promptFiles =
    mode === "translation" ? translationPromptFiles : wordMeaningPromptFiles;
  const inputFiles =
    mode === "translation" ? translationInputFiles : wordMeaningInputFiles;

  const promptEntries = useMemo(
    () =>
      Object.entries(promptFiles).map(([path, content]) => ({
        name: extractFilename(path),
        content,
      })),
    [promptFiles]
  );

  const testCaseGroups = useMemo(
    () =>
      Object.entries(inputFiles).map(([path, data]) => ({
        name: extractFilename(path),
        testCases: data.testCases,
      })),
    [inputFiles]
  );

  const allTestCases = useMemo(
    () => testCaseGroups.flatMap((g) => g.testCases),
    [testCaseGroups]
  );

  // --- State ---
  const defaultModel =
    mode === "translation"
      ? "gemini-3.1-pro-preview"
      : "gemini-3.1-flash-lite-preview";
  const defaultTemp = mode === "translation" ? "0.3" : "0";

  const [apiKey, setApiKey] = useLocalState("pe-api-key", "");
  const [executionModel, setExecutionModel] = useLocalState(
    storageKey(mode, "exec-model"),
    defaultModel
  );
  const [graderModel, setGraderModel] = useLocalState(
    storageKey(mode, "grader-model"),
    "gemini-2.5-flash"
  );
  const [temperature, setTemperature] = useLocalState(
    storageKey(mode, "temperature"),
    defaultTemp
  );
  const [guidelines, setGuidelines] = useLocalState(
    storageKey(mode, "guidelines"),
    ""
  );

  const [selectedPrompt, setSelectedPrompt] = useState(
    promptEntries[0]?.name ?? ""
  );
  const [promptText, setPromptText] = useState(
    promptEntries[0]?.content ?? ""
  );

  const handlePromptSelect = useCallback(
    (name: string) => {
      setSelectedPrompt(name);
      const entry = promptEntries.find((p) => p.name === name);
      if (entry) setPromptText(entry.content);
    },
    [promptEntries]
  );

  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [expandedOutputs, setExpandedOutputs] = useState<Set<number>>(
    new Set()
  );
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const responseSchema =
    mode === "translation"
      ? TRANSLATION_RESPONSE_SCHEMA
      : WORD_MEANING_RESPONSE_SCHEMA;

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
    if (!apiKey.trim() || allTestCases.length === 0 || running) return;
    setRunning(true);
    setResults([]);
    setExpandedCards(new Set());
    setExpandedOutputs(new Set());
    setSavedPath(null);

    const temp = parseFloat(temperature) || 0;
    const totalTests = allTestCases.length;

    // Step 1: Execute prompts in parallel
    setProgress(`Executing... 0/${totalTests}`);
    let executionDone = 0;

    const executionResults = await Promise.all(
      allTestCases.map(async (tc) => {
        const inputJson = JSON.stringify(tc.input);
        const result = await callGemini(
          apiKey,
          executionModel,
          promptText,
          inputJson,
          temp,
          responseSchema
        );
        executionDone++;
        setProgress(`Executing... ${executionDone}/${totalTests}`);
        return result;
      })
    );

    // Step 2: Grade results in parallel
    setProgress(`Grading... 0/${totalTests}`);
    let gradingDone = 0;

    const gradingResults = await Promise.all(
      allTestCases.map(async (tc, i) => {
        const execResult = executionResults[i];
        if (execResult.error || !execResult.text) {
          gradingDone++;
          setProgress(`Grading... ${gradingDone}/${totalTests}`);
          return {
            text: null,
            error: "Skipped: execution failed",
            latencyMs: 0,
            cost: 0,
          };
        }

        const graderInput = buildGraderPrompt(
          guidelines,
          tc.criteria,
          JSON.stringify(tc.input, null, 2),
          execResult.text
        );
        const result = await callGemini(
          apiKey,
          graderModel,
          "",
          graderInput,
          0,
          GRADER_RESPONSE_SCHEMA
        );
        gradingDone++;
        setProgress(`Grading... ${gradingDone}/${totalTests}`);
        return result;
      })
    );

    // Build results
    const newResults: TestCaseResult[] = [];
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
        testCaseName: allTestCases[i].name,
        criteria: allTestCases[i].criteria,
        input: allTestCases[i].input,
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

    // Auto-save to output directory
    const scored = newResults.filter((r) => r.graderResult?.score != null);
    const avgScore =
      scored.length > 0
        ? scored.reduce((sum, r) => sum + r.graderResult!.score, 0) /
          scored.length
        : null;
    const totalCost = newResults.reduce(
      (sum, r) => sum + r.executionCost + r.gradingCost,
      0
    );

    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const run: EvalRun = {
      timestamp: now.toISOString(),
      mode,
      executionModel,
      graderModel,
      temperature: temp,
      systemPrompt: promptText,
      guidelines,
      averageScore: avgScore,
      totalCost,
      results: newResults,
    };

    try {
      const path = await saveResultToServer(mode, `eval-${ts}.json`, run);
      setSavedPath(path);
    } catch {
      setSavedPath(null);
    }
  }, [
    apiKey,
    allTestCases,
    running,
    temperature,
    executionModel,
    graderModel,
    promptText,
    guidelines,
    responseSchema,
    mode,
  ]);

  const averageScore =
    results.length > 0
      ? (() => {
          const scored = results.filter(
            (r) => r.graderResult?.score != null
          );
          if (scored.length === 0) return null;
          return (
            scored.reduce((sum, r) => sum + r.graderResult!.score, 0) /
            scored.length
          );
        })()
      : null;

  const totalCost = results.reduce(
    (sum, r) => sum + r.executionCost + r.gradingCost,
    0
  );

  return (
    <div className="prompt-eval">
      {/* Config bar */}
      <div className="pe-config-bar">
        <div className="pe-config-field">
          <label>Execution Model</label>
          <select
            value={executionModel}
            onChange={(e) => setExecutionModel(e.target.value)}
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
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
          <select
            value={graderModel}
            onChange={(e) => setGraderModel(e.target.value)}
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
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
          <div className="pe-section-header">
            <label>System Prompt</label>
            {promptEntries.length > 1 && (
              <select
                className="pe-prompt-select"
                value={selectedPrompt}
                onChange={(e) => handlePromptSelect(e.target.value)}
              >
                {promptEntries.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={14}
          />
        </div>
        <div className="pe-section">
          <label>Grading Guidelines</label>
          <textarea
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder="채점 기준을 입력하세요. 모든 테스트 케이스에 공통 적용됩니다."
            rows={14}
          />
        </div>
      </div>

      {/* Test data (loaded from files) */}
      <div className="pe-test-data">
        <label>
          Test Data{" "}
          <span className="pe-file-info">
            {allTestCases.length} case
            {allTestCases.length !== 1 ? "s" : ""} from{" "}
            {testCaseGroups.length} file
            {testCaseGroups.length !== 1 ? "s" : ""}
          </span>
        </label>
        {testCaseGroups.length === 0 ? (
          <div className="pe-file-info">
            No test data found. Add JSON files to{" "}
            <code>
              prompt-eval/
              {mode === "translation" ? "translation" : "word-meaning"}
              /input/
            </code>
          </div>
        ) : (
          <div className="pe-test-list">
            {testCaseGroups.map((group) =>
              group.testCases.map((tc, j) => (
                <div key={`${group.name}-${j}`} className="pe-test-item">
                  <span className="pe-test-file">{group.name}</span>
                  {tc.name}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Run bar */}
      <div className="pe-run-bar">
        <button
          className="pe-run-btn"
          onClick={runEvaluation}
          disabled={running || !apiKey.trim() || allTestCases.length === 0}
        >
          {running ? "Running..." : "Run Evaluation"}
        </button>
        {progress && <span className="pe-progress">{progress}</span>}
        {savedPath && !running && (
          <span className="pe-saved-info">Saved: {savedPath}</span>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="pe-results">
          <div className="pe-summary">
            <div>
              {averageScore != null ? (
                <span
                  className={`pe-avg-score ${scoreClass(averageScore)}`}
                >
                  {averageScore.toFixed(1)} / 10
                </span>
              ) : (
                <span className="pe-avg-score bad">N/A</span>
              )}
            </div>
            <div className="pe-summary-stats">
              <span>
                {results.filter((r) => r.graderResult).length}/
                {results.length} graded
              </span>
              <span>
                Cost:{" "}
                <span className="pe-stat-value cost">
                  ${totalCost.toFixed(4)}
                </span>
              </span>
            </div>
          </div>

          {results.map((r, i) => (
            <div key={i} className="pe-result-card">
              <div
                className="pe-result-header"
                onClick={() => toggleCard(i)}
              >
                <span className="pe-result-name">
                  {expandedCards.has(i) ? "\u25BC" : "\u25B6"}{" "}
                  {r.testCaseName}
                </span>
                {r.graderResult ? (
                  <span
                    className={`pe-result-score ${scoreClass(r.graderResult.score)}`}
                  >
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
                              <span className="pe-deduction-points">
                                -{d.points}
                              </span>{" "}
                              {d.reason}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="pe-comment">
                        {r.graderResult.comment}
                      </div>
                    </>
                  )}

                  <div className="pe-result-stats">
                    <span>
                      Exec:{" "}
                      <span className="pe-stat-value latency">
                        {r.executionLatencyMs}ms
                      </span>
                    </span>
                    <span>
                      Grade:{" "}
                      <span className="pe-stat-value latency">
                        {r.gradingLatencyMs}ms
                      </span>
                    </span>
                    <span>
                      Cost:{" "}
                      <span className="pe-stat-value cost">
                        ${(r.executionCost + r.gradingCost).toFixed(4)}
                      </span>
                    </span>
                  </div>

                  {r.geminiOutput && (
                    <>
                      <button
                        className="pe-output-toggle"
                        onClick={() => toggleOutput(i)}
                      >
                        {expandedOutputs.has(i)
                          ? "\u25B2 Hide output"
                          : "\u25BC Show output"}
                      </button>
                      {expandedOutputs.has(i) && (
                        <div className="pe-output-raw">
                          {formatJson(r.geminiOutput)}
                        </div>
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
