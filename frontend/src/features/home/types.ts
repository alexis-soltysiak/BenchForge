import type { FileText } from "lucide-react";

export type HomePageProps = {
  onNavigateToPrompts: () => void;
  onNavigateToModels: () => void;
  onNavigateToSessions: () => void;
  onNavigateToRuns: () => void;
  onNavigateToCredits: () => void;
};

export type QuickLink = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof FileText;
  onClick: () => void;
  tone: "amber" | "sky" | "emerald" | "rose";
};
