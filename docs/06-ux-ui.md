# UX / UI Specification

## UX principles

- Benchmark setup should feel fast and operational
- Global libraries should be reusable and easy to browse
- Execution should make progress visible at all times
- Reports should feel polished and executive-ready
- Local model workflows should be explicit and low-friction

## Main navigation

- Dashboard
- Prompt Library
- Model Registry
- Sessions
- Runs
- Reports
- Settings

## 1. Dashboard

### Purpose

Provide a quick operational overview.

### Key elements

- KPI cards: prompts, models, sessions, completed runs
- recent sessions/runs
- quick actions
- report shortcuts

## 2. Prompt Library

### Purpose

Manage global prompts.

### Table columns

- Name
- Category
- Tags
- Updated at
- Status
- Actions

### Main actions

- Create prompt
- Edit prompt
- Archive prompt
- Duplicate prompt

### Create/Edit drawer or page

Fields:
- Name
- Description
- Category
- Tags
- Optional system prompt
- User prompt
- Optional evaluation notes

## 3. Model Registry

### Purpose

Manage candidate and judge profiles.

### Table columns

- Display name
- Role
- Provider
- Runtime
- Endpoint
- Machine
- Status
- Actions

### Create/Edit form

Fields:
- Display name
- Role
- Provider type
- API style
- Runtime type
- Endpoint URL
- Model identifier
- Secret
- Machine label
- Timeout
- Context window
- Pricing metadata
- Notes
- Local load instructions

## 4. Sessions list

### Purpose

Browse and manage benchmark sessions.

### Table columns

- Name
- Prompt count
- Candidate count
- Judge count
- Updated at
- Status
- Actions

## 5. Session detail / builder

### Layout

Three columns or stacked sections:

- Prompt selection
- Candidate selection
- Judge selection

### Prompt section

- searchable library picker
- selected prompt list with reorder/remove
- category badges

### Candidate section

- searchable model picker
- selected candidates list
- max 5 warning for MVP
- badges for local/remote

### Judge section

- searchable judge picker
- exactly 1 judge in MVP

### Actions

- Save session
- Duplicate session
- Launch benchmark

## 6. Run detail

### Purpose

Operational execution view.

### Sections

- Run summary header
- Step status timeline
- Candidate execution status table
- Local execution panel if needed
- Judge status section
- Report generation section

### Local execution panel

Should show:
- model to load
- runtime label
- endpoint check result if available
- instructions text
- buttons: Confirm ready / Start current model

## 7. Report view

### Executive summary page

- title, date, judge used, prompt count, candidate count
- main summary table
- top performer cards
- quality/cost/performance/global score overview

### Model detail sections

- averages by criterion
- technical metrics
- consolidated judge summary
- strengths and weaknesses

### Prompt detail sections

- prompt text
- anonymized candidate outputs during judge explanation if desired
- final mapped outputs by model
- per-prompt scores
- per-prompt feedback
- technical metrics table

## Visual style

- Clean dashboard layout
- Dense but readable tables
- Strong use of badges and status chips
- Color-coded scores on 0–100 scale
- Print-friendly report layout
