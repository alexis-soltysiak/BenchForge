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
        slug="summarize-board-notes-with-conflicts",
        name="summarize_board_notes_with_conflicts",
        category_slug="summarization",
        description="Summarize board notes containing confirmed decisions, tentative statements, and unresolved strategic disagreements.",
        system_prompt_text=(
            "You are a precise executive summarizer. Separate confirmed decisions from unresolved matters, "
            "preserve uncertainty, and do not infer missing facts."
        ),
        user_prompt_text=(
            "Summarize the notes below in exactly 4 bullet points.\n\n"
            "Constraints:\n"
            "- The first 2 bullets must be confirmed decisions.\n"
            "- The last 2 bullets must be unresolved issues or risks.\n"
            "- Mention owners only if explicitly named.\n"
            "- Do not quote the notes.\n\n"
            "Notes:\n"
            "- The board agreed to prioritize profitability over user growth for the next two quarters.\n"
            "- The CFO said a hiring freeze is likely, but it was not formally approved.\n"
            "- Maya will deliver a revised operating plan on Thursday.\n"
            "- Expansion into Italy was discussed, but legal flagged tax-registration complexity.\n"
            "- The pricing redesign was approved for Q3.\n"
            "- Some members argued for accelerating enterprise sales hiring, though no decision was reached.\n"
            "- The CEO asked for a downside scenario if churn worsens.\n"
            "- No one challenged delaying the mobile redesign to Q4."
        ),
        evaluation_notes=(
            "Reward exact 4-bullet structure, correct separation of decisions vs unresolved issues, "
            "and careful treatment of tentative items such as the likely-but-unapproved hiring freeze."
        ),
        tags=("benchmark", "summarization", "executive", "ambiguity", "decision-making", "instruction-following"),
        difficulty=3,
    ),
    BuiltinPromptSeed(
        slug="summarize-policy-with-exception-hierarchy",
        name="summarize_policy_with_exception_hierarchy",
        category_slug="summarization",
        description="Summarize a policy that combines prohibitions, obligations, exceptions, and differentiated consequences without flattening its structure.",
        system_prompt_text=(
            "You are a compliance-focused summarizer. Preserve distinctions between prohibitions, obligations, "
            "exceptions, and consequences. Do not simplify away conditional rules."
        ),
        user_prompt_text=(
            "Summarize the policy below in exactly 5 bullets using these labels in this exact order:\n"
            "`Applies to`\n"
            "`Prohibited`\n"
            "`Required reporting`\n"
            "`Exception`\n"
            "`Consequences`\n\n"
            "Do not quote the source. Do not add examples.\n\n"
            "Policy excerpt:\n"
            "This policy applies to all employees, contractors, interns, and temporary staff with access to company "
            "systems or customer data. Sharing credentials, disabling endpoint protection, storing customer data in "
            "unsanctioned personal tools, or bypassing mandatory logging is prohibited. Any accidental violation "
            "involving customer data must be reported to the security team within 24 hours. Temporary password "
            "sharing during a formally declared incident is permitted only if approved by the incident commander "
            "and documented within the same business day. Repeated negligence may lead to temporary access "
            "suspension, while intentional or concealed violations may result in disciplinary action, contract "
            "termination, or legal escalation depending on severity."
        ),
        evaluation_notes=(
            "Reward exact label ordering, preservation of the narrowly-scoped password-sharing exception, "
            "and differentiated consequences for negligence versus intentional or concealed violations."
        ),
        tags=("benchmark", "summarization", "policy", "compliance", "exception-handling", "structured-summary"),
        difficulty=4,
    ),
    BuiltinPromptSeed(
        slug="extract-incident-records-with-rule-collisions",
        name="extract_incident_records_with_rule_collisions",
        category_slug="structured-output",
        description="Convert noisy incident lines into strict JSON while resolving omission, normalization, and masking rules that can conflict.",
        system_prompt_text="Return valid JSON only. Follow the schema and all transformation rules exactly. Do not include commentary.",
        user_prompt_text=(
            "Convert the records below into a JSON array. Each object must contain exactly these keys:\n"
            "`timestamp`, `severity`, `service`, `ticket_id`, `ip_addresses`, `customer_visible`\n\n"
            "Rules:\n"
            "- `timestamp` must be ISO 8601 UTC using `Z`\n"
            "- `severity` must be one of: `info`, `warning`, `error`, `critical`\n"
            "- `service` must be lowercase\n"
            "- `ticket_id` must be a string or null\n"
            "- `ip_addresses` must be an array\n"
            "- `customer_visible` must be a boolean\n"
            "- Omit records with severity `debug`\n"
            "- Omit records with invalid timestamps\n"
            "- Mask private IPs in 10.x.x.x, 172.16.x.x to 172.31.x.x, and 192.168.x.x as `INTERNAL`\n"
            "- If no ticket is present, use null\n"
            "- Preserve IP order\n"
            "- Return JSON only\n\n"
            "Records:\n"
            "1. [2026-04-18 09:14:02 UTC] ERROR Auth ticket=INC-991 visible=yes src=192.168.1.8 proxy=34.201.7.9 msg=\"login timeout\"\n"
            "2. [2026-04-18 09:14:05 UTC] DEBUG Billing ticket=INC-992 visible=no src=10.0.0.4 msg=\"retry\"\n"
            "3. [2026-04-18 09:15:11 UTC] CRITICAL API visible=yes src=52.48.22.1 mirror=172.20.4.5 msg=\"upstream failure\"\n"
            "4. [invalid-ts] WARNING Search ticket=INC-993 visible=yes src=18.204.0.2 msg=\"latency\"\n"
            "5. [2026-04-18 09:16:40 UTC] INFO Worker visible=no msg=\"job completed\""
        ),
        evaluation_notes=(
            "Reward exact omission of debug and invalid timestamp records, correct RFC3339-style UTC timestamps, "
            "correct masking of all private ranges including 172.20.x.x, null ticket handling, and strict schema compliance."
        ),
        tags=("benchmark", "structured-output", "json", "logs", "normalization", "validation", "rule-conflict"),
        difficulty=4,
    ),
    BuiltinPromptSeed(
        slug="transform-contract-clauses-to-strict-json",
        name="transform_contract_clauses_to_strict_json",
        category_slug="structured-output",
        description="Extract structured contract obligations from dense clauses with nested conditions, shared exclusions, and mixed normative language.",
        system_prompt_text="Return valid JSON only. Follow the schema exactly and obey the inclusion and exclusion rules without approximation.",
        user_prompt_text=(
            "Convert the clauses below into a JSON array. Each object must contain exactly these keys:\n"
            "`clause_id`, `owner`, `action`, `deadline_days`, `applies_if`, `excluded_if`\n\n"
            "Rules:\n"
            "- `owner` must be one of: `vendor`, `client`, `both`\n"
            "- `deadline_days` must be an integer or null\n"
            "- `applies_if` and `excluded_if` must be strings or null\n"
            "- Include only clauses that create an affirmative obligation\n"
            "- Exclude clauses that are purely definitional, purely permissive, or state only a consequence without an action\n"
            "- If a clause contains both an obligation and an exception, keep both in the same object\n"
            "- If a clause contains a temporal or triggering condition, put it in `applies_if` rather than `action`\n"
            "- Keep exceptions and blockers in `excluded_if`, even if they appear after the main obligation\n"
            "- Return JSON only\n\n"
            "Clauses:\n"
            "1. C1: The Vendor shall notify the Client of any security incident within 3 days of confirmation unless law enforcement prohibits disclosure.\n"
            "2. C2: For the purposes of this Agreement, \"Confidential Information\" includes customer lists and pricing annexes.\n"
            "3. C3: The Client may request an audit once per calendar year.\n"
            "4. C4: Each party shall maintain commercially reasonable backups during the Term.\n"
            "5. C5: If the Vendor fails to meet the service levels for 3 consecutive months, service credits will apply.\n"
            "6. C6: The Client must provide relevant access credentials within 5 days after written onboarding notice, except where prohibited by internal policy.\n"
            "7. C7: Either party may terminate the Agreement for convenience with 30 days' notice.\n"
            "8. C8: During any approved disaster-recovery test, the Vendor must restore the staging environment within 2 days unless the Client has not delivered the required seed data.\n"
            "9. C9: The Vendor may archive support logs after 90 days.\n"
            "10. C10: Upon written request by the Client, each party shall designate a security contact within 7 days, except while a merger-related confidentiality hold is active."
        ),
        evaluation_notes=(
            "Reward inclusion of C1, C4, C6, C8, and C10 only; correct owner normalization; proper extraction of deadlines, "
            "trigger conditions, and exceptions; and exclusion of definitional, permissive, and consequence-only clauses."
        ),
        tags=("benchmark", "structured-output", "json", "legal", "information-extraction", "schema-discipline"),
        difficulty=5,
    ),
    BuiltinPromptSeed(
        slug="reasoning-multi-rule-approval-matrix",
        name="reasoning_multi_rule_approval_matrix",
        category_slug="reasoning",
        description="Evaluate several approval decisions under overlapping rules, scoped exceptions, precedence, and narrow carve-outs.",
        system_prompt_text="Apply the rules exactly as written. Respect precedence and scope. Do not extend exceptions beyond what is explicitly stated.",
        user_prompt_text=(
            "A company applies these approval rules:\n"
            "1. No one may approve their own request.\n"
            "2. Finance-approved managers may approve any expense up to 5000 euros.\n"
            "3. Managers who are not finance-approved may approve non-travel expenses below 1000 euros.\n"
            "4. Temporary managers may not approve travel expenses.\n"
            "5. A person on the exception list for a specific expense type may approve that type below 1000 euros unless blocked by a higher-priority rule.\n"
            "6. However, the temporary-manager travel restriction in rule 4 does not apply to exception-list approvals below 500 euros.\n\n"
            "Facts:\n"
            "- Elena is a manager.\n"
            "- Elena is not finance-approved.\n"
            "- Elena is temporary.\n"
            "- Elena is on the exception list for travel.\n"
            "- Request A is a 300 euro travel expense submitted by Marco.\n"
            "- Request B is a 700 euro software expense submitted by Priya.\n"
            "- Request C is a 700 euro travel expense submitted by Elena.\n"
            "- Request D is a 1200 euro travel expense submitted by Omar.\n"
            "- Request E is a 450 euro travel expense submitted by Omar.\n\n"
            "Answer in exactly this format:\n"
            "`A: yes/no - reason`\n"
            "`B: yes/no - reason`\n"
            "`C: yes/no - reason`\n"
            "`D: yes/no - reason`\n"
            "`E: yes/no - reason`"
        ),
        evaluation_notes=(
            "Reward exact precedence and scope handling: A yes because rule 6 creates a narrow carve-out, B yes via rule 3, "
            "C no due to self-approval, D no because the exception does not extend above 1000, and E yes via the same carve-out. "
            "Penalize treating rule 5 as broader than written."
        ),
        tags=("benchmark", "reasoning", "logic", "rule-application", "precedence", "exceptions"),
        difficulty=5,
    ),
    BuiltinPromptSeed(
        slug="reasoning-policy-precedence-nested-exceptions",
        name="reasoning_policy_precedence_nested_exceptions",
        category_slug="reasoning",
        description="Resolve access decisions under a policy stack with precedence, nested exceptions, interacting roles, and one narrow override.",
        system_prompt_text="Apply the rules in precedence order. A lower rule cannot override a higher one unless the text explicitly says so.",
        user_prompt_text=(
            "Access rules are applied in this order from highest precedence to lowest:\n"
            "1. A direct suspension always denies access.\n"
            "2. Admins can access all systems except payroll while under audit.\n"
            "3. Managers can access finance_reports only if they completed compliance training.\n"
            "4. Contractors cannot access payroll.\n"
            "5. Anyone on an exception list may access exactly one named system unless blocked by a higher-precedence rule.\n"
            "6. Employees may access internal_tools by default.\n"
            "7. A payroll-specific executive waiver overrides rule 2 only, but does not override rule 1.\n\n"
            "Facts:\n"
            "- Nora is an employee, a manager, and an admin.\n"
            "- Nora is under audit.\n"
            "- Nora completed compliance training.\n"
            "- Nora is on the exception list for payroll.\n"
            "- Nora has a payroll-specific executive waiver.\n"
            "- Nora is not suspended.\n\n"
            "Question: Can Nora access each system?\n\n"
            "Answer in exactly this format:\n"
            "`payroll: yes/no - reason`\n"
            "`finance_reports: yes/no - reason`\n"
            "`internal_tools: yes/no - reason`"
        ),
        evaluation_notes=(
            "Reward correct precedence handling: payroll allowed because rule 7 explicitly overrides rule 2, "
            "finance_reports allowed, and internal_tools allowed. Penalize treating the lower exception list as the reason for payroll access "
            "instead of the explicit waiver."
        ),
        tags=("benchmark", "reasoning", "policy", "precedence", "nested-rules", "logic"),
        difficulty=5,
    ),
    BuiltinPromptSeed(
        slug="rewrite-exec-email-with-selective-preservation",
        name="rewrite_exec_email_with_selective_preservation",
        category_slug="writing",
        description="Rewrite a messy internal escalation into an executive-ready email while preserving only actionable facts and omitting noise.",
        system_prompt_text="Write for a senior business stakeholder. Be calm, concise, and action-oriented. Preserve facts but remove emotional noise and unsupported blame.",
        user_prompt_text=(
            "Rewrite the message below as a professional email to an executive sponsor.\n\n"
            "Constraints:\n"
            "- Maximum 120 words\n"
            "- Include exactly 3 short paragraphs\n"
            "- Preserve the concrete blockers\n"
            "- Preserve the schedule risk\n"
            "- Include one explicit ask for intervention\n"
            "- Do not mention frustration, blame, or internal politics\n"
            "- Do not use bullet points\n\n"
            "Original message:\n"
            "\"Quick heads-up, we're still blocked by procurement and it's dragging everything. The vendor docs are "
            "half-ready, legal has comments, security still hasn't signed off, and now the pilot date is looking "
            "shaky for the end of month. Honestly every team says it's someone else's problem and we're going in "
            "circles. Can you please step in because this will slip unless one owner is assigned right away.\""
        ),
        evaluation_notes=(
            "Reward exact structural compliance, preservation of real blockers and timeline risk, "
            "and a clean executive tone without emotional language or blame."
        ),
        tags=("benchmark", "writing", "email", "business", "constraint-following", "style-control"),
        difficulty=3,
    ),
    BuiltinPromptSeed(
        slug="write-customer-response-with-hidden-conflict-constraints",
        name="write_customer_response_with_hidden_conflict_constraints",
        category_slug="writing",
        description="Draft a customer reply that must satisfy multiple tightly constrained commercial, structural, and lexical requirements simultaneously.",
        system_prompt_text="Write with empathy and professionalism. Respect every explicit constraint exactly, especially the ones that conflict in subtle ways.",
        user_prompt_text=(
            "Write a reply to a customer whose order arrived 5 days late and who is asking for a full refund.\n\n"
            "Constraints:\n"
            "- Between 95 and 105 words inclusive\n"
            "- Exactly 2 paragraphs\n"
            "- Acknowledge frustration\n"
            "- Apologize clearly\n"
            "- Offer a 15% discount on the next order\n"
            "- Do not offer a refund\n"
            "- Do not blame the shipping carrier\n"
            "- Do not use the words `policy`, `refund denied`, `unfortunately`, `cannot`, or `won't`\n"
            "- Include exactly one sentence that begins with `As a gesture of goodwill,`\n"
            "- The second paragraph must contain exactly 2 sentences\n"
            "- The final sentence must invite the customer to reply directly"
        ),
        evaluation_notes=(
            "Reward strict compliance with length, paragraph structure, forbidden phrase constraints, and the required goodwill sentence "
            "while still sounding natural and empathetic. Penalize accidental carrier blame, blunt refusal language, or implicit refund promises."
        ),
        tags=("benchmark", "writing", "customer-support", "constraint-following", "tone-control", "precision"),
        difficulty=5,
    ),
    BuiltinPromptSeed(
        slug="coding-rate-limiter-out-of-order-requests",
        name="coding_rate_limiter_out_of_order_requests",
        category_slug="coding",
        description="Implement a per-user rolling-window rate limiter that remains correct when events arrive out of chronological order and duplicate timestamps appear.",
        system_prompt_text="Prefer correctness over cleverness. Handle edge cases explicitly. Do not silently assume monotonic timestamps.",
        user_prompt_text=(
            "Implement a Python class `RateLimiter` with a method `allow(user_id, timestamp)`.\n\n"
            "Rules:\n"
            "- Each user may perform at most 3 requests in any rolling 10-second window\n"
            "- `timestamp` is an integer in seconds\n"
            "- Requests for the same user are not guaranteed to arrive in chronological order\n"
            "- Multiple requests may share the exact same timestamp and must still be counted separately\n"
            "- Different users must be tracked independently\n"
            "- Return `True` if the request is allowed, otherwise `False`\n"
            "- Do not use external libraries\n"
            "- Do not mutate stored history in a way that would make a later out-of-order decision lose needed prior events\n"
            "- After the code, explain in at most 4 sentences how your design handles out-of-order timestamps and duplicate timestamps\n\n"
            "Your implementation should be correct on window-boundary cases and should not rely on queue-only pruning assumptions.\n\n"
            "The following sequence must evaluate correctly for the same user:\n"
            "`allow(u, 100) -> True`\n"
            "`allow(u, 101) -> True`\n"
            "`allow(u, 102) -> True`\n"
            "`allow(u, 102) -> False`\n"
            "`allow(u, 200) -> True`\n"
            "`allow(u, 103) -> False`"
        ),
        evaluation_notes=(
            "Reward designs that explicitly support out-of-order timestamps and duplicate timestamps instead of standard append-only queue logic. "
            "Penalize implementations that destructively prune history, collapse duplicates, or are only correct for monotonic event streams."
        ),
        tags=("benchmark", "coding", "python", "algorithm", "edge-cases", "data-structures", "robustness"),
        difficulty=5,
    ),
    BuiltinPromptSeed(
        slug="coding-lru-cache-with-explicit-state-invariants",
        name="coding_lru_cache_with_explicit_state_invariants",
        category_slug="coding",
        description="Implement an LRU cache with strict behavioral guarantees and edge-case-sensitive update semantics.",
        system_prompt_text="Write correct, concise Python. Prefer invariant-preserving logic over shortcuts. The behavior must exactly match the requested semantics.",
        user_prompt_text=(
            "Implement a Python class `LRUCache` with methods `get(key)` and `put(key, value)`.\n\n"
            "Required semantics:\n"
            "- Constructor: `LRUCache(capacity)` where capacity is a positive integer\n"
            "- `get(key)` returns the value if present, otherwise `-1`\n"
            "- `put(key, value)` inserts or updates the key\n"
            "- Both `get` and `put` must mark the key as most recently used if the key exists after the operation\n"
            "- When capacity is exceeded, evict exactly one least recently used key\n"
            "- Updating an existing key must not change the number of stored keys\n"
            "- Average time complexity must be O(1)\n"
            "- Do not use `OrderedDict`\n"
            "- If capacity is less than 1, raise `ValueError`\n"
            "- After the code, explain in at most 4 sentences why the operations are O(1)\n\n"
            "Be careful with edge cases around updates, repeated gets, eviction order, and invalid capacity."
        ),
        evaluation_notes=(
            "Reward correct hashmap + linked-structure design, exact recency semantics on both get and update, "
            "correct eviction, explicit invalid-capacity handling, and no accidental size growth on update. "
            "Penalize superficially correct but invariant-breaking solutions."
        ),
        tags=("benchmark", "coding", "python", "data-structures", "lru-cache", "invariants", "algorithm"),
        difficulty=5,
    ),
)
