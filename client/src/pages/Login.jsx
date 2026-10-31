import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import AuthShell from '../components/AuthShell';
import { Spinner } from '../components/Skeleton';
import { Eye, EyeOff, Lock, User } from '../components/Icons';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(identifier, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <form className="auth-form" onSubmit={submit}>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <label>
          Username or email
          <span className="input-with-icon">
            <User size={16} />
            <input
              name="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="alice"
              autoComplete="username"
              required
              autoFocus
            />
          </span>
        </label>

        <label>
          Password
          <span className="input-with-icon">
            <Lock size={16} />
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="icon-btn input-action"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        <button className="btn primary auth-submit" disabled={busy || !identifier || !password}>
          {busy ? (
            <>
              <Spinner size={15} /> Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>

        <p className="muted center auth-switch">
          No account? <Link to="/register">Create one</Link>
        </p>

        <div className="demo-note">
          Demo: <code>alice@example.com</code> / <code>alice123</code>
        </div>
      </form>
    </AuthShell>
  );
}
