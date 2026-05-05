import { Badge } from "@/components/ui/badge";

export function ExecutionTierBadge({ tier }: { tier: number | null }) {
  if (tier === 2) {
    return (
      <Badge className="whitespace-nowrap bg-emerald-100 text-emerald-800 text-[0.7rem]">
        Execution: Pass
      </Badge>
    );
  }
  if (tier === 1) {
    return (
      <Badge className="whitespace-nowrap bg-amber-100 text-amber-800 text-[0.7rem]">
        Execution: Partial
      </Badge>
    );
  }
  if (tier === 0) {
    return (
      <Badge className="whitespace-nowrap bg-rose-100 text-rose-800 text-[0.7rem]">
        Execution: Fail
      </Badge>
    );
  }
  return null;
}
