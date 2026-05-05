import { Badge } from "@/components/ui/badge";
import type { ModelProfile } from "../types";

export function RoleBadge({ role }: { role: ModelProfile["role"] }) {
  const variant = role === "both" ? "accent" : role === "judge" ? "neutral" : "success";
  return <Badge variant={variant as "accent" | "neutral" | "success"}>{role}</Badge>;
}
