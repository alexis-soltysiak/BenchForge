import { Cable, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ModelProfile } from "../types";

export function RuntimeBadge({ runtimeType }: { runtimeType: ModelProfile["runtime_type"] }) {
  return (
    <Badge variant={runtimeType === "remote" ? "accent" : "neutral"}>
      {runtimeType === "remote" ? (
        <Cable className="mr-1.5 h-3 w-3" />
      ) : (
        <HardDrive className="mr-1.5 h-3 w-3" />
      )}
      {runtimeType}
    </Badge>
  );
}
