export type EvalMode = "translation" | "wordMeaning";

export interface TranslationInput {
  index: number;
  text: string;
  startTimeMs?: number | null;
}

export interface WordMeaningWord {
  surface: string;
  baseForm: string;
  pos: string;
}

export interface WordMeaningInput {
  index: number;
  text: string;
  words: WordMeaningWord[];
}

export interface TestCase {
  name: string;
  input: TranslationInput[] | WordMeaningInput[];
  criteria: string;
}

export interface TestData {
  testCases: TestCase[];
}

export interface Deduction {
  reason: string;
  points: number;
}

export interface GraderResult {
  score: number;
  deductions: Deduction[];
  comment: string;
}

export interface TestCaseResult {
  testCaseName: string;
  criteria: string;
  input: unknown;
  geminiOutput: string | null;
  geminiError: string | null;
  graderResult: GraderResult | null;
  graderError: string | null;
  executionLatencyMs: number;
  gradingLatencyMs: number;
  executionCost: number;
  gradingCost: number;
}

export interface EvalRun {
  timestamp: string;
  mode: EvalMode;
  executionModel: string;
  graderModel: string;
  temperature: number;
  systemPrompt: string;
  guidelines: string;
  averageScore: number | null;
  totalCost: number;
  results: TestCaseResult[];
}
