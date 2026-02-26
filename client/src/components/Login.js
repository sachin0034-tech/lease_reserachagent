import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const LogoIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="login__logo-icon"
  >
    <path d="M8 8h6v6H8V8zm10 0h6v6h-6V8zM8 18h6v6H8v-6zm10 0h6v6h-6v-6z" fill="url(#login-logo-grad)" />
    <path
      d="M14 8v6h4V8h-4zm0 10v6h4v-6h-4zM8 14h6v4H8v-4zm10 0h6v4h-6v-4z"
      fill="url(#login-logo-grad2)"
      opacity="0.8"
    />
    <defs>
      <linearGradient id="login-logo-grad" x1="8" y1="8" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#5B4FFF" />
        <stop offset="1" stopColor="#8B7CFE" />
      </linearGradient>
      <linearGradient id="login-logo-grad2" x1="8" y1="14" x2="24" y2="18" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7C6FFF" />
        <stop offset="1" stopColor="#A89BFE" />
      </linearGradient>
    </defs>
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), 3500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      showToast('Please enter both username and password.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail || res.statusText || 'Login failed.';
        showToast(detail);
        return;
      }
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('lg_username', username.trim());
        }
      } catch (_) {
        // ignore storage issues
      }
      navigate('/start');
    } catch (err) {
      showToast(err.message || 'Could not reach the login service.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login__backdrop" />
      <main className="login__content">
        <section className="login__card">
          <header className="login__header">
            <div className="login__brand">
              <LogoIcon />
              <span className="login__brand-name">LegalGraph.AI</span>
            </div>
            <div className="login__headline">
              <h1 className="login__title">Welcome back</h1>
              <p className="login__subtitle">Log in to run lease research and view dashboards.</p>
            </div>
          </header>

          <form className="login__form" onSubmit={handleSubmit}>
            <div className="login__field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="login__field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="login__submit" disabled={submitting}>
              {submitting ? 'Checking access…' : 'Log in'}
            </button>
          </form>
        </section>
      </main>
      {toast && (
        <div className="login__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

