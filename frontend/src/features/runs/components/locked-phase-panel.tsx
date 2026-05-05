export function LockedPhasePanel({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-950">{title}</p>
      <p className="mt-2 text-sm text-amber-900">{description}</p>
    </div>
  );
}
