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


BUILTIN_PROMPT_SEEDS: tuple[BuiltinPromptSeed, ...] = (
    BuiltinPromptSeed(
        slug="summary-article-short",
        name="summary_article_short",
        category_slug="summarization",
        description=(
            "Summarize input content in five sentences or fewer "
            "without inventing facts."
        ),
        user_prompt_text=(
            "Summarize the following text in no more than 5 sentences. "
            "Keep only the essential ideas and do not invent information."
        ),
        evaluation_notes=(
            "Reward concise factual compression and penalize invented details."
        ),
        tags=("builtin", "mvp", "summarization"),
    ),
    BuiltinPromptSeed(
        slug="extract-contact-json",
        name="extract_contact_json",
        category_slug="structured-output",
        description="Extract contact information into a strict JSON object.",
        user_prompt_text=(
            "From the following text, extract contact information into strict JSON "
            "with the keys `full_name`, `email`, `phone`, and `company`. "
            "Use `null` if the information is missing."
        ),
        evaluation_notes=(
            "Reward schema compliance and null handling when fields are absent."
        ),
        tags=("builtin", "mvp", "structured-output", "json"),
    ),
    BuiltinPromptSeed(
        slug="classify-support-ticket",
        name="classify_support_ticket",
        category_slug="classification",
        description="Classify a support request into one fixed support taxonomy label.",
        user_prompt_text=(
            "Classify the following message into exactly one of these categories: "
            "`billing`, `technical_issue`, `feature_request`, `account_access`, "
            "`other`. Reply with the exact category only."
        ),
        evaluation_notes=(
            "Penalize explanations or labels outside the allowed taxonomy."
        ),
        tags=("builtin", "mvp", "classification", "support"),
    ),
    BuiltinPromptSeed(
        slug="rewrite-professional-email",
        name="rewrite_professional_email",
        category_slug="writing",
        description="Rewrite informal text into a concise professional email.",
        user_prompt_text=(
            "Rewrite the following message as a professional, polite, and concise "
            "email while keeping the original meaning."
        ),
        evaluation_notes="Reward tone, clarity, and meaning preservation.",
        tags=("builtin", "mvp", "writing", "rewrite"),
    ),
    BuiltinPromptSeed(
        slug="explain-rag-simple",
        name="explain_rag_simple",
        category_slug="general-qa",
        description=(
            "Explain retrieval-augmented generation in beginner-friendly terms."
        ),
        user_prompt_text=(
            "Explain what a RAG system is to someone who is new to AI. "
            "Include one concrete example."
        ),
        evaluation_notes=(
            "Reward accessible explanations with a correct concrete example."
        ),
        tags=("builtin", "mvp", "general-qa", "rag"),
    ),
    BuiltinPromptSeed(
        slug="translate-fr-to-en-business",
        name="translate_fr_to_en_business",
        category_slug="translation",
        description="Translate business French into natural professional English.",
        user_prompt_text=(
            "Translate the following text from French to English using a natural "
            "and professional tone."
        ),
        evaluation_notes=(
            "Reward faithfulness, fluent English, and professional register."
        ),
        tags=("builtin", "mvp", "translation", "business"),
    ),
    BuiltinPromptSeed(
        slug="compare-sql-nosql",
        name="compare_sql_nosql",
        category_slug="reasoning",
        description="Compare SQL and NoSQL tradeoffs for a SaaS application.",
        user_prompt_text=(
            "Compare SQL and NoSQL databases for a SaaS application. "
            "Give the advantages, disadvantages, and one suitable use case for each."
        ),
        evaluation_notes=(
            "Reward balanced tradeoffs, concrete use cases, and clear structure."
        ),
        tags=("builtin", "mvp", "reasoning", "databases"),
    ),
    BuiltinPromptSeed(
        slug="generate-task-json",
        name="generate_task_json",
        category_slug="structured-output",
        description="Convert a request into a strict task JSON object.",
        user_prompt_text=(
            "Transform the following user request into strict JSON with the keys "
            "`task_title`, `priority`, `deadline`, `owner`, and `tags`. "
            "Return only the JSON."
        ),
        evaluation_notes="Reward strict JSON and sensible extraction of task fields.",
        tags=("builtin", "mvp", "structured-output", "json"),
    ),
    BuiltinPromptSeed(
        slug="python-two-sum",
        name="python_two_sum",
        category_slug="coding",
        description="Implement an efficient Python solution for the two-sum problem.",
        user_prompt_text=(
            "Write a Python function `two_sum(nums, target)` that returns the indices "
            "of two numbers whose sum equals `target`. Provide an efficient solution."
        ),
        evaluation_notes="Reward correct O(n) hashmap-based implementations.",
        tags=("builtin", "mvp", "coding", "python"),
    ),
    BuiltinPromptSeed(
        slug="python-group-anagrams",
        name="python_group_anagrams",
        category_slug="coding",
        description="Group words by anagram buckets and explain the complexity.",
        user_prompt_text=(
            "Write a Python function that groups words by anagrams. "
            'Example input: `["eat", "tea", "tan", "ate", "nat", "bat"]`. '
            "Briefly explain the logic and time complexity."
        ),
        evaluation_notes=(
            "Reward correct grouping and a coherent complexity explanation."
        ),
        tags=("builtin", "mvp", "coding", "python"),
    ),
    BuiltinPromptSeed(
        slug="python-lru-cache-design",
        name="python_lru_cache_design",
        category_slug="coding",
        description="Design an O(1) average-time LRU cache in Python.",
        user_prompt_text=(
            "Implement a Python class `LRUCache` with methods `get(key)` and "
            "`put(key, value)` while guaranteeing average O(1) complexity. "
            "Explain the chosen approach and the data structures used."
        ),
        evaluation_notes=(
            "Reward correct constant-time design using a hashmap plus linked structure."
        ),
        tags=("builtin", "mvp", "coding", "python", "design"),
    ),
    BuiltinPromptSeed(
        slug="logic-temporal-paradox",
        name="logic_temporal_paradox",
        category_slug="reasoning",
        description="Solve a complex scheduling puzzle with conflicting temporal constraints.",
        user_prompt_text=(
            "Alice, Bob, and Charlie are scheduling a meeting. Alice is only free "
            "when Bob is busy. Bob is busy every day from 2pm to 4pm. Charlie is "
            "free only on Tuesday before 3pm and Thursday after 1pm. Alice is "
            "busy all day Tuesday. Determine if there is a 30-minute window "
            "where all three can meet. Walk through your reasoning step-by-step."
        ),
        evaluation_notes=(
            "Reward models that identify the impossibility early or correctly "
            "isolate the Thursday window if it exists. Penalize hallucinated free time."
        ),
        tags=("builtin", "advanced", "logic", "reasoning"),
    ),
    BuiltinPromptSeed(
        slug="design-idempotent-payment",
        name="design_idempotent_payment",
        category_slug="coding",
        description="Design a distributed, idempotent payment processing system.",
        user_prompt_text=(
            "Design a system for processing payments that guarantees idempotency "
            "across a distributed environment. Explain how you handle a scenario "
            "where the client loses connection after sending a request but before "
            "receiving a response. Provide a high-level Python pseudo-code implementation "
            "using a Redis-based locking mechanism."
        ),
        evaluation_notes=(
            "Reward mention of idempotency keys, atomic operations, and 'exactly-once' "
            "semantics. Penalize generic answers that ignore network failure edge cases."
        ),
        tags=("builtin", "advanced", "coding", "system-design"),
    ),
    BuiltinPromptSeed(
        slug="critique-fallacious-argument",
        name="critique_fallacious_argument",
        category_slug="reasoning",
        description="Identify and name logical fallacies within a provided persuasive text.",
        user_prompt_text=(
            "Analyze the following argument: 'Our competitors are pushing for "
            "AI regulation because they are scared of our innovation. If we "
            "regulate AI now, we are essentially inviting a digital dark age. "
            "Every major tech leader who supports regulation also has a history "
            "of failed product launches.' Identify at least three logical fallacies "
            "used here and explain why they weaken the argument."
        ),
        evaluation_notes=(
            "Reward correct identification of Ad Hominem, Slippery Slope, and "
            "Straw Man/Motivated Reasoning. Penalize vague 'it sounds biased' answers."
        ),
        tags=("builtin", "advanced", "reasoning", "critical-thinking"),
    ),
    BuiltinPromptSeed(
        slug="transform-messy-logs-json",
        name="transform_messy_logs_json",
        category_slug="structured-output",
        description="Convert unstructured legacy logs into a nested, validated JSON schema.",
        user_prompt_text=(
            "Convert the following raw server logs into a valid JSON array. "
            "Each object must have a `timestamp` in ISO 8601, a `severity` level "
            "mapped to an integer (0-5), and a `metadata` object containing "
            "extracted IP addresses. IMPORTANT: If a log line contains 'DEBUG', "
            "omit it entirely. If an IP is from a private range (192.168.x.x), "
            "mask it as 'INTERNAL'."
        ),
        evaluation_notes=(
            "Reward strict adherence to the masking and omission rules. "
            "Penalize any invalid JSON or missed 'DEBUG' lines."
        ),
        tags=("builtin", "advanced", "structured-output", "json", "regex"),
    ),
)
