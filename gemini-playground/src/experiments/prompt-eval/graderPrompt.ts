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
