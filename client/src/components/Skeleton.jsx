export function Skeleton({ className = '', style }) {
  return <span className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function Spinner({ size = 16, className = '' }) {
  return <span className={`spinner ${className}`.trim()} style={{ width: size, height: size }} aria-hidden="true" />;
}

export function StatCardsSkeleton() {
  return (
    <div className="stat-grid" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="stat-card">
          <Skeleton className="sk-circle" />
          <div className="sk-lines">
            <Skeleton className="sk-line w60" />
            <Skeleton className="sk-line w40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectCardsSkeleton({ count = 6 }) {
  return (
    <div className="project-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="project-card sk-card">
          <div className="sk-row">
            <Skeleton className="sk-square" />
            <div className="sk-lines">
              <Skeleton className="sk-line w70" />
              <Skeleton className="sk-line w40" />
            </div>
          </div>
          <Skeleton className="sk-line w100" />
          <Skeleton className="sk-line w80" />
          <Skeleton className="sk-bar" />
          <div className="sk-row sk-between">
            <Skeleton className="sk-line w30" />
            <Skeleton className="sk-circle sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dash-skeleton" aria-hidden="true">
      <StatCardsSkeleton />
      <div className="dash-toolbar">
        <Skeleton className="sk-search" />
        <Skeleton className="sk-select" />
      </div>
      <ProjectCardsSkeleton />
    </div>
  );
}

export function ProjectPageSkeleton() {
  return (
    <div className="project-skeleton" aria-hidden="true">
      <Skeleton className="sk-line w30" />
      <div className="sk-hero">
        <Skeleton className="sk-circle lg" />
        <div className="sk-lines">
          <Skeleton className="sk-line w50" />
          <Skeleton className="sk-line w80" />
        </div>
      </div>
      <div className="sk-tabs">
        <Skeleton className="sk-tab" />
        <Skeleton className="sk-tab" />
        <Skeleton className="sk-tab" />
      </div>
      <div className="sk-list">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="sk-list-row" />
        ))}
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="kanban" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, col) => (
        <div key={col} className="kanban-col">
          <div className="kanban-col-head">
            <Skeleton className="sk-line w40" />
          </div>
          <div className="kanban-col-body">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="task-card sk-card">
                <Skeleton className="sk-line w30" />
                <Skeleton className="sk-line w90" />
                <Skeleton className="sk-line w70" />
                <div className="sk-row sk-between">
                  <Skeleton className="sk-line w30" />
                  <Skeleton className="sk-circle sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskModalSkeleton() {
  return (
    <div className="task-modal-skeleton" aria-hidden="true">
      <Skeleton className="sk-line w60 lg" />
      <div className="task-modal-grid">
        <div className="sk-lines">
          <Skeleton className="sk-line w30" />
          <Skeleton className="sk-block" />
          <Skeleton className="sk-line w40" />
          <Skeleton className="sk-block sm" />
          <Skeleton className="sk-line w30" />
          <Skeleton className="sk-block" />
        </div>
        <div className="sk-lines">
          <Skeleton className="sk-line w50" />
          <Skeleton className="sk-pill" />
          <Skeleton className="sk-pill" />
          <Skeleton className="sk-line w40" />
          <Skeleton className="sk-pill" />
        </div>
      </div>
    </div>
  );
}
