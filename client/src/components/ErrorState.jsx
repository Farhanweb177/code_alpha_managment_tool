import { AlertTriangle } from './Icons';

export default function ErrorState({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="error-state" role="alert">
      <span className="error-state-icon">
        <AlertTriangle size={22} />
      </span>
      <h3>{title}</h3>
      {message && <p className="muted">{message}</p>}
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
