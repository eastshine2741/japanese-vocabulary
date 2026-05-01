import { useState, useCallback, useMemo } from "react";
import type {
  EvalMode,
  TestCase,
  TestData,
  TestCaseResult,
  EvalRun,
  GraderResult,
  ImproverResult,
} from "./types";
import {
  GEMINI_MODELS,
  callGemini,
  TRANSLATION_RESPONSE_SCHEMA,
  WORD_MEANING_RESPONSE_SCHEMA,
  GRADER_RESPONSE_SCHEMA,
  IMPROVER_RESPONSE_SCHEMA,
} from "./geminiApi";
import { buildGraderPrompt, buildImproverPrompt } from "./graderPrompt";
import "./PromptEvalExperiment.css";

// --- Load files from filesystem via import.meta.glob ---

const translationPromptFiles = import.meta.glob<string>(
  "./translation/prompt/*.txt",
  { eager: true, query: "?raw", import: "default" }
);
const wordMeaningPromptFiles = import.meta.glob<string>(
  "./word-meaning/prompt/*.txt",
  { eager: true, query: "?raw", import: "default" }
);
const translationGuidelinesFiles = import.meta.glob<string>(
  "./translation/guidelines/*.txt",
  { eager: true, query: "?raw", import: "default" }
);
const wordMeaningGuidelinesFiles = import.meta.glob<string>(
  "./word-meaning/guidelines/*.txt",
  { eager: true, query: "?raw", import: "default" }
);
const inputFiles = import.meta.glob<TestData>("./input/*.json", {
  eager: true,
  import: "default",
});

// --- Helpers ---

function getFirstFileContent(files: Record<string, string>): string {
  const values = Object.values(files);
  return values[0] ?? "";
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

async function saveFile(filePath: string, content: string): Promise<void> {
  const res = await fetch("/api/prompt-eval/save-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath, content }),
  });
  if (!res.ok) throw new Error("Failed to save file");
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

// --- Sub-components ---

function TestCaseDialog({
  initial,
  onSubmit,
  onClose,
}: {
  initial?: TestCase;
  onSubmit: (tc: TestCase) => void;
  onClose: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [inputJson, setInputJson] = useState(
    initial ? JSON.stringify(initial.input, null, 2) : ""
  );
  const [translationCriteria, setTranslationCriteria] = useState(
    initial?.translationCriteria ?? ""
  );
  const [wordMeaningCriteria, setWordMeaningCriteria] = useState(
    initial?.wordMeaningCriteria ?? ""
  );
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    try {
      const parsed = JSON.parse(inputJson);
      if (!Array.isArray(parsed)) {
        setError("Input must be a JSON array");
        return;
      }
      onSubmit({
        name: name.trim(),
        input: parsed,
        translationCriteria: translationCriteria.trim() || null,
        wordMeaningCriteria: wordMeaningCriteria.trim() || null,
      });
    } catch {
      setError("Invalid JSON");
    }
  };

  return (
    <div className="pe-dialog-overlay" onClick={onClose}>
      <div className="pe-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{isEdit ? "Edit Test Case" : "Add Test Case"}</h3>
        <div className="pe-dialog-field">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 다맛테쨩"
          />
        </div>
        <div className="pe-dialog-field">
          <label>Input (JSON array of lyric lines)</label>
          <textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            rows={10}
            placeholder='[{"text": "...", "index": 0, "startTimeMs": null}]'
          />
        </div>
        <div className="pe-dialog-field">
          <label>Translation Criteria (optional)</label>
          <textarea
            value={translationCriteria}
            onChange={(e) => setTranslationCriteria(e.target.value)}
            rows={3}
            placeholder="e.g. 자연스러운 한국어 번역..."
          />
        </div>
        <div className="pe-dialog-field">
          <label>Word Meaning Criteria (optional)</label>
          <textarea
            value={wordMeaningCriteria}
            onChange={(e) => setWordMeaningCriteria(e.target.value)}
            rows={3}
            placeholder="e.g. surface가 한국어여서는 안 된다..."
          />
        </div>
        {error && <div className="pe-dialog-error">{error}</div>}
        <div className="pe-dialog-actions">
          <button className="pe-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="pe-btn-primary" onClick={handleSubmit}>
            {isEdit ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditablePanel({
  label,
  value,
  onChange,
  onSave,
  saving,
  saved,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <div className="pe-editable-panel">
      <div className="pe-editable-header">
        <span>{label}</span>
        <div className="pe-editable-actions">
          {saved && <span className="pe-saved-badge">Saved</span>}
          <button
            className="pe-btn-save"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      <textarea
        className="pe-editable-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
      />
    </div>
  );
}

// --- Mode Panel (independent per sub-tab) ---

function ModePanel({
  mode,
  apiKey,
  testCases,
}: {
  mode: EvalMode;
  apiKey: string;
  testCases: TestCase[];
}) {
  const dir = mode === "translation" ? "translation" : "word-meaning";
  const defaultExecModel =
    mode === "translation"
      ? "gemini-3.1-pro-preview"
      : "gemini-3.1-flash-lite-preview";
  const defaultTemp = mode === "translation" ? "0.3" : "0";

  // --- Prompt / Guidelines state ---
  const initialPrompt = useMemo(
    () =>
      getFirstFileContent(
        mode === "translation" ? translationPromptFiles : wordMeaningPromptFiles
      ),
    [mode]
  );
  const initialGuidelines = useMemo(
    () =>
      getFirstFileContent(
        mode === "translation"
          ? translationGuidelinesFiles
          : wordMeaningGuidelinesFiles
      ),
    [mode]
  );

  const [promptText, setPromptText] = useState(initialPrompt);
  const [guidelinesText, setGuidelinesText] = useState(initialGuidelines);

  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState(false);
  const [savingGuidelines, setSavingGuidelines] = useState(false);
  const [savedGuidelines, setSavedGuidelines] = useState(false);

  // --- Config state (localStorage) ---
  const [execModel, setExecModel] = useLocalState(
    `pe-${mode}-exec-model`,
    defaultExecModel
  );
  const [graderModel, setGraderModel] = useLocalState(
    `pe-${mode}-grader-model`,
    "gemini-2.5-flash"
  );
  const [temperature, setTemperature] = useLocalState(
    `pe-${mode}-temperature`,
    defaultTemp
  );

  const responseSchema =
    mode === "translation"
      ? TRANSLATION_RESPONSE_SCHEMA
      : WORD_MEANING_RESPONSE_SCHEMA;

  // --- Run state (independent per panel) ---
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [expandedOutputs, setExpandedOutputs] = useState<Set<number>>(
    new Set()
  );
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [improverResult, setImproverResult] = useState<ImproverResult | null>(null);
  const [improverError, setImproverError] = useState<string | null>(null);
  const [improvingRunning, setImprovingRunning] = useState(false);
  // Checked deductions: key = "resultIdx-deductionIdx"
  const [checkedDeductions, setCheckedDeductions] = useState<Set<string>>(new Set());

  // --- Save handlers ---
  const handleSavePrompt = useCallback(async () => {
    setSavingPrompt(true);
    setSavedPrompt(false);
    try {
      await saveFile(`${dir}/prompt/default.txt`, promptText);
      setSavedPrompt(true);
      setTimeout(() => setSavedPrompt(false), 2000);
    } finally {
      setSavingPrompt(false);
    }
  }, [dir, promptText]);

  const handleSaveGuidelines = useCallback(async () => {
    setSavingGuidelines(true);
    setSavedGuidelines(false);
    try {
      await saveFile(`${dir}/guidelines/default.txt`, guidelinesText);
      setSavedGuidelines(true);
      setTimeout(() => setSavedGuidelines(false), 2000);
    } finally {
      setSavingGuidelines(false);
    }
  }, [dir, guidelinesText]);

  // --- Toggle helpers ---
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

  // --- Run evaluation ---
  const runEvaluation = useCallback(async () => {
    if (!apiKey.trim() || testCases.length === 0 || running) return;
    setRunning(true);
    setResults([]);
    setExpandedCards(new Set());
    setExpandedOutputs(new Set());
    setSavedPath(null);
    setImproverResult(null);
    setImproverError(null);

    const temp = parseFloat(temperature) || 0;
    const totalTests = testCases.length;

    // Step 1: Execute prompts in parallel
    setProgress(`Executing... 0/${totalTests}`);
    let executionDone = 0;

    const executionResults = await Promise.all(
      testCases.map(async (tc) => {
        const inputJson = JSON.stringify(tc.input);
        const result = await callGemini(
          apiKey,
          execModel,
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
      testCases.map(async (tc, i) => {
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

        const criteria =
          mode === "translation"
            ? tc.translationCriteria
            : tc.wordMeaningCriteria;
        const criteriaText = criteria || "채점기준 없음 (guidelines만 적용)";

        const graderInput = buildGraderPrompt(
          guidelinesText,
          criteriaText,
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
      const tc = testCases[i];
      const criteria =
        mode === "translation"
          ? tc.translationCriteria
          : tc.wordMeaningCriteria;

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
        testCaseName: tc.name,
        criteria: criteria ?? null,
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

    // Initialize all deductions as checked
    const allDeductionKeys = new Set<string>();
    newResults.forEach((r, ri) => {
      r.graderResult?.deductions.forEach((_, di) => {
        allDeductionKeys.add(`${ri}-${di}`);
      });
    });
    setCheckedDeductions(allDeductionKeys);

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
      executionModel: execModel,
      graderModel,
      temperature: temp,
      systemPrompt: promptText,
      guidelines: guidelinesText,
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
    testCases,
    running,
    temperature,
    execModel,
    graderModel,
    promptText,
    guidelinesText,
    responseSchema,
    mode,
  ]);

  // --- Toggle deduction checkbox ---
  const toggleDeduction = useCallback((key: string) => {
    setCheckedDeductions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // --- Generate improvement from checked deductions ---
  const runImprovement = useCallback(async () => {
    if (improvingRunning) return;
    setImprovingRunning(true);
    setImproverResult(null);
    setImproverError(null);

    // Build grading results with only checked deductions
    const gradedResults: { testCaseName: string; score: number; deductions: { reason: string; points: number }[]; comment: string }[] = [];
    results.forEach((r, ri) => {
      if (!r.graderResult) return;
      const filteredDeductions = r.graderResult.deductions.filter((_, di) =>
        checkedDeductions.has(`${ri}-${di}`)
      );
      if (filteredDeductions.length === 0) return;
      gradedResults.push({
        testCaseName: r.testCaseName,
        score: r.graderResult.score,
        deductions: filteredDeductions,
        comment: r.graderResult.comment,
      });
    });

    if (gradedResults.length === 0) {
      setImproverError("No deductions selected");
      setImprovingRunning(false);
      return;
    }

    const improverInput = buildImproverPrompt(promptText, gradedResults);
    const improverRes = await callGemini(
      apiKey,
      graderModel,
      "",
      improverInput,
      0,
      IMPROVER_RESPONSE_SCHEMA
    );

    if (improverRes.text && !improverRes.error) {
      try {
        setImproverResult(JSON.parse(improverRes.text));
      } catch {
        setImproverError("Failed to parse improver response");
      }
    } else {
      setImproverError(improverRes.error ?? "Unknown error");
    }
    setImprovingRunning(false);
  }, [improvingRunning, results, checkedDeductions, promptText, apiKey, graderModel]);

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
    <div className="pe-subtab-content">
      {/* Prompt */}
      <EditablePanel
        label="System Prompt"
        value={promptText}
        onChange={setPromptText}
        onSave={handleSavePrompt}
        saving={savingPrompt}
        saved={savedPrompt}
      />

      {/* Guidelines */}
      <EditablePanel
        label="Grading Guidelines"
        value={guidelinesText}
        onChange={setGuidelinesText}
        onSave={handleSaveGuidelines}
        saving={savingGuidelines}
        saved={savedGuidelines}
      />

      {/* Model config */}
      <div className="pe-config-bar">
        <div className="pe-config-field">
          <label>Execution Model</label>
          <select
            value={execModel}
            onChange={(e) => setExecModel(e.target.value)}
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
                  {r.criteria && (
                    <div className="pe-criteria">
                      <span className="pe-criteria-label">Criteria:</span>{" "}
                      {r.criteria}
                    </div>
                  )}

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

      {/* Deduction Review + Prompt Improvement */}
      {results.some((r) => r.graderResult && r.graderResult.deductions.length > 0) && (
        <div className="pe-improver-panel">
          <div className="pe-improver-header">
            <span>Deduction Review</span>
            <div className="pe-editable-actions">
              <button
                className="pe-btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => {
                  const allKeys = new Set<string>();
                  results.forEach((r, ri) => {
                    r.graderResult?.deductions.forEach((_, di) => {
                      allKeys.add(`${ri}-${di}`);
                    });
                  });
                  setCheckedDeductions(
                    checkedDeductions.size === allKeys.size ? new Set() : allKeys
                  );
                }}
              >
                {(() => {
                  let total = 0;
                  results.forEach((r) => { total += r.graderResult?.deductions.length ?? 0; });
                  return checkedDeductions.size === total ? "Uncheck All" : "Check All";
                })()}
              </button>
              <button
                className="pe-btn-primary"
                onClick={runImprovement}
                disabled={improvingRunning || checkedDeductions.size === 0}
              >
                {improvingRunning ? "Generating..." : "Generate Improvement"}
              </button>
            </div>
          </div>
          <div className="pe-deduction-review-list">
            {results.map((r, ri) => {
              if (!r.graderResult || r.graderResult.deductions.length === 0) return null;
              return (
                <div key={ri} className="pe-deduction-review-group">
                  <div className="pe-deduction-review-group-header">
                    {r.testCaseName}
                    <span className={`pe-result-score ${scoreClass(r.graderResult.score)}`} style={{ fontSize: 13 }}>
                      {r.graderResult.score}/10
                    </span>
                  </div>
                  {r.graderResult.deductions.map((d, di) => {
                    const key = `${ri}-${di}`;
                    return (
                      <label key={di} className="pe-deduction-review-item">
                        <input
                          type="checkbox"
                          checked={checkedDeductions.has(key)}
                          onChange={() => toggleDeduction(key)}
                        />
                        <span className="pe-deduction-points">-{d.points}</span>
                        <span>{d.reason}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prompt Improvement Result */}
      {improverError && (
        <div className="pe-improver-panel">
          <div className="pe-improver-header">Prompt Improvement</div>
          <div className="pe-deduction" style={{ margin: 16 }}>Improvement error: {improverError}</div>
        </div>
      )}
      {improverResult && (
        <div className="pe-improver-panel">
          <div className="pe-improver-header">
            <span>Prompt Improvement Suggestion</span>
            <button
              className="pe-btn-primary"
              onClick={() => {
                setPromptText(improverResult.improvedPrompt);
              }}
            >
              Apply to Prompt
            </button>
          </div>
          {improverResult.changes.length > 0 && (
            <div className="pe-improver-changes">
              {improverResult.changes.map((c, i) => (
                <div key={i} className="pe-improver-change">
                  <div className="pe-improver-problem">{c.problem}</div>
                  <div className="pe-improver-solution">{c.solution}</div>
                </div>
              ))}
            </div>
          )}
          <pre className="pe-improver-prompt">{improverResult.improvedPrompt}</pre>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export default function PromptEvalExperiment() {
  const [activeSubTab, setActiveSubTab] = useState<EvalMode>("translation");

  // --- Shared: API key ---
  const [apiKey, setApiKey] = useLocalState("pe-api-key", "");

  // --- Shared: Test cases ---
  const initialTestCases = useMemo(() => {
    const allData = Object.values(inputFiles);
    return allData.flatMap((d) => d.testCases);
  }, []);

  const [testCases, setTestCases] = useState<TestCase[]>(initialTestCases);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const saveTestCases = useCallback(async (cases: TestCase[]) => {
    const data: TestData = { testCases: cases };
    await saveFile("input/input.json", JSON.stringify(data, null, 2) + "\n");
  }, []);

  const handleAddTestCase = useCallback(
    async (tc: TestCase) => {
      const updated = [...testCases, tc];
      setTestCases(updated);
      setShowAddDialog(false);
      await saveTestCases(updated);
    },
    [testCases, saveTestCases]
  );

  const handleEditTestCase = useCallback(
    async (tc: TestCase) => {
      if (editingIndex === null) return;
      const updated = testCases.map((existing, i) =>
        i === editingIndex ? tc : existing
      );
      setTestCases(updated);
      setEditingIndex(null);
      await saveTestCases(updated);
    },
    [testCases, editingIndex, saveTestCases]
  );

  const handleDeleteTestCase = useCallback(
    async (idx: number) => {
      const updated = testCases.filter((_, i) => i !== idx);
      setTestCases(updated);
      await saveTestCases(updated);
    },
    [testCases, saveTestCases]
  );

  return (
    <div className="prompt-eval">
      {/* API Key */}
      <div className="pe-config-bar">
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

      {/* Shared: Input Test Cases */}
      <div className="pe-test-data">
        <div className="pe-test-data-header">
          <label>
            Input Test Cases{" "}
            <span className="pe-file-info">
              {testCases.length} case{testCases.length !== 1 ? "s" : ""}
            </span>
          </label>
          <button
            className="pe-btn-add"
            onClick={() => setShowAddDialog(true)}
          >
            + Add Test Case
          </button>
        </div>
        {testCases.length === 0 ? (
          <div className="pe-file-info">
            No test cases. Click "+ Add Test Case" to create one.
          </div>
        ) : (
          <div className="pe-test-list">
            {testCases.map((tc, i) => (
              <div key={i} className="pe-test-item">
                <div className="pe-test-item-info">
                  <span className="pe-test-name">{tc.name}</span>
                  <span className="pe-test-meta">
                    {tc.input.length} lines
                    {tc.translationCriteria &&
                      " | T: " +
                        tc.translationCriteria.slice(0, 40) +
                        (tc.translationCriteria.length > 40 ? "..." : "")}
                    {tc.wordMeaningCriteria &&
                      " | W: " +
                        tc.wordMeaningCriteria.slice(0, 40) +
                        (tc.wordMeaningCriteria.length > 40 ? "..." : "")}
                  </span>
                </div>
                <div className="pe-test-item-actions">
                  <button
                    className="pe-btn-edit"
                    onClick={() => setEditingIndex(i)}
                  >
                    Edit
                  </button>
                  <button
                    className="pe-btn-delete"
                    onClick={() => handleDeleteTestCase(i)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="pe-subtab-bar">
        <button
          className={`pe-subtab${activeSubTab === "translation" ? " active" : ""}`}
          onClick={() => setActiveSubTab("translation")}
        >
          Translation
        </button>
        <button
          className={`pe-subtab${activeSubTab === "wordMeaning" ? " active" : ""}`}
          onClick={() => setActiveSubTab("wordMeaning")}
        >
          Word Meaning
        </button>
      </div>

      {/* Both panels always mounted, visibility toggled via CSS */}
      <div style={{ display: activeSubTab === "translation" ? "block" : "none" }}>
        <ModePanel mode="translation" apiKey={apiKey} testCases={testCases} />
      </div>
      <div style={{ display: activeSubTab === "wordMeaning" ? "block" : "none" }}>
        <ModePanel mode="wordMeaning" apiKey={apiKey} testCases={testCases} />
      </div>

      {/* Add / Edit Test Case Dialog */}
      {showAddDialog && (
        <TestCaseDialog
          onSubmit={handleAddTestCase}
          onClose={() => setShowAddDialog(false)}
        />
      )}
      {editingIndex !== null && (
        <TestCaseDialog
          initial={testCases[editingIndex]}
          onSubmit={handleEditTestCase}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}
