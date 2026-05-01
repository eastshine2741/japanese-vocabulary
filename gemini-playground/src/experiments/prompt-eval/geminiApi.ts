export const GEMINI_MODELS = [
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

export interface GeminiCallResult {
  text: string | null;
  error: string | null;
  latencyMs: number;
  cost: number;
}

export async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  input: string,
  temperature: number,
  responseSchema?: Record<string, unknown>
): Promise<GeminiCallResult> {
  const start = performance.now();

  const generationConfig: Record<string, unknown> = {
    temperature,
    responseMimeType: "application/json",
  };
  if (responseSchema) {
    generationConfig.responseSchema = responseSchema;
  }

  const requestBody: Record<string, unknown> = {
    contents: [{ parts: [{ text: input }] }],
    generationConfig,
  };

  if (systemPrompt.trim()) {
    requestBody.system_instruction = { parts: [{ text: systemPrompt }] };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
      return { text: null, error: msg, latencyMs, cost: 0 };
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const usage = data?.usageMetadata;
    const promptTokens = usage?.promptTokenCount ?? 0;
    const candidateTokens = usage?.candidatesTokenCount ?? 0;
    const cost = calcCost(model, promptTokens, candidateTokens);

    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason;
      return { text: null, error: `Empty response (finishReason: ${reason ?? "unknown"})`, latencyMs, cost };
    }

    return { text, error: null, latencyMs, cost };
  } catch (e) {
    return {
      text: null,
      error: e instanceof Error ? e.message : String(e),
      latencyMs: Math.round(performance.now() - start),
      cost: 0,
    };
  }
}

export const TRANSLATION_RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      index: { type: "INTEGER" },
      koreanLyrics: { type: "STRING" },
      koreanPronounciation: { type: "STRING" },
    },
    required: ["index", "koreanLyrics", "koreanPronounciation"],
  },
};

export const WORD_MEANING_RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      index: { type: "INTEGER" },
      words: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            surface: { type: "STRING" },
            baseForm: { type: "STRING" },
            koreanText: { type: "STRING" },
          },
          required: ["surface", "baseForm", "koreanText"],
        },
      },
    },
    required: ["index", "words"],
  },
};

export const IMPROVER_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    improvedPrompt: { type: "STRING" },
    changes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          problem: { type: "STRING" },
          solution: { type: "STRING" },
        },
        required: ["problem", "solution"],
      },
    },
  },
  required: ["improvedPrompt", "changes"],
};

export const GRADER_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" },
    deductions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          reason: { type: "STRING" },
          points: { type: "NUMBER" },
        },
        required: ["reason", "points"],
      },
    },
    comment: { type: "STRING" },
  },
  required: ["score", "deductions", "comment"],
};
