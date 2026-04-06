export function SkeletonBlock({ className = "" }) {
  return <div className={`skeleton-block ${className}`.trim()} />;
}

export function SkeletonStatCard() {
  return (
    <article className="stat-card">
      <SkeletonBlock className="skeleton-line short" />
      <SkeletonBlock className="skeleton-line medium" />
      <SkeletonBlock className="skeleton-line short" />
    </article>
  );
}

export function SkeletonPanel({ lines = 4 }) {
  return (
    <article className="panel">
      <div className="panel-head">
        <SkeletonBlock className="skeleton-line medium" />
        <SkeletonBlock className="skeleton-line long" />
      </div>
      <div className="skeleton-stack">
        {Array.from({ length: lines }).map((_, index) => (
          <SkeletonBlock key={index} className="skeleton-line" />
        ))}
      </div>
    </article>
  );
}
