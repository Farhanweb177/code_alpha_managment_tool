import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import AuthShell from '../components/AuthShell';
import { Spinner } from '../components/Skeleton';
import { Eye, EyeOff, Lock, Mail, User } from '../components/Icons';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start collaborating in seconds.">
      <form className="auth-form" onSubmit={submit}>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <label>
          Username
          <span className="input-with-icon">
            <User size={16} />
            <input name="username" value={form.username} onChange={set('username')} placeholder="jane_doe" autoComplete="username" required autoFocus />
          </span>
        </label>

        <label>
          Display name
          <span className="input-with-icon">
            <User size={16} />
            <input name="displayName" value={form.displayName} onChange={set('displayName')} placeholder="Jane Doe" autoComplete="name" />
          </span>
        </label>

        <label>
          Email
          <span className="input-with-icon">
            <Mail size={16} />
            <input name="email" type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com" autoComplete="email" required />
          </span>
        </label>

        <label>
          Password
          <span className="input-with-icon">
            <Lock size={16} />
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="At least 6 characters"
              autoComplete="new-password"
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

        <button
          className="btn primary auth-submit"
          disabled={busy || !form.username || !form.email || !form.password}
        >
          {busy ? (
            <>
              <Spinner size={15} /> Creating…
            </>
          ) : (
            'Create account'
          )}
        </button>

        <p className="muted center auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
