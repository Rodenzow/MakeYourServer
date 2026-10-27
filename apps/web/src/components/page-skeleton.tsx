/** Squelette affiché instantanément pendant le chargement d’une page. */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Chargement" className="space-y-6">
      <div className="skeleton h-4 w-32 rounded" />
      <div className="skeleton h-10 w-2/3 max-w-lg rounded-lg" />
      <div className="skeleton h-28 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
