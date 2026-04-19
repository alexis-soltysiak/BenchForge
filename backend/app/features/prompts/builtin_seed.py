from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BuiltinPromptSeed:
    slug: str
    name: str
    category_slug: str
    description: str
    user_prompt_text: str
    evaluation_notes: str | None
    tags: tuple[str, ...]
    system_prompt_text: str | None = None
    difficulty: int | None = None


BUILTIN_PROMPT_SEEDS: tuple[BuiltinPromptSeed, ...] = (
    BuiltinPromptSeed(
        slug="summarize-incident-timeline-short",
        name="summarize_incident_timeline_short",
        category_slug="summarization",
        description="Summarize a short incident timeline into a concise operational update.",
        system_prompt_text=(
            "You are an operations summarizer. Keep only the essential facts, "
            "preserve chronology, and do not invent missing details."
        ),
        user_prompt_text=(
            "Summarize the incident update below in exactly 3 bullet points. "
            "Each bullet must start with one of these labels: `Issue`, `Impact`, `Next step`.\n\n"
            "Incident notes:\n"
            "- At 09:12, multiple users reported checkout failures.\n"
            "- At 09:18, engineering confirmed a database connection pool saturation issue.\n"
            "- At 09:27, traffic was partially rerouted and error rate dropped.\n"
            "- Some EU customers still experienced slow checkout until 09:41.\n"
            "- A configuration change is being reviewed to prevent recurrence.\n"
            "- No data loss has been observed."
        ),
        evaluation_notes=(
            "Reward exact 3-bullet structure, correct chronology, mention of partial recovery "
            "and absence of observed data loss, and no invented root cause beyond connection pool saturation."
        ),
        tags=("benchmark", "summarization", "operations", "concise", "instruction-following"),
        difficulty=1,
    ),
    BuiltinPromptSeed(
        slug="summarize-conflicting-strategy-notes",
        name="summarize_conflicting_strategy_notes",
        category_slug="summarization",
        description="Summarize strategy notes containing both confirmed decisions and unresolved disagreement.",
        system_prompt_text=(
            "You are a precise business summarizer. Distinguish confirmed decisions "
            "from open questions and avoid overstating uncertain points."
        ),
        user_prompt_text=(
            "Summarize the notes below in no more than 4 bullet points. "
            "Separate confirmed decisions from unresolved points. "
            "Include owners only if explicitly named.\n\n"
            "Notes:\n"
            "- Team agreed retention is the top KPI for next quarter.\n"
            "- Paid acquisition budget may increase, but finance has not approved it.\n"
            "- Lina will prepare two budget scenarios by Friday.\n"
            "- Sales wants a faster launch in Spain, while legal raised concerns about contract localization.\n"
            "- Product confirmed the referral feature will move to phase 2.\n"
            "- There was discussion about changing pricing tiers, but no consensus."
        ),
        evaluation_notes=(
            "Reward identification of confirmed decisions versus unresolved items, "
            "inclusion of Lina as owner, and avoidance of presenting budget/pricing discussion as finalized."
        ),
        tags=("benchmark", "summarization", "business", "ambiguity", "decision-making"),
        difficulty=3,
    ),
    BuiltinPromptSeed(
        slug="extract-ticket-json-normalized",
        name="extract_ticket_json_normalized",
        category_slug="structured-output",
        description="Extract a customer support message into a strict normalized JSON schema.",
        system_prompt_text="Return valid JSON only. Follow the schema exactly and normalize values according to the rules.",
        user_prompt_text=(
            "Extract the following message into strict JSON with exactly these keys:\n"
            "`customer_name`, `company`, `issue_type`, `priority`, `order_id`, `requires_follow_up`\n\n"
            "Rules:\n"
            "- `issue_type` must be one of: `billing`, `login`, `bug`, `feature_request`, `other`\n"
            "- `priority` must be one of: `low`, `medium`, `high`, `urgent`\n"
            "- `requires_follow_up` must be a boolean\n"
            "- Use null if a value is missing\n"
            "- Return JSON only\n\n"
            "Message:\n"
            "Hello, I'm Daniel from Northbeam. Since this morning, the dashboard exports generate "
            "empty CSV files. We need this fixed before the board meeting tomorrow. Our reference is "
            "ORD-88219. Please keep me updated."
        ),
        evaluation_notes=(
            "Reward exact schema compliance, mapping to `bug`, a strong priority choice, "
            "correct extraction of Daniel, Northbeam, and ORD-88219, and boolean true for follow-up."
        ),
        tags=("benchmark", "structured-output", "json", "normalization", "support"),
        difficulty=2,
    ),
    BuiltinPromptSeed(
        slug="transform-mixed-catalog-rows",
        name="transform_mixed_catalog_rows",
        category_slug="structured-output",
        description="Convert semi-structured catalog rows into validated JSON while applying filtering and normalization rules.",
        system_prompt_text="Return valid JSON only. Follow every rule strictly. Invalid rows must be handled exactly as instructed.",
        user_prompt_text=(
            "Convert the following rows into a JSON array. Each object must contain exactly these keys:\n"
            "`sku`, `name`, `price_eur`, `stock_status`, `category`\n\n"
            "Rules:\n"
            "- `price_eur` must be a number\n"
            "- `stock_status` must be one of: `in_stock`, `out_of_stock`, `preorder`\n"
            "- `category` must be one of: `hardware`, `software`, `service`\n"
            "- Exclude rows with a missing or invalid SKU\n"
            "- Normalize decimal commas to decimal points\n"
            "- Trim surrounding spaces\n"
            "- Return JSON only\n\n"
            "Rows:\n"
            "1. SKU= HW-900 | Name= USB Hub | Price=24,90 | Stock=available | Category=hardware\n"
            "2. SKU=SW-12A | Name= Insight Cloud | Price= 49.00 | Stock=preorder | Category=software\n"
            "3. SKU=NONE | Name= Migration Pack | Price=299 | Stock=available | Category=service\n"
            "4. SKU=SV-77 | Name= Premium Setup | Price=tbd | Stock=available | Category=service"
        ),
        evaluation_notes=(
            "Reward correct normalization, row exclusion for invalid SKU, proper stock mapping, "
            "and strict JSON output. Penalize commentary, invalid enums, or keeping malformed rows without respecting schema."
        ),
        tags=("benchmark", "structured-output", "json", "data-cleaning", "validation"),
        difficulty=4,
    ),
    BuiltinPromptSeed(
        slug="reasoning-meeting-slot-feasibility",
        name="reasoning_meeting_slot_feasibility",
        category_slug="reasoning",
        description="Determine whether a valid meeting schedule exists under multiple time constraints.",
        system_prompt_text="Reason carefully and prefer correctness over verbosity. If no valid solution exists, state it explicitly.",
        user_prompt_text=(
            "Three people must attend a 30-minute meeting.\n"
            "Constraints:\n"
            "- Anna is available at 09:00, 10:00, and 13:00.\n"
            "- Bilal is available at 10:00 and 11:00 only.\n"
            "- Chloe is available at 09:00, 11:00, and 13:00.\n"
            "- The meeting must happen before 12:00.\n\n"
            "Is there a valid slot? Give the final answer first, then a short explanation."
        ),
        evaluation_notes=(
            "Reward fast detection that no common slot exists before 12:00 "
            "and concise justification using the intersected availabilities."
        ),
        tags=("benchmark", "reasoning", "logic", "scheduling", "constraint-solving"),
        difficulty=2,
    ),
    BuiltinPromptSeed(
        slug="reasoning-argument-hidden-assumption",
        name="reasoning_argument_hidden_assumption",
        category_slug="reasoning",
        description="Identify the hidden assumption in a business argument and test whether the conclusion follows.",
        system_prompt_text="You are a critical reasoner. Identify assumptions precisely and avoid vague critique.",
        user_prompt_text=(
            "Analyze this argument in no more than 120 words:\n"
            "\"Customer churn decreased in the month after we launched premium onboarding. "
            "Therefore, premium onboarding caused the churn reduction.\"\n\n"
            "Your answer must include:\n"
            "1. The main hidden assumption\n"
            "2. Why the conclusion may be too strong\n"
            "3. One additional piece of evidence that would make the claim more convincing"
        ),
        evaluation_notes=(
            "Reward clear identification of causal assumption, correlation-vs-causation reasoning, "
            "and a relevant evidence proposal such as comparison groups or confounder control."
        ),
        tags=("benchmark", "reasoning", "critical-thinking", "causality", "analysis"),
        difficulty=3,
    ),
    BuiltinPromptSeed(
        slug="rewrite-executive-status-email",
        name="rewrite_executive_status_email",
        category_slug="writing",
        description="Rewrite an informal internal update into a concise executive-ready status email.",
        system_prompt_text="Write for senior stakeholders. Be concise, calm, and action-oriented while preserving the facts.",
        user_prompt_text=(
            "Rewrite the following message as a professional email to an executive sponsor. "
            "Keep it under 120 words and include: current status, risk, and requested action.\n\n"
            "Original message:\n"
            "\"Quick heads-up, we're still blocked by procurement and it's dragging everything. "
            "The vendor docs are half-ready, legal has comments, and now the pilot start date is looking shaky. "
            "We need someone to unblock ownership because every team says it's on someone else's side.\""
        ),
        evaluation_notes=(
            "Reward concise executive tone, clear risk framing, preserved meaning, "
            "and a concrete request for intervention without emotional language."
        ),
        tags=("benchmark", "writing", "email", "business", "style-transfer"),
        difficulty=2,
    ),
    BuiltinPromptSeed(
        slug="write-apology-with-policy-constraints",
        name="write_apology_with_policy_constraints",
        category_slug="writing",
        description="Draft a customer response balancing empathy, accountability, and strict commercial limits.",
        system_prompt_text="Write with empathy and professionalism. Respect all commercial constraints exactly.",
        user_prompt_text=(
            "Write a reply to a customer whose delivery arrived 4 days late and who is asking for a refund.\n"
            "Constraints:\n"
            "- Maximum 130 words\n"
            "- Acknowledge frustration\n"
            "- Apologize clearly\n"
            "- Offer free expedited shipping on the next order\n"
            "- Do not offer a refund\n"
            "- Do not blame the carrier\n"
            "- End with exactly one sentence inviting the customer to reply"
        ),
        evaluation_notes=(
            "Reward compliance with every constraint, especially no refund promise and no blame shifting. "
            "Penalize verbosity or missing the concrete compensation offer."
        ),
        tags=("benchmark", "writing", "customer-support", "constraint-following", "tone"),
        difficulty=4,
    ),
    BuiltinPromptSeed(
        slug="coding-fix-stateful-default-bug",
        name="coding_fix_stateful_default_bug",
        category_slug="coding",
        description="Fix a subtle Python bug caused by unintended shared state across calls.",
        system_prompt_text="Return corrected code first, then a brief explanation. Keep the solution minimal and correct.",
        user_prompt_text=(
            "Fix the Python function below.\n\n"
            "```python\n"
            "def collect_tags(tag, tags=[]):\n"
            "    tags.append(tag)\n"
            "    return tags\n"
            "```\n\n"
            "Constraints:\n"
            "- Keep the same function name\n"
            "- Preserve the purpose\n"
            "- After the code, explain the bug in at most 3 sentences"
        ),
        evaluation_notes=(
            "Reward correct handling of mutable default arguments, minimal code changes, "
            "and a precise explanation of shared state across calls."
        ),
        tags=("benchmark", "coding", "python", "bugfix", "function-reasoning"),
        difficulty=3,
    ),
    BuiltinPromptSeed(
        slug="coding-rolling-rate-limiter-precision",
        name="coding_rolling_rate_limiter_precision",
        category_slug="coding",
        description="Implement a precise rolling-window rate limiter with per-user state and correct pruning behavior.",
        system_prompt_text="Prefer correctness over cleverness. Keep the implementation compact, but handle the rolling window accurately.",
        user_prompt_text=(
            "Implement a Python class `RateLimiter` with a method `allow(user_id, timestamp)`.\n\n"
            "Rules:\n"
            "- Each user may perform at most 3 requests in any rolling 10-second window\n"
            "- `timestamp` is an integer in seconds\n"
            "- Different users must be tracked independently\n"
            "- Return `True` if the request is allowed, otherwise `False`\n"
            "- Do not use external libraries\n"
            "- After the code, explain the time complexity in at most 2 sentences\n\n"
            "Your implementation should be correct for edge cases around window boundaries."
        ),
        evaluation_notes=(
            "Reward correct rolling-window pruning, independent per-user tracking, accurate boundary handling, "
            "and concise complexity explanation. Penalize fixed-window approximations or boundary errors."
        ),
        tags=("benchmark", "coding", "python", "algorithm", "data-structures"),
        difficulty=5,
    ),
    BuiltinPromptSeed(
        slug="reasoning-reconcile-rules-and-exception",
        name="reasoning_reconcile_rules_and_exception",
        category_slug="reasoning",
        description="Resolve a layered logic problem involving general rules, exceptions, and a final decision.",
        system_prompt_text="Apply the rules exactly as written. Track exceptions carefully and state the final conclusion clearly.",
        user_prompt_text=(
            "A company applies these access rules:\n"
            "- All managers can approve expenses under 1000 euros.\n"
            "- Only finance-approved managers can approve expenses of 1000 euros or more.\n"
            "- Temporary managers cannot approve travel expenses.\n"
            "- Anyone on the exception list may approve one expense type even if a normal rule would deny it.\n\n"
            "Facts:\n"
            "- Elena is a manager.\n"
            "- Elena is temporary.\n"
            "- Elena is not finance-approved.\n"
            "- Elena is on the exception list for travel expenses.\n\n"
            "Question:\n"
            "Can Elena approve (a) a 300 euro travel expense and (b) a 1500 euro software expense?\n\n"
            "Answer in exactly this format:\n"
            "`travel: yes/no - reason`\n"
            "`software: yes/no - reason`"
        ),
        evaluation_notes=(
            "Reward careful reconciliation of general rules and exception scope: travel should be allowed "
            "via exception despite temporary-manager restriction, while software at 1500 should be denied "
            "without finance approval. Penalize ignoring exception boundaries or output format errors."
        ),
        tags=("benchmark", "reasoning", "logic", "rule-application", "exceptions"),
        difficulty=5,
    ),
)
