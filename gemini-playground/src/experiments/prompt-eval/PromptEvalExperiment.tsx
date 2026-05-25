import { useState, useCallback, useMemo } from "react";
import type {
  EvalMode,
  TestCase,
  TestData,
  TestCaseResult,
  EvalRun,
  GraderResult,
  AdditionsResult,
  AdditionItem,
  TranslationInput,
  WordMeaningInput,
} from "./types";
import {
  GEMINI_MODELS,
  callGemini,
  TRANSLATION_RESPONSE_SCHEMA,
  WORD_MEANING_RESPONSE_SCHEMA,
  GRADER_RESPONSE_SCHEMA,
  ADDITIONS_RESPONSE_SCHEMA,
} from "./geminiApi";
import { buildGraderPrompt, buildAdditionsPrompt } from "./graderPrompt";
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
const translationAdditionsFiles = import.meta.glob<string>(
  "./translation/additions/*.txt",
  { eager: true, query: "?raw", import: "default" }
);
const wordMeaningAdditionsFiles = import.meta.glob<string>(
  "./word-meaning/additions/*.txt",
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

// --- Chunked execution for word-meaning ---

interface ChunkedExecResult {
  text: string | null;
  error: string | null;
  wallTimeMs: number;
  sumLatencyMs: number;
  chunkLatenciesMs: number[];
  cost: number;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildContextPrefix(input: WordMeaningInput[]): string {
  const lines = input.map((l) => `[${l.index}] ${l.text}`).join("\n");
  return (
    "# Full lyric context (for reference only — DO NOT translate this section):\n" +
    lines +
    "\n\n# Translate ONLY the words in the JSON below (a subset of the full lyric):\n"
  );
}

async function executeWordMeaningChunked(
  apiKey: string,
  model: string,
  systemPrompt: string,
  input: WordMeaningInput[],
  temperature: number,
  chunkSize: number,
  includeContextPrefix: boolean
): Promise<ChunkedExecResult> {
  const chunks = chunkArray(input, chunkSize);
  const prefix = includeContextPrefix ? buildContextPrefix(input) : "";

  const chunkResults = await Promise.all(
    chunks.map((c) =>
      callGemini(
        apiKey,
        model,
        systemPrompt,
        prefix + JSON.stringify(c),
        temperature,
        WORD_MEANING_RESPONSE_SCHEMA
      )
    )
  );

  const latencies = chunkResults.map((r) => r.latencyMs);
  const wallTimeMs = latencies.length ? Math.max(...latencies) : 0;
  const sumLatencyMs = latencies.reduce((a, b) => a + b, 0);
  const cost = chunkResults.reduce((s, r) => s + r.cost, 0);

  const errChunk = chunkResults.find((r) => r.error);
  if (errChunk) {
    return {
      text: null,
      error: `Chunk failed: ${errChunk.error}`,
      wallTimeMs,
      sumLatencyMs,
      chunkLatenciesMs: latencies,
      cost,
    };
  }

  // Merge: parse each chunk, concat, sort by index
  let merged: { index: number }[] = [];
  for (const r of chunkResults) {
    try {
      const arr = JSON.parse(r.text!);
      if (Array.isArray(arr)) merged = merged.concat(arr);
    } catch (e) {
      return {
        text: null,
        error: `Chunk JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
        wallTimeMs,
        sumLatencyMs,
        chunkLatenciesMs: latencies,
        cost,
      };
    }
  }
  merged.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  return {
    text: JSON.stringify(merged),
    error: null,
    wallTimeMs,
    sumLatencyMs,
    chunkLatenciesMs: latencies,
    cost,
  };
}

// --- Sub-components ---

function TestCaseDialog({
  mode,
  initial,
  onSubmit,
  onClose,
}: {
  mode: EvalMode;
  initial?: TestCase;
  onSubmit: (tc: TestCase) => void;
  onClose: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [inputJson, setInputJson] = useState(
    initial ? JSON.stringify(initial.input, null, 2) : ""
  );
  const [criteria, setCriteria] = useState(initial?.criteria ?? "");
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const inputPlaceholder = '[{"index": 0, "text": "..."}]';

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    let parsed: { index: number; text: string }[];
    try {
      const json = JSON.parse(inputJson);
      if (!Array.isArray(json)) {
        setError("Input must be a JSON array");
        return;
      }
      parsed = json;
    } catch {
      setError("Invalid JSON");
      return;
    }

    setError("");

    let finalInput: TestCase["input"];
    if (mode === "wordMeaning") {
      // If every line already has a words array, trust the input as-is
      // (allows manual editing). Otherwise call the dev API to analyze.
      const allHaveWords = parsed.every(
        (line) => Array.isArray((line as { words?: unknown }).words)
      );
      if (allHaveWords) {
        finalInput = parsed as TestCase["input"];
      } else {
        setAnalyzing(true);
        try {
          const res = await fetch("/api/dev/word-meaning-input", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              parsed.map(({ index, text }) => ({ index, text }))
            ),
          });
          if (!res.ok) {
            setError(`Morphological analysis failed: HTTP ${res.status}`);
            setAnalyzing(false);
            return;
          }
          finalInput = await res.json();
        } catch (e) {
          setError(
            `Morphological analysis failed: ${e instanceof Error ? e.message : String(e)}`
          );
          setAnalyzing(false);
          return;
        }
        setAnalyzing(false);
      }
    } else {
      finalInput = parsed;
    }

    onSubmit({
      name: name.trim(),
      input: finalInput,
      criteria: criteria.trim() || null,
    });
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
          <label>
            Input (JSON array of lyric lines)
            {mode === "wordMeaning" && (
              <span className="pe-file-info" style={{ marginLeft: 8 }}>
                — words 없으면 저장 시 자동 분석, 있으면 입력 그대로 저장
              </span>
            )}
          </label>
          <textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            rows={10}
            placeholder={inputPlaceholder}
          />
        </div>
        <div className="pe-dialog-field">
          <label>Criteria (optional)</label>
          <textarea
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            rows={3}
            placeholder="e.g. 채점 기준..."
          />
        </div>
        {error && <div className="pe-dialog-error">{error}</div>}
        <div className="pe-dialog-actions">
          <button className="pe-btn-secondary" onClick={onClose} disabled={analyzing}>
            Cancel
          </button>
          <button className="pe-btn-primary" onClick={handleSubmit} disabled={analyzing}>
            {analyzing ? "Analyzing..." : isEdit ? "Save" : "Add"}
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
}: {
  mode: EvalMode;
  apiKey: string;
}) {
  const dir = mode === "translation" ? "translation" : "word-meaning";
  const defaultExecModel =
    mode === "translation"
      ? "gemini-3.1-pro-preview"
      : "gemini-3.1-flash-lite";
  const defaultTemp = "0";

  // --- Test cases (per-mode) ---
  const initialTestCases = useMemo(() => {
    const files = mode === "translation" ? translationInputFiles : wordMeaningInputFiles;
    return Object.values(files).flatMap((d) => d.testCases);
  }, [mode]);

  const [testCases, setTestCases] = useState<TestCase[]>(initialTestCases);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const saveTestCases = useCallback(async (cases: TestCase[]) => {
    const data: TestData = { testCases: cases };
    await saveFile(`${dir}/input/input.json`, JSON.stringify(data, null, 2) + "\n");
  }, [dir]);

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

  const initialAdditions = useMemo(
    () =>
      getFirstFileContent(
        mode === "translation"
          ? translationAdditionsFiles
          : wordMeaningAdditionsFiles
      ),
    [mode]
  );

  const [promptText, setPromptText] = useState(initialPrompt);
  const [guidelinesText, setGuidelinesText] = useState(initialGuidelines);
  const [additionsText, setAdditionsText] = useState(initialAdditions);

  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState(false);
  const [savingGuidelines, setSavingGuidelines] = useState(false);
  const [savedGuidelines, setSavedGuidelines] = useState(false);
  const [savingAdditions, setSavingAdditions] = useState(false);
  const [savedAdditions, setSavedAdditions] = useState(false);

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
  // Chunking config (word-meaning only; 0 = single-shot)
  const [chunkSizeStr, setChunkSizeStr] = useLocalState(
    `pe-${mode}-chunk-size`,
    "0"
  );
  const [contextPrefixStr, setContextPrefixStr] = useLocalState(
    `pe-${mode}-chunk-prefix`,
    "true"
  );
  const chunkSize = Math.max(0, parseInt(chunkSizeStr, 10) || 0);
  const includeContextPrefix = contextPrefixStr === "true";

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
  const [expandedInputs, setExpandedInputs] = useState<Set<number>>(
    new Set()
  );
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [additionsResult, setAdditionsResult] = useState<AdditionsResult | null>(null);
  const [additionsError, setAdditionsError] = useState<string | null>(null);
  const [generatingAdditions, setGeneratingAdditions] = useState(false);
  const [acceptedAdditions, setAcceptedAdditions] = useState<Set<number>>(new Set());
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

  const handleSaveAdditions = useCallback(async () => {
    setSavingAdditions(true);
    setSavedAdditions(false);
    try {
      await saveFile(`${dir}/additions/default.txt`, additionsText);
      setSavedAdditions(true);
      setTimeout(() => setSavedAdditions(false), 2000);
    } finally {
      setSavingAdditions(false);
    }
  }, [dir, additionsText]);

  // Compose system prompt = base prompt + additions section (if any)
  const composedPrompt = useMemo(() => {
    if (!additionsText.trim()) return promptText;
    return (
      promptText +
      "\n\n## Additional Examples and Rules (accumulated from past evaluations)\n\n" +
      additionsText.trim()
    );
  }, [promptText, additionsText]);

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

  const toggleInput = useCallback((idx: number) => {
    setExpandedInputs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // --- Build Gemini input matching backend format ---
  const buildGeminiInput = useCallback(
    (tc: TestCase): string => {
      if (mode === "translation") {
        // Backend sends only {index, text} — strip startTimeMs
        const stripped = (tc.input as TranslationInput[]).map(({ index, text }) => ({
          index,
          text,
        }));
        return JSON.stringify(stripped);
      }
      // Word meaning: send only the minimum fields the LLM needs (index +
      // baseForm). `text`, `surface`, and `pos` are upstream metadata that
      // were observed to mislead the LLM (English token hallucinations,
      // POS-driven mood leaks). Keep the input surface area small.
      const stripped = (tc.input as WordMeaningInput[]).map((line) => ({
        index: line.index,
        words: line.words.map(({ baseForm }) => ({ baseForm })),
      }));
      return JSON.stringify(stripped);
    },
    [mode]
  );

  // --- Run evaluation ---
  const runEvaluation = useCallback(async () => {
    if (!apiKey.trim() || testCases.length === 0 || running) return;
    setRunning(true);
    setResults([]);
    setExpandedCards(new Set());
    setExpandedOutputs(new Set());
    setExpandedInputs(new Set());
    setSavedPath(null);
    setAdditionsResult(null);
    setAdditionsError(null);
    setAcceptedAdditions(new Set());

    const temp = parseFloat(temperature) || 0;
    const totalTests = testCases.length;

    // Step 1: Execute prompts in parallel
    setProgress(`Executing... 0/${totalTests}`);
    let executionDone = 0;

    const useChunking = mode === "wordMeaning" && chunkSize > 0;

    const executionResults = await Promise.all(
      testCases.map(async (tc) => {
        if (useChunking) {
          // Strip to minimum fields for chunked path (parity with single-shot)
          const strippedInput = (tc.input as WordMeaningInput[]).map((line) => ({
            index: line.index,
            words: line.words.map(({ baseForm }) => ({ baseForm })),
          })) as unknown as WordMeaningInput[];
          const chunked = await executeWordMeaningChunked(
            apiKey,
            execModel,
            composedPrompt,
            strippedInput,
            temp,
            chunkSize,
            includeContextPrefix
          );
          executionDone++;
          setProgress(`Executing... ${executionDone}/${totalTests}`);
          return {
            text: chunked.text,
            error: chunked.error,
            // Report wall-time as the user-facing latency
            latencyMs: chunked.wallTimeMs,
            cost: chunked.cost,
            chunkLatenciesMs: chunked.chunkLatenciesMs,
            sumLatencyMs: chunked.sumLatencyMs,
          };
        }
        const inputJson = buildGeminiInput(tc);
        const result = await callGemini(
          apiKey,
          execModel,
          composedPrompt,
          inputJson,
          temp,
          responseSchema
        );
        executionDone++;
        setProgress(`Executing... ${executionDone}/${totalTests}`);
        return {
          text: result.text,
          error: result.error,
          latencyMs: result.latencyMs,
          cost: result.cost,
          chunkLatenciesMs: undefined as number[] | undefined,
          sumLatencyMs: undefined as number | undefined,
        };
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

        const criteriaText = tc.criteria || "채점기준 없음 (guidelines만 적용)";

        // For word-meaning grader: strip to the same minimum fields the LLM
        // saw, so the grader cannot hallucinate "missing English token"
        // deductions from the lyric `text` or POS-form deductions from `pos`.
        let originalInputForGrader: string;
        if (mode === "wordMeaning") {
          const view = (tc.input as WordMeaningInput[]).map((line) => ({
            index: line.index,
            words: line.words.map(({ baseForm }) => ({ baseForm })),
          }));
          originalInputForGrader = JSON.stringify(view, null, 2);
        } else {
          originalInputForGrader = JSON.stringify(tc.input, null, 2);
        }

        const graderInput = buildGraderPrompt(
          guidelinesText,
          criteriaText,
          originalInputForGrader,
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
        criteria: tc.criteria ?? null,
        geminiInput: buildGeminiInput(tc),
        geminiOutput: exec.text,
        geminiError: exec.error,
        graderResult,
        graderError,
        executionLatencyMs: exec.latencyMs,
        gradingLatencyMs: grade.latencyMs,
        executionCost: exec.cost,
        gradingCost: grade.cost,
        chunkLatenciesMs: exec.chunkLatenciesMs,
        sumLatencyMs: exec.sumLatencyMs,
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
      systemPrompt: composedPrompt,
      guidelines: guidelinesText,
      averageScore: avgScore,
      totalCost,
      results: newResults,
      ...(useChunking
        ? { chunkSize, includeContextPrefix }
        : {}),
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
    composedPrompt,
    guidelinesText,
    responseSchema,
    mode,
    buildGeminiInput,
    chunkSize,
    includeContextPrefix,
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

  // --- Generate atomic additions from checked deductions ---
  const runGenerateAdditions = useCallback(async () => {
    if (generatingAdditions) return;
    setGeneratingAdditions(true);
    setAdditionsResult(null);
    setAdditionsError(null);
    setAcceptedAdditions(new Set());

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
      setAdditionsError("No deductions selected");
      setGeneratingAdditions(false);
      return;
    }

    const builderInput = buildAdditionsPrompt(promptText, additionsText, gradedResults);
    const res = await callGemini(
      apiKey,
      graderModel,
      "",
      builderInput,
      0,
      ADDITIONS_RESPONSE_SCHEMA
    );

    if (res.text && !res.error) {
      try {
        const parsed: AdditionsResult = JSON.parse(res.text);
        setAdditionsResult(parsed);
        // Default: accept all proposals
        setAcceptedAdditions(new Set(parsed.additions.map((_, i) => i)));
      } catch {
        setAdditionsError("Failed to parse additions response");
      }
    } else {
      setAdditionsError(res.error ?? "Unknown error");
    }
    setGeneratingAdditions(false);
  }, [generatingAdditions, results, checkedDeductions, promptText, additionsText, apiKey, graderModel]);

  const toggleAcceptedAddition = useCallback((idx: number) => {
    setAcceptedAdditions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const applyAdditions = useCallback(() => {
    if (!additionsResult) return;
    const selected: AdditionItem[] = additionsResult.additions.filter((_, i) =>
      acceptedAdditions.has(i)
    );
    if (selected.length === 0) return;
    const blocks = selected.map((a) => {
      // Strip leaked headers, numbered prefixes, bold-title bullets that LLMs sometimes inject
      const cleaned = a.text
        .split("\n")
        .map((line) => line.replace(/\s+$/, ""))
        .filter((line) => {
          const t = line.trim();
          if (!t) return true; // keep blank lines for readability
          // Drop lines that are pure markdown headers or numbered section titles
          if (/^#{1,6}\s/.test(t)) return false;
          if (/^\d+\.\s+[A-Z][^:]*$/.test(t)) return false;
          if (/^-\s+\*\*[^*]+:\*\*\s*$/.test(t)) return false;
          return true;
        })
        .join("\n")
        .trim();
      return `### [${a.category}] ${a.label}\n${cleaned}`;
    });
    const newAdditions =
      (additionsText.trim() ? additionsText.trim() + "\n\n" : "") +
      blocks.join("\n\n") +
      "\n";
    setAdditionsText(newAdditions);
    // Clear the proposal panel after applying
    setAdditionsResult(null);
    setAcceptedAdditions(new Set());
  }, [additionsResult, acceptedAdditions, additionsText]);

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
      {/* Test Cases (per-mode) */}
      <div className="pe-test-data">
        <div className="pe-test-data-header">
          <label>
            Test Cases{" "}
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
                    {tc.criteria &&
                      " | " +
                        tc.criteria.slice(0, 50) +
                        (tc.criteria.length > 50 ? "..." : "")}
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

      {/* Additions (appended to prompt at execution time) */}
      <EditablePanel
        label="Additions (appended to System Prompt at runtime)"
        value={additionsText}
        onChange={setAdditionsText}
        onSave={handleSaveAdditions}
        saving={savingAdditions}
        saved={savedAdditions}
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
        {mode === "wordMeaning" && (
          <>
            <div className="pe-config-field">
              <label>Chunk Size (0=off)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={chunkSizeStr}
                onChange={(e) => setChunkSizeStr(e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <div className="pe-config-field">
              <label>Context Prefix</label>
              <input
                type="checkbox"
                checked={includeContextPrefix}
                onChange={(e) =>
                  setContextPrefixStr(e.target.checked ? "true" : "false")
                }
                disabled={chunkSize === 0}
              />
            </div>
          </>
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

                  {r.geminiInput && (
                    <>
                      <button
                        className="pe-output-toggle"
                        onClick={() => toggleInput(i)}
                      >
                        {expandedInputs.has(i)
                          ? "\u25B2 Hide input"
                          : "\u25BC Show input"}
                      </button>
                      {expandedInputs.has(i) && (
                        <div className="pe-output-raw">
                          {formatJson(r.geminiInput)}
                        </div>
                      )}
                    </>
                  )}
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
                onClick={runGenerateAdditions}
                disabled={generatingAdditions || checkedDeductions.size === 0}
              >
                {generatingAdditions ? "Generating..." : "Generate Additions"}
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

      {/* Additions Generator Result */}
      {additionsError && (
        <div className="pe-improver-panel">
          <div className="pe-improver-header">Additions</div>
          <div className="pe-deduction" style={{ margin: 16 }}>Error: {additionsError}</div>
        </div>
      )}
      {additionsResult && (
        <div className="pe-improver-panel">
          <div className="pe-improver-header">
            <span>
              Proposed Additions ({additionsResult.additions.length}) — review then apply
            </span>
            <div className="pe-editable-actions">
              <button
                className="pe-btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => {
                  if (acceptedAdditions.size === additionsResult.additions.length) {
                    setAcceptedAdditions(new Set());
                  } else {
                    setAcceptedAdditions(
                      new Set(additionsResult.additions.map((_, i) => i))
                    );
                  }
                }}
              >
                {acceptedAdditions.size === additionsResult.additions.length
                  ? "Uncheck All"
                  : "Check All"}
              </button>
              <button
                className="pe-btn-primary"
                onClick={applyAdditions}
                disabled={acceptedAdditions.size === 0}
              >
                Apply Selected ({acceptedAdditions.size})
              </button>
            </div>
          </div>
          {additionsResult.rationale && (
            <div className="pe-improver-changes">
              <div className="pe-improver-change">
                <div className="pe-improver-solution">{additionsResult.rationale}</div>
              </div>
            </div>
          )}
          <div className="pe-deduction-review-list">
            {additionsResult.additions.map((a, i) => (
              <label key={i} className="pe-deduction-review-item" style={{ alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={acceptedAdditions.has(i)}
                  onChange={() => toggleAcceptedAddition(i)}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                    [{a.category}] {a.label}
                  </div>
                  <pre style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>
                    {a.text}
                  </pre>
                  {a.targetedDeductions.length > 0 && (
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
                      Targets: {a.targetedDeductions.slice(0, 2).join(" / ")}
                      {a.targetedDeductions.length > 2 && ` (+${a.targetedDeductions.length - 2})`}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Test Case Dialog */}
      {showAddDialog && (
        <TestCaseDialog
          mode={mode}
          onSubmit={handleAddTestCase}
          onClose={() => setShowAddDialog(false)}
        />
      )}
      {editingIndex !== null && (
        <TestCaseDialog
          mode={mode}
          initial={testCases[editingIndex]}
          onSubmit={handleEditTestCase}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}

// --- Main Component ---

export default function PromptEvalExperiment() {
  const [activeSubTab, setActiveSubTab] = useState<EvalMode>("translation");

  // --- Shared: API key ---
  const [apiKey, setApiKey] = useLocalState("pe-api-key", "");

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
        <ModePanel mode="translation" apiKey={apiKey} />
      </div>
      <div style={{ display: activeSubTab === "wordMeaning" ? "block" : "none" }}>
        <ModePanel mode="wordMeaning" apiKey={apiKey} />
      </div>
    </div>
  );
}
