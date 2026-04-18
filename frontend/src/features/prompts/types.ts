export type PromptCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
};

export type Prompt = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: PromptCategory;
  system_prompt_text: string | null;
  user_prompt_text: string;
  evaluation_notes: string | null;
  tags: string[];
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type PromptListResponse = {
  items: Prompt[];
  total: number;
};

export type PromptPayload = {
  name: string;
  description: string | null;
  category_id: number;
  system_prompt_text: string | null;
  user_prompt_text: string;
  evaluation_notes: string | null;
  tags: string[];
  is_active: boolean;
};

