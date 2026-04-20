export type SessionPromptItem = {
  id: number;
  prompt_id: number;
  prompt_name: string;
  display_order: number;
};

export type SessionModelItem = {
  id: number;
  model_profile_id: number;
  display_name: string;
  role: string;
  runtime_type: string;
  provider_type: string;
  display_order: number;
};

export type Session = {
  id: number;
  name: string;
  description: string | null;
  status: "draft" | "ready" | "archived";
  max_candidates: number;
  rubric_version: string;
  prompts: SessionPromptItem[];
  candidates: SessionModelItem[];
  judges: SessionModelItem[];
  created_at: string;
  updated_at: string;
};

export type SessionListResponse = {
  items: Session[];
  total: number;
};

export type SessionPayload = {
  name: string;
  description: string | null;
  status: "draft" | "ready" | "archived";
  max_candidates?: number;
  rubric_version: string;
};
