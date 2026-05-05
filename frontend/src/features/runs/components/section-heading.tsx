export function SectionHeading({ description, title }: { description?: string; title: string }) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}
