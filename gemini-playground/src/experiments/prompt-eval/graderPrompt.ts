export function buildGraderPrompt(
  guidelines: string,
  criteria: string,
  originalInput: string,
  geminiOutput: string
): string {
  return `You are an expert evaluator for a Japanese-to-Korean vocabulary translation LLM.

## Evaluation Guidelines (apply these as the complete spec)
${guidelines}

## Test Case Pass Criteria (specific to this case)
${criteria}

## LLM Input (what the LLM was given)
${originalInput}

## LLM Output (what you are evaluating)
${geminiOutput}

## Instructions
Score 0-10. Start at 10 and deduct for each issue per the guidelines above.
- Each deduction has a clear reason and a point value.
- Each reason MUST include the line index (e.g. "[index 3]" or "[index 12, 15]").
- Deduction points must sum to (10 - score).
- All reasons and comments in Korean.

If a candidate deduction would fall outside the In-Scope list in the guidelines, OMIT it entirely. Do NOT include "out of scope" issues with reduced points.

Return a JSON object:
- "score": integer 0-10
- "deductions": [{"reason": "[index N] <사유>", "points": <점수>}]
- "comment": "<종합 평가 코멘트>"`;
}

export function buildAdditionsPrompt(
  currentPrompt: string,
  currentAdditions: string,
  gradingResults: { testCaseName: string; score: number; deductions: { reason: string; points: number }[]; comment: string }[]
): string {
  const resultsSummary = gradingResults
    .map(
      (r) =>
        `### ${r.testCaseName} (${r.score}/10)\n` +
        (r.deductions.length > 0
          ? r.deductions.map((d) => `- -${d.points}: ${d.reason}`).join("\n") + "\n"
          : "") +
        `종합: ${r.comment}`
    )
    .join("\n\n");

  return `You are an expert prompt engineer for Japanese-to-Korean language learning LLM prompts.

## Current System Prompt (DO NOT REWRITE — only propose small additions)
${currentPrompt}

## Current Additions Already Applied (avoid duplicating these)
${currentAdditions.trim() ? currentAdditions : "(none yet)"}

## Grading Results from Evaluation
${resultsSummary}

## Your Task
Propose a list of **small, surgical additions** to append to the prompt. Each addition addresses one specific recurring deduction pattern.

### STRONG PREFERENCE: Contrastive WRONG/RIGHT pairs
Concrete examples beat abstract rules. Whenever possible, format an addition as:
\`\`\`
WRONG: (surface: <jp>, pos: <POS>) → <wrong korean>  (왜 틀렸는지 짧게)
RIGHT: (surface: <jp>, pos: <POS>) → <correct korean>  (옳은 이유)
\`\`\`

### When abstract rule is unavoidable
Only when no single example captures the pattern, write a 1-sentence rule.

## ⛔ ABSOLUTE PROHIBITIONS (most violated — read carefully)
1. **NEVER override or weaken any existing rule in the Current System Prompt.** If a deduction implies "you should break rule X to handle case Y", the correct answer is to **OMIT the addition** — accept the loss. Do not write additions that say "ignore POS when surface mood says otherwise" or "translate as command despite VERB→-다 rule" etc. The existing rules are load-bearing; trading them away cascades into many other failures.
2. **NEVER restate, paraphrase, or "supplement" rules that already exist in the Current System Prompt.** If the prompt says "VERB → -다 form", do not add an addition like "Reminder: VERB must be -다". The rule is already there; the LLM ignored it for other reasons. An example illustrating the rule is OK, but only if it covers a *new edge case* (e.g. specific surface form like 探せ).
3. **NEVER add additions sourced from the OUT-OF-SCOPE deduction categories** (input POS errors, segmentation errors, baseForm errors). The grader should not have produced these, but if any leaked through, ignore them.

## Hard Constraints
- **\`text\` field format**: ONLY the literal addition body — typically 2 lines (WRONG: / RIGHT:) or 1 short rule sentence. NO markdown headers (\`### ...\`), NO numbered prefixes (\`5.\`, \`### 5.\`), NO bullet points (\`-\`, \`* **Title:**\`), NO prose framing ("Here is an example:"). The category and label are separate JSON fields — do not duplicate them inside text.
- Each addition: **MAX 4 lines** total in \`text\`.
- Do NOT propose additions that overlap with "Current Additions Already Applied".
- Do NOT propose vague meta-instructions like "be more careful with X" or "pay attention to Y".
- Cluster: prefer additions that fix the **most-recurring** deduction patterns first.
- Skip patterns with only 1 occurrence across all cases (probably noise; addition may overfit).
- Stay in the language of the existing prompt for headers; Japanese examples and Korean translations as-is.

## Self-check before output
For each addition you propose, verify in your head:
- (a) Does it contradict any line in the Current System Prompt? → if yes, OMIT.
- (b) Does it merely restate an existing rule? → if yes, OMIT.
- (c) Does \`text\` contain markdown headers / bullets / numbering / prose framing? → if yes, strip them.
- (d) Does the underlying pattern occur in ≥ 2 deductions? → if no, OMIT.

## Output
Return a JSON object with:
- "additions": array of items, each with:
  - "category": one of "POS_MISMATCH" | "STRUCTURAL" | "CONTEXT_IDIOM" | "PARTICLE_AUX" | "WRONG_MEANING" | "OTHER"
  - "label": short title (e.g. "ADJECTIVE adverbial form")
  - "targetedDeductions": array of 1-3 representative deduction reasons this addresses (verbatim from grading results)
  - "text": the addition body itself (the WRONG/RIGHT pair or rule), max 4 lines
- "rationale": 1-2 sentences on which deduction patterns drove this set of additions and which were intentionally skipped.`;
}

export function buildImproverPrompt(
  currentPrompt: string,
  gradingResults: { testCaseName: string; score: number; deductions: { reason: string; points: number }[]; comment: string }[]
): string {
  const resultsSummary = gradingResults
    .map(
      (r) =>
        `### ${r.testCaseName} (${r.score}/10)\n` +
        (r.deductions.length > 0
          ? r.deductions.map((d) => `- -${d.points}: ${d.reason}`).join("\n") + "\n"
          : "") +
        `종합: ${r.comment}`
    )
    .join("\n\n");

  return `You are an expert prompt engineer for Japanese-to-Korean language learning LLM prompts.

## Current System Prompt
${currentPrompt}

## Grading Results from Evaluation
${resultsSummary}

## Instructions
Based on the grading results above, improve the system prompt to address the issues found.

- Analyze the deduction patterns across all test cases.
- Modify the prompt to prevent these issues from recurring.
- Keep the overall structure and intent of the original prompt.
- Do NOT add unnecessary verbosity — only add rules that address real problems.
- Write the improved prompt in English (Korean examples inline are fine).
- Write all commentary (problem/solution) in English.

Return a JSON object with:
- "improvedPrompt": the full improved system prompt text in English
- "changes": array of {"problem": "<problem found>", "solution": "<solution applied to prompt>"}`;
}
