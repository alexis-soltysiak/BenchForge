# Reporting Specification

## 1. Output formats

- HTML report is the source of truth
- PDF export is derived from the HTML report

## 2. Executive summary page

### Required sections

- report title
- benchmark session name
- run timestamp
- judge model used
- number of prompts
- number of candidate models
- main summary matrix

### Main summary matrix

Rows:
- candidate models

Columns:
- judge score
- quality score
- cost score
- performance score
- final global score

## 3. Model pages / sections

For each candidate model:

- profile summary
- average criterion scores
- average latency
- total and average token usage
- total and average cost
- throughput data
- global synthesis text
- top strengths
- top weaknesses

## 4. Prompt detail pages / sections

For each prompt:

- prompt metadata
- category
- prompt content
- all candidate responses
- technical metrics by response
- judge scores by candidate
- ranking
- judge feedback

## 5. Report quality requirements

- professional layout
- readable in browser and on paper
- strong tables and score chips
- consistent typography
- clear page breaks for PDF

## 6. Future enhancements

- trend sections across runs
- comparison reports
- category breakdown heatmaps
- export to machine-readable JSON bundles
