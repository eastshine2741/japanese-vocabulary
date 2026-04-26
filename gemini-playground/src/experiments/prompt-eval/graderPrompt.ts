export function buildGraderPrompt(
  guidelines: string,
  criteria: string,
  originalInput: string,
  geminiOutput: string
): string {
  return `You are an expert evaluator for Japanese-to-Korean language learning prompts.
Your task is to evaluate the quality of an LLM output against provided guidelines and criteria.

## Evaluation Guidelines (global rules the output must follow)
${guidelines}

## Test Case Pass Criteria (specific requirements for this test case)
${criteria}

## Original Input (what was given to the LLM)
${originalInput}

## LLM Output (what you are evaluating)
${geminiOutput}

## Instructions
Score the output from 0 to 10.
- Start from 10 and deduct points for each issue found.
- Evaluate based on BOTH the global guidelines AND the test case criteria.
- Each deduction must have a clear reason and point value.
- The sum of deduction points should equal (10 - score).
- Write all reasons and comments in Korean.

Return a JSON object with:
- "score": integer 0-10
- "deductions": array of {"reason": "<감점 사유>", "points": <감점 점수>}
- "comment": "<종합 평가 코멘트>"`;
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
