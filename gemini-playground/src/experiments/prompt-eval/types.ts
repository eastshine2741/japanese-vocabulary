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
  translationCriteria?: string | null;
  wordMeaningCriteria?: string | null;
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
  criteria: string | null;
  geminiOutput: string | null;
  geminiError: string | null;
  graderResult: GraderResult | null;
  graderError: string | null;
  executionLatencyMs: number;
  gradingLatencyMs: number;
  executionCost: number;
  gradingCost: number;
}

export interface PromptChange {
  problem: string;
  solution: string;
}

export interface ImproverResult {
  improvedPrompt: string;
  changes: PromptChange[];
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
