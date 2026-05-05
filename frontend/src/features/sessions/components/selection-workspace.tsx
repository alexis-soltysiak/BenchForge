import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SelectionWorkspace({
  children,
  filters,
  search,
  title,
  onSearchChange,
}: {
  children: ReactNode;
  filters?: ReactNode;
  search: string;
  title: string;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="border-b border-border/40 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {filters ? <div>{filters}</div> : null}
          <label className="relative block min-w-full lg:min-w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-lg pl-8 text-sm"
              placeholder={t("sessions.selection.searchLibrary", { type: title.toLowerCase() })}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {children}
      </div>
    </div>
  );
}
