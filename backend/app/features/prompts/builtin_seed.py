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

    # ── Level 1 — Easy ────────────────────────────────────────────────────────

    BuiltinPromptSeed(
        slug="summarize-team-standup",
        name="summarize-team-standup",
        category_slug="summarization",
        description="Summarize a short daily standup transcript into exactly 3 labeled bullets.",
        system_prompt_text="You are a concise meeting assistant. Follow the output format exactly.",
        user_prompt_text=(
            "Summarize the standup transcript below in exactly 3 bullet points.\n\n"
            "Rules:\n"
            "- Use these labels in this exact order: `Done`, `Doing`, `Blocked`\n"
            "- Each bullet must begin with its label followed by a colon\n"
            "- Each bullet must be a single sentence under 20 words\n"
            "- Do not add any introductory or closing text\n\n"
            "Transcript:\n"
            "Alice: Yesterday I finished the login page redesign and merged it. "
            "Today I'm starting on the password reset flow. No blockers.\n"
            "Bob: I shipped the email notification service yesterday. "
            "Right now I'm reviewing Alice's PR and writing tests. "
            "I'm blocked on the staging credentials — DevOps hasn't responded yet."
        ),
        evaluation_notes=(
            "Reward: exact 3-bullet structure with correct labels in correct order, "
            "each bullet under 20 words, no extra text. "
            "Penalize: wrong order, missing label, merged content, or added commentary."
        ),
        tags=("benchmark", "summarization", "format", "meeting"),
        difficulty=1,
    ),

    BuiltinPromptSeed(
        slug="extract-employee-records-basic",
        name="extract-employee-records-basic",
        category_slug="structured-output",
        description="Extract name, email, and department from 4 plaintext employee records into a JSON array.",
        system_prompt_text="Return valid JSON only. No commentary.",
        user_prompt_text=(
            "Convert the employee records below into a JSON array. "
            "Each object must contain exactly these keys: `full_name`, `email`, `department`.\n\n"
            "Rules:\n"
            "- `full_name` must preserve the original capitalization\n"
            "- `email` must be lowercase\n"
            "- `department` must be title case (e.g. `Sales`, `Human Resources`)\n"
            "- Return JSON only\n\n"
            "Records:\n"
            "1. Alice Martin — engineering — alice.martin@company.com\n"
            "2. BOB CHEN | sales | Bob@company.com\n"
            "3. Clara Diaz (human resources) - CLARA.DIAZ@company.com\n"
            "4. David Kim, Product Management, d.kim@corp.com"
        ),
        evaluation_notes=(
            "Reward: correct 4-object array, full_name preserving original case, "
            "email lowercased, department in title case. "
            "Penalize: wrong casing, missing keys, extra keys, or invalid JSON."
        ),
        tags=("benchmark", "structured-output", "json", "extraction", "normalization"),
        difficulty=1,
    ),

    # ── Level 2 — Moderate ────────────────────────────────────────────────────

    BuiltinPromptSeed(
        slug="reasoning-expense-approval-basic",
        name="reasoning-expense-approval-basic",
        category_slug="reasoning",
        description="Apply 4 clear expense approval rules to 5 requests, each with a single unambiguous outcome.",
        system_prompt_text="Apply the rules exactly as written. Do not infer additional restrictions.",
        user_prompt_text=(
            "A company uses these expense approval rules:\n"
            "1. Any expense under 100 euros requires no approval.\n"
            "2. Expenses from 100 to 500 euros (inclusive) require manager approval.\n"
            "3. Expenses above 500 euros require both manager and finance team approval.\n"
            "4. Travel expenses always require manager approval, regardless of amount.\n\n"
            "Determine who must approve each request. "
            "Answer in exactly this format:\n"
            "`A: [approvers or 'no approval needed'] - reason`\n"
            "`B: [approvers or 'no approval needed'] - reason`\n"
            "`C: [approvers or 'no approval needed'] - reason`\n"
            "`D: [approvers or 'no approval needed'] - reason`\n"
            "`E: [approvers or 'no approval needed'] - reason`\n\n"
            "Requests:\n"
            "A: 75 euro team lunch, not a travel expense\n"
            "B: 350 euro flight booking (travel)\n"
            "C: 800 euro server license\n"
            "D: 40 euro taxi to client site (travel)\n"
            "E: 500 euro conference ticket, not a travel expense"
        ),
        evaluation_notes=(
            "A: no approval needed (< 100, not travel). "
            "B: manager only (travel rule applies regardless of amount). "
            "C: manager + finance (> 500). "
            "D: manager only (travel, even though < 100). "
            "E: manager only (exactly 500, rule 2 says 'up to 500 inclusive'). "
            "Penalize conflating the travel rule with the amount thresholds."
        ),
        tags=("benchmark", "reasoning", "rules", "approval"),
        difficulty=2,
    ),

    BuiltinPromptSeed(
        slug="extract-product-orders-normalized",
        name="extract-product-orders-normalized",
        category_slug="structured-output",
        description="Convert 5 product orders into a normalized JSON array with status mapping, null handling, and a computed total field.",
        system_prompt_text="Return valid JSON only. Apply every rule exactly. Do not include commentary.",
        user_prompt_text=(
            "Convert the orders below into a JSON array. Each object must contain exactly:\n"
            "`order_id`, `customer`, `sku`, `quantity`, `unit_price_eur`, `total_eur`, `status`\n\n"
            "Rules:\n"
            "- `order_id` must be a string\n"
            "- `customer` must be lowercase\n"
            "- `sku` must be uppercase\n"
            "- `quantity` must be an integer\n"
            "- `unit_price_eur` must be a float rounded to 2 decimal places\n"
            "- `total_eur` = quantity × unit_price_eur, rounded to 2 decimal places\n"
            "- `status` must be normalized: map `shipped` → `delivered`, `pending` → `open`, "
            "`cancelled` → `cancelled`, any unknown value → `unknown`\n"
            "- If `unit_price_eur` is missing or empty, use null for both `unit_price_eur` and `total_eur`\n"
            "- Return JSON only\n\n"
            "Orders:\n"
            "1. ID=1042, Customer=Alice Dupont, SKU=wdg-003, qty=3, price=12.5 EUR, status=shipped\n"
            "2. ID=1043, Customer=BOB MARTIN, SKU=prd-017, qty=10, price=, status=pending\n"
            "3. ID=1044, Customer=Clara Diaz, SKU=wdg-003, qty=1, price=12.50, status=cancelled\n"
            "4. ID=1045, customer=DAVID KIM, sku=SVC-099, qty=5, price=200 EUR, status=dispatched\n"
            "5. ID=1046, Customer=Eve Blanc, SKU=prd-021, qty=2, price=9.99, status=pending"
        ),
        evaluation_notes=(
            "Reward: correct casing, total_eur computed correctly (1042→37.50, 1044→12.50, 1045→1000.00, 1046→19.98), "
            "null handling for 1043, status normalization (dispatched→unknown, shipped→delivered, pending→open). "
            "Penalize: wrong totals, missing nulls, incorrect status mapping."
        ),
        tags=("benchmark", "structured-output", "json", "normalization", "computation"),
        difficulty=2,
    ),

    # ── Level 3 — Super Hard ──────────────────────────────────────────────────

    BuiltinPromptSeed(
        slug="summarize-policy-with-exception-hierarchy",
        name="summarize-policy-with-exception-hierarchy",
        category_slug="summarization",
        description="Summarize a multi-tier access policy with nested role-scoped exceptions, counter-exceptions, temporal conditions, and differentiated consequence tracks.",
        system_prompt_text=(
            "You are a compliance-focused summarizer. Preserve the exact scope of every exception and counter-exception. "
            "Do not merge distinct consequence tracks. Do not infer conditions that are not explicitly stated."
        ),
        user_prompt_text=(
            "Summarize the policy below in exactly 7 bullets using these labels in this exact order:\n"
            "`Scope`\n"
            "`Default prohibitions`\n"
            "`Role exception`\n"
            "`Counter-exception`\n"
            "`Mandatory disclosure`\n"
            "`Consequence track A`\n"
            "`Consequence track B`\n\n"
            "Rules for your summary:\n"
            "- Each bullet must begin with its label followed by a colon\n"
            "- Do not merge `Consequence track A` and `Consequence track B` into one bullet\n"
            "- The `Role exception` bullet must name the eligible role and both conditions that must be simultaneously true\n"
            "- The `Counter-exception` bullet must state who it applies to and the single condition that re-activates the prohibition\n"
            "- Do not quote the source text. Do not add examples. Do not exceed one sentence per bullet.\n\n"
            "Policy:\n"
            "This policy governs all personnel with elevated system privileges, including full-time engineers, "
            "on-call contractors, and third-party auditors operating under a signed data-processing agreement. "
            "By default, no covered person may access production databases directly, export raw customer records, "
            "or modify infrastructure configuration outside a change-management ticket. "
            "Senior engineers who hold an active security clearance and whose team lead has filed a standing access "
            "request for the current quarter may perform direct production reads for incident diagnosis. "
            "However, this exception does not apply to senior engineers who are currently under a disciplinary review, "
            "even if all other conditions are met. "
            "Any access that results in the export of more than 500 customer records — whether intentional or incidental — "
            "must be disclosed to the Data Protection Officer within 4 business hours and logged in the incident register. "
            "Personnel who violate the default prohibitions through negligence face mandatory retraining and a 30-day "
            "privilege suspension; a second negligent violation within 12 months triggers automatic escalation to HR. "
            "Personnel who commit intentional or concealed violations face immediate privilege revocation, contract "
            "termination, and referral to relevant regulatory authorities without prior warning."
        ),
        evaluation_notes=(
            "Reward: correct 7-bullet structure in exact label order; Scope covering all three personnel categories; "
            "Default prohibitions listing all three; Role exception naming senior engineers with both conditions (clearance + standing request); "
            "Counter-exception scoped to disciplinary review only; Mandatory disclosure with 500-record threshold and 4-hour window; "
            "Consequence track A for negligence (retraining + suspension + 12-month escalation trigger); "
            "Consequence track B for intentional/concealed (revocation + termination + regulatory referral). "
            "Penalize: merging consequence tracks, omitting the disciplinary-review counter-exception, "
            "dropping the 12-month recidivism condition, or exceeding one sentence per bullet."
        ),
        tags=("benchmark", "summarization", "policy", "compliance", "nested-exceptions", "structured-summary"),
        difficulty=3,
    ),

    BuiltinPromptSeed(
        slug="extract-incident-records-with-rule-collisions",
        name="extract-incident-records-with-rule-collisions",
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
        tags=("benchmark", "structured-output", "json", "logs", "normalization", "rule-conflict"),
        difficulty=3,
    ),

    BuiltinPromptSeed(
        slug="write-customer-response-with-hidden-conflict-constraints",
        name="write-customer-response-with-hidden-conflict-constraints",
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
        tags=("benchmark", "writing", "customer-support", "constraint-following", "tone-control"),
        difficulty=3,
    ),

    # ── Level 4 — Extremely Hard ──────────────────────────────────────────────

    BuiltinPromptSeed(
        slug="transform-contract-clauses-to-strict-json",
        name="transform-contract-clauses-to-strict-json",
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
        difficulty=4,
    ),

    BuiltinPromptSeed(
        slug="reasoning-multi-rule-approval-matrix",
        name="reasoning-multi-rule-approval-matrix",
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
        difficulty=4,
    ),

    BuiltinPromptSeed(
        slug="coding-rate-limiter-out-of-order-requests",
        name="coding-rate-limiter-out-of-order-requests",
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
        tags=("benchmark", "coding", "python", "algorithm", "edge-cases", "data-structures"),
        difficulty=4,
    ),

    # ── Level 5 — Impossible ──────────────────────────────────────────────────

    BuiltinPromptSeed(
        slug="reasoning-multi-entity-permission-with-delegation",
        name="reasoning-multi-entity-permission-with-delegation",
        category_slug="reasoning",
        description="Compute effective system access for five principals across roles, individual exceptions, admin grants, emergency suspensions, time-window restrictions, and single-hop delegation chains.",
        system_prompt_text=(
            "Apply rules strictly in precedence order. Delegation transfers only role-based and individual-exception permissions — "
            "never admin grants, suspensions, or time-window restrictions. Do not extend any rule beyond what is explicitly stated."
        ),
        user_prompt_text=(
            "A permission system applies rules in this precedence order (1 = highest):\n"
            "1. Emergency suspension — denies ALL access with no exception.\n"
            "2. Admin grant — grants access to ALL systems.\n"
            "3. Role-based — grants access to the systems listed for that role.\n"
            "4. Individual exception — adds (+) or removes (−) exactly one named system from the role-based set.\n"
            "5. Delegation — the recipient gains the delegator's role+exception permissions as a union with their own; "
            "delegation does NOT transfer admin grants, suspensions, or time-window restrictions.\n"
            "6. Time-window restriction — restricts ALL of a principal's effective permissions (own + delegated) "
            "to the specified hours; outside the window the principal has no access.\n\n"
            "Available systems: code_repo, build_system, staging_db, dev_tools, monitoring, "
            "infra_console, incident_board, data_warehouse, reporting_tool, read_only_db, "
            "contract_db, legal_docs, payroll\n\n"
            "Roles:\n"
            "- DEV: code_repo, build_system, staging_db, dev_tools\n"
            "- OPS: monitoring, infra_console, build_system, incident_board\n"
            "- ANALYST: data_warehouse, reporting_tool, read_only_db\n"
            "- LEGAL: contract_db, legal_docs, reporting_tool\n\n"
            "Principals:\n"
            "- Alice: role=DEV, exception +payroll, exception −build_system, time-window 09:00–18:00\n"
            "- Bob: role=OPS, exception +code_repo, admin grant\n"
            "- Carlos: role=ANALYST, delegation from Alice (no other modifications)\n"
            "- Diana: role=LEGAL, emergency suspension\n"
            "- Eve: role=DEV, delegation from Diana (no other modifications)\n\n"
            "List each principal's accessible systems as a comma-separated set (or `none`). "
            "Answer in exactly this format:\n"
            "`Alice (inside window): [systems]`\n"
            "`Alice (outside window): [systems]`\n"
            "`Bob: [systems]`\n"
            "`Carlos: [systems]`\n"
            "`Diana: [systems]`\n"
            "`Eve: [systems]`"
        ),
        evaluation_notes=(
            "Correct answers:\n"
            "Alice (inside window): code_repo, staging_db, dev_tools, payroll "
            "(DEV base minus build_system plus payroll, within window).\n"
            "Alice (outside window): none (time-window restriction).\n"
            "Bob: all 13 systems (admin grant supersedes role; +code_repo exception is irrelevant but harmless).\n"
            "Carlos: code_repo, staging_db, dev_tools, payroll, data_warehouse, reporting_tool, read_only_db "
            "(ANALYST own + Alice's delegated role+exceptions without time restriction; build_system excluded because "
            "Alice's −build_system exception IS part of the delegated set).\n"
            "Diana: none (emergency suspension).\n"
            "Eve: code_repo, build_system, staging_db, dev_tools, contract_db, legal_docs, reporting_tool "
            "(DEV own + LEGAL delegated from Diana; Diana's suspension is NOT transferred).\n"
            "Key traps: (1) Carlos does NOT inherit Alice's time restriction; (2) Carlos does NOT get build_system "
            "because the removal exception is delegated; (3) Carlos DOES get payroll because the add exception is "
            "delegated; (4) Eve DOES inherit Diana's LEGAL permissions because suspensions are not delegated; "
            "(5) Bob gets payroll via admin grant even though OPS has no payroll access."
        ),
        tags=("benchmark", "reasoning", "permissions", "delegation", "precedence", "access-control"),
        difficulty=5,
    ),

    BuiltinPromptSeed(
        slug="coding-lru-cache-with-explicit-state-invariants",
        name="coding-lru-cache-with-explicit-state-invariants",
        category_slug="coding",
        description="Implement a thread-safe LRU cache with extended semantics including peek, put_if_absent, evict_where, and strict hit/miss tracking.",
        system_prompt_text="Write correct, concise Python. Every semantic rule must hold exactly, including under concurrent access. Do not sacrifice correctness for brevity.",
        user_prompt_text=(
            "Implement a Python class `LRUCache` with the following interface:\n\n"
            "- `LRUCache(capacity)` — raises `ValueError` if capacity < 1\n"
            "- `get(key)` — returns value if present and marks key as most recently used; returns `-1` if absent\n"
            "- `peek(key)` — returns value if present **without** updating recency; returns `-1` if absent\n"
            "- `put(key, value)` — inserts or updates; on update, marks as most recently used without changing size; evicts LRU when over capacity\n"
            "- `put_if_absent(key, value)` — inserts only if key is not present; returns `True` if inserted, `False` if already existed; does **not** update recency on collision\n"
            "- `evict_where(predicate)` — removes all entries where `predicate(key, value)` is `True`; preserves recency order of remaining entries exactly\n"
            "- `.stats` property — returns a dict `{\"hits\": int, \"misses\": int}`; only `get` and `peek` count toward hits/misses\n\n"
            "Additional constraints:\n"
            "- All operations except `evict_where` must be O(1) average time\n"
            "- The entire class must be thread-safe using only `threading.Lock` — no higher-level primitives\n"
            "- Do not use `OrderedDict` or any other stdlib ordered container\n"
            "- A single lock acquisition must be sufficient per operation; do not nest locks\n\n"
            "The following sequence must evaluate correctly:\n"
            "`c = LRUCache(2)`\n"
            "`c.put(1, 'a')` → size 1, LRU order: [1]\n"
            "`c.put(2, 'b')` → size 2, LRU order: [1, 2] (2 is MRU)\n"
            "`c.peek(1)` → `'a'`, LRU order unchanged: [1, 2]\n"
            "`c.put(3, 'c')` → evicts 1 (LRU), LRU order: [2, 3]\n"
            "`c.put_if_absent(2, 'X')` → `False`, value and recency of 2 unchanged\n"
            "`c.get(2)` → `'b'`, LRU order: [3, 2]\n"
            "`c.evict_where(lambda k, v: k == 3)` → removes 3, LRU order: [2]\n"
            "`c.stats` → `{\"hits\": 2, \"misses\": 0}`\n\n"
            "After the code, explain in exactly 3 sentences: (1) how recency order is maintained at O(1), "
            "(2) why `peek` and `put_if_absent` do not corrupt the recency invariant, and (3) how your locking strategy prevents data races without deadlock."
        ),
        evaluation_notes=(
            "Reward: correct doubly-linked-list + hashmap design, peek not updating recency, put_if_absent not updating on collision, "
            "evict_where preserving remaining order, stats counting only get/peek, thread safety with a single non-nested Lock, "
            "no OrderedDict, ValueError on bad capacity, and all sequence steps correct. "
            "Penalize: any recency corruption from peek or put_if_absent, stats counting puts, nested locks, or O(n) operations."
        ),
        tags=("benchmark", "coding", "python", "data-structures", "lru-cache", "concurrency", "invariants"),
        difficulty=5,
    ),

    BuiltinPromptSeed(
        slug="coding-transactional-key-value-store",
        name="coding-transactional-key-value-store",
        category_slug="coding",
        description="Implement a thread-safe transactional key-value store with snapshot isolation, last-writer-wins commit semantics, and point-in-time reads.",
        system_prompt_text=(
            "Write correct, concise Python. Every isolation and ordering invariant must hold exactly under concurrent access. "
            "Do not sacrifice correctness for brevity. Handle all error cases explicitly."
        ),
        user_prompt_text=(
            "Implement a Python class `TxnStore` with the following interface:\n\n"
            "- `begin()` → int: starts a new transaction; returns a unique monotonically increasing transaction ID\n"
            "- `write(txn_id, key, value)` — writes key-value within the transaction, isolated from other open transactions; "
            "raises `KeyError` if txn_id is invalid, already committed, or already rolled back\n"
            "- `read(txn_id, key)` — returns the value visible to this transaction: own writes shadow the committed state; "
            "raises `KeyError` if key not found in own writes OR committed state; "
            "raises `KeyError` if txn_id is invalid\n"
            "- `commit(txn_id)` — makes all writes from this transaction visible to subsequent committed reads; "
            "if another transaction already committed a write to the same key after this transaction began, "
            "this commit still wins (last commit wins); raises `KeyError` if txn_id is invalid\n"
            "- `rollback(txn_id)` — discards all writes; raises `KeyError` if txn_id is invalid\n"
            "- `read_committed(key)` — returns the current committed value; raises `KeyError` if key has no committed value\n"
            "- `snapshot()` → int: captures the current committed state; returns a unique monotonically increasing snapshot ID\n"
            "- `read_snapshot(snapshot_id, key)` — returns the value at snapshot capture time; "
            "raises `KeyError` if snapshot_id is invalid or key had no committed value at that time\n\n"
            "Additional constraints:\n"
            "- All operations must be thread-safe using only `threading.Lock` — no higher-level primitives\n"
            "- A committed or rolled-back transaction must reject further writes/reads with `KeyError`\n"
            "- Snapshots are immutable: subsequent commits must not alter snapshot state\n"
            "- Transaction IDs and snapshot IDs are globally unique integers (separate counters are fine)\n"
            "- Do not use any external libraries\n\n"
            "The following sequence must evaluate correctly:\n"
            "`s = TxnStore()`\n"
            "`t1 = s.begin()`                   # t1 = 1\n"
            "`t2 = s.begin()`                   # t2 = 2\n"
            "`s.write(t1, 'x', 10)`\n"
            "`s.write(t2, 'x', 20)`\n"
            "`s.read(t1, 'x')` → 10             # own write shadows committed state\n"
            "`s.read(t2, 'x')` → 20             # own write, isolated from t1\n"
            "`s.read_committed('x')` → KeyError  # nothing committed yet\n"
            "`s.commit(t1)`                      # x=10 now committed\n"
            "`s.read_committed('x')` → 10\n"
            "`snap = s.snapshot()`               # captures x=10\n"
            "`s.commit(t2)`                      # x=20 (last commit wins)\n"
            "`s.read_committed('x')` → 20\n"
            "`s.read_snapshot(snap, 'x')` → 10  # snapshot is immutable\n"
            "`t3 = s.begin()`\n"
            "`s.write(t3, 'x', 30)`\n"
            "`s.rollback(t3)`\n"
            "`s.read_committed('x')` → 20        # rollback had no effect\n"
            "`s.write(t3, 'x', 99)` → KeyError  # t3 already rolled back\n\n"
            "After the code, explain in exactly 3 sentences: (1) how snapshot immutability is guaranteed after "
            "subsequent commits, (2) how last-writer-wins is implemented without a global write lock held across "
            "the entire commit, and (3) why a rolled-back transaction correctly raises KeyError on further operations."
        ),
        evaluation_notes=(
            "Correct sequence outputs: read(t1,'x')=10, read(t2,'x')=20, read_committed('x') raises KeyError before any commit, "
            "read_committed('x')=10 after t1 commit, read_committed('x')=20 after t2 commit (last wins), "
            "read_snapshot(snap,'x')=10 (snapshot captured before t2 commit), read_committed('x')=20 after t3 rollback, "
            "write(t3,'x',99) raises KeyError. "
            "Reward: proper snapshot copy-on-capture so later commits don't mutate it; correct isolation (t2 read does not see t1's uncommitted write); "
            "rollback removing all trace of t3; thread safety with a single Lock per critical section; "
            "distinct monotonic counters for txn IDs and snapshot IDs. "
            "Penalize: snapshots referencing shared mutable state, incorrect last-writer-wins behavior, "
            "cross-transaction visibility of uncommitted writes, or accepting operations on finalized transactions."
        ),
        tags=("benchmark", "coding", "python", "transactions", "snapshot-isolation", "concurrency", "key-value"),
        difficulty=5,
    ),
)
