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
)
