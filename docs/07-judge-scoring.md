# Judge, Scoring, and Aggregation

## 1. Judge approach

MVP uses one LLM judge per session.
The judge evaluates responses per prompt after candidates have all produced outputs.

## 2. Judge constraints

- Candidates must be anonymized
- Candidate order must be randomized
- MVP supports at most 5 candidates in a batch
- Judge returns structured output only

## 3. Fixed rubric for MVP

Each candidate response should be scored from 0 to 100 on:

- relevance
- accuracy
- completeness
- clarity
- instruction_following
- overall_score

The judge should also return:

- ranking_in_batch
- strengths
- weaknesses
- short_feedback
- detailed_feedback
- confidence

## 4. Structured output shape

Suggested normalized schema:

```json
{
  "prompt_assessment": {
    "prompt_id": "string",
    "batch_size": 3,
    "candidates": [
      {
        "candidate_label": "A",
        "overall_score": 86,
        "relevance": 90,
        "accuracy": 84,
        "completeness": 80,
        "clarity": 88,
        "instruction_following": 89,
        "ranking_in_batch": 1,
        "strengths": ["clear structure", "good coverage"],
        "weaknesses": ["slightly verbose"],
        "short_feedback": "Strong and reliable answer.",
        "detailed_feedback": "The answer is clear, mostly accurate, and covers the request well.",
        "confidence": 82
      }
    ]
  }
}
```

## 5. Global scoring

### Candidate-level aggregation

For each candidate model in a run:

- average all per-prompt overall scores
- average all criterion scores
- compute technical summaries
- generate global judge synthesis

### Global score recommendation

For MVP, use a composite score such as:

- 70% quality score
- 15% cost-efficiency score
- 15% performance score

This should be configurable later.

## 6. Judge synthesis pass

After all per-prompt evaluations are complete, run a second synthesis pass to generate:

- a global summary for each candidate model
- recurring strengths
- recurring weaknesses
- an overall comparative summary across candidates

## 7. Future scoring evolution

V1/V2 may add:

- category-specific rubrics
- multiple judges
- pairwise comparisons
- Elo-like or Bradley-Terry ranking
- judge agreement analysis
