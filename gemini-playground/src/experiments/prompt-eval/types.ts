export type EvalMode =
  | "translation"
  | "wordMeaning"
  | "wordMeaningWithTranslation";

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

export interface WordMeaningWithTranslationInput {
  index: number;
  text: string;
  sentenceKo: string;
  words: WordMeaningWord[];
}

export interface TestCase {
  name: string;
  input:
    | TranslationInput[]
    | WordMeaningInput[]
    | WordMeaningWithTranslationInput[];
  criteria?: string | null;
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
  geminiInput: string | null;
  geminiOutput: string | null;
  geminiError: string | null;
  graderResult: GraderResult | null;
  graderError: string | null;
  executionLatencyMs: number;
  gradingLatencyMs: number;
  executionCost: number;
  gradingCost: number;
  // Chunked execution metadata (word-meaning only, when chunkSize > 0)
  chunkLatenciesMs?: number[];
  sumLatencyMs?: number;
}

export interface PromptChange {
  problem: string;
  solution: string;
}

export interface ImproverResult {
  improvedPrompt: string;
  changes: PromptChange[];
}

export type AdditionCategory =
  | "POS_MISMATCH"
  | "STRUCTURAL"
  | "CONTEXT_IDIOM"
  | "PARTICLE_AUX"
  | "WRONG_MEANING"
  | "OTHER";

export interface AdditionItem {
  category: AdditionCategory;
  label: string;
  targetedDeductions: string[];
  text: string;
}

export interface AdditionsResult {
  additions: AdditionItem[];
  rationale: string;
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
  // Word-meaning chunking config (0 = single-shot)
  chunkSize?: number;
  includeContextPrefix?: boolean;
}
