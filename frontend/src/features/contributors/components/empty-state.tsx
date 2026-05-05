export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.2rem] border border-dashed border-border bg-[hsl(var(--surface-muted))] px-4 py-6 text-[0.92rem] text-[hsl(var(--foreground-soft))]">
      {text}
    </div>
  );
}
