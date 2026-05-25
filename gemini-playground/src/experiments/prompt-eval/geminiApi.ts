export const GEMINI_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-pro-preview": { input: 2.0, output: 12.0 },
  "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
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

// --- Per-model rate limiter (sliding window, RPM) ---
// Some preview models have very tight quotas (e.g. gemini-3.1-pro-preview = 25 RPM).
// We use values slightly below the documented limit for safety.
const RATE_LIMITS_RPM: Record<string, number> = {
  "gemini-3.1-pro-preview": 22,
};

const recentRequests = new Map<string, number[]>();
const acquireChains = new Map<string, Promise<unknown>>();

async function acquireRateSlot(model: string): Promise<void> {
  const limit = RATE_LIMITS_RPM[model];
  if (!limit) return;

  // Serialize the slot-acquisition step per model so we don't race on the window check.
  // Concurrent in-flight requests are still allowed (up to `limit` per minute).
  const prev = acquireChains.get(model) ?? Promise.resolve();
  const next = prev.then(async () => {
    const now = Date.now();
    const win = (recentRequests.get(model) ?? []).filter((t) => now - t < 60_000);
    if (win.length >= limit) {
      const wait = 60_000 - (now - win[0]) + 50;
      await new Promise((r) => setTimeout(r, wait));
      const after = Date.now();
      const win2 = (recentRequests.get(model) ?? []).filter((t) => after - t < 60_000);
      win2.push(after);
      recentRequests.set(model, win2);
    } else {
      win.push(now);
      recentRequests.set(model, win);
    }
  });
  acquireChains.set(
    model,
    next.catch(() => {})
  );
  await next;
}

export async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  input: string,
  temperature: number,
  responseSchema?: Record<string, unknown>
): Promise<GeminiCallResult> {
  await acquireRateSlot(model);
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
            baseForm: { type: "STRING" },
            koreanText: { type: "STRING" },
          },
          required: ["baseForm", "koreanText"],
        },
      },
    },
    required: ["index", "words"],
  },
};

export const ADDITIONS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    additions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING" },
          label: { type: "STRING" },
          targetedDeductions: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          text: { type: "STRING" },
        },
        required: ["category", "label", "targetedDeductions", "text"],
      },
    },
    rationale: { type: "STRING" },
  },
  required: ["additions", "rationale"],
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
