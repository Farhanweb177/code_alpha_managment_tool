export default function EmptyState({ icon, title, description, action, compact = false }) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`.trim()}>
      {icon && <span className="empty-state-icon">{icon}</span>}
      <h3>{title}</h3>
      {description && <p className="muted">{description}</p>}
      {action}
    </div>
  );
}
