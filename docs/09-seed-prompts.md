# Seed Prompts for the First Release

The project should ship with a default library of benchmark prompts covering multiple categories.

## 1. summary_article_short

Category: Summarization

Prompt:

> Summarize the following text in no more than 5 sentences. Keep only the essential ideas and do not invent information.

## 2. extract_contact_json

Category: Structured Output

Prompt:

> From the following text, extract contact information into strict JSON with the keys `full_name`, `email`, `phone`, and `company`. Use `null` if the information is missing.

## 3. classify_support_ticket

Category: Classification

Prompt:

> Classify the following message into exactly one of these categories: `billing`, `technical_issue`, `feature_request`, `account_access`, `other`. Reply with the exact category only.

## 4. rewrite_professional_email

Category: Writing

Prompt:

> Rewrite the following message as a professional, polite, and concise email while keeping the original meaning.

## 5. explain_rag_simple

Category: General QA

Prompt:

> Explain what a RAG system is to someone who is new to AI. Include one concrete example.

## 6. translate_fr_to_en_business

Category: Translation

Prompt:

> Translate the following text from French to English using a natural and professional tone.

## 7. compare_sql_nosql

Category: Reasoning

Prompt:

> Compare SQL and NoSQL databases for a SaaS application. Give the advantages, disadvantages, and one suitable use case for each.

## 8. generate_task_json

Category: Structured Output

Prompt:

> Transform the following user request into strict JSON with the keys `task_title`, `priority`, `deadline`, `owner`, and `tags`. Return only the JSON.

## 9. python_two_sum

Category: Coding

Prompt:

> Write a Python function `two_sum(nums, target)` that returns the indices of two numbers whose sum equals `target`. Provide an efficient solution.

## 10. python_group_anagrams

Category: Coding

Prompt:

> Write a Python function that groups words by anagrams. Example input: `["eat", "tea", "tan", "ate", "nat", "bat"]`. Briefly explain the logic and time complexity.

## 11. python_lru_cache_design

Category: Coding

Prompt:

> Implement a Python class `LRUCache` with methods `get(key)` and `put(key, value)` while guaranteeing average O(1) complexity. Explain the chosen approach and the data structures used.
