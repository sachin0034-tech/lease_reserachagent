import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AuthLanding.css';

const LogoIcon = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="auth-landing__logo-icon"
  >
    <path d="M8 8h6v6H8V8zm10 0h6v6h-6V8zM8 18h6v6H8v-6zm10 0h6v6h-6v-6z" fill="url(#logo-grad)" />
    <path
      d="M14 8v6h4V8h-4zm0 10v6h4v-6h-4zM8 14h6v4H8v-4zm10 0h6v4h-6v-4z"
      fill="url(#logo-grad2)"
      opacity="0.8"
    />
    <defs>
      <linearGradient id="logo-grad" x1="8" y1="8" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#5B4FFF" />
        <stop offset="1" stopColor="#8B7CFE" />
      </linearGradient>
      <linearGradient id="logo-grad2" x1="8" y1="14" x2="24" y2="18" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7C6FFF" />
        <stop offset="1" stopColor="#A89BFE" />
      </linearGradient>
    </defs>
  </svg>
);

export default function AuthLanding() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  // Redirect to form if already logged in
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedUsername = window.localStorage.getItem('lg_username');
        if (storedUsername && storedUsername.trim()) {
          navigate('/start', { replace: true });
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [navigate]);

  const showToast = (message) => {
    setToast(message);
    if (typeof window !== 'undefined') {
      window.clearTimeout(showToast._timer);
      showToast._timer = window.setTimeout(() => setToast(null), 3500);
    }
  };

  const handleLoginSubmit = async (e) => {
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
      } catch {
        // ignore storage
      }
      navigate('/start');
    } catch (err) {
      showToast(err.message || 'Could not reach the login service.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestAccess = () => {
  const subject = "Request access - LegalGraph AI Research Agent";

  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=rajat@legalgraph.ai&su=${encodeURIComponent(subject)}`;

  window.open(gmailLink, "_blank");
};

  return (
    <div className="auth-landing">
      <div className="auth-landing__gradient" />
      <div className="auth-landing__glow auth-landing__glow--one" />
      <div className="auth-landing__glow auth-landing__glow--two" />
      <div className="auth-landing__glow auth-landing__glow--three" />

      <header className="auth-landing__header">
        <div className="auth-landing__brand">
          <LogoIcon />
          <span className="auth-landing__brand-name">LegalGraph.AI</span>
        </div>
      </header>

      <main className="auth-landing__content">
        <section className="auth-landing__hero">
          <div className="auth-landing__copy">
            <p className="auth-landing__eyebrow">Lease Research Agent</p>
            <h1 className="auth-landing__title">
              Unlock Fair Market Rent with
              <span className="auth-landing__title-accent"> AI-Powered Negotiation Intelligence</span>
            </h1>
            <p className="auth-landing__subtitle">
              Login to uncover fair market rent and data backed leverage with AI Research agent to strengthen your negotiation
            </p>

            <div className="auth-landing__actions">
              <button
                type="button"
                className="auth-landing__btn auth-landing__btn--ghost"
                onClick={handleRequestAccess}
              >
                Request access
              </button>
            </div>

            {/* <p className="auth-landing__hint">
              No public sign-ups yet.
              <span> Request an invite to onboard your team.</span>
            </p> */}
          </div>

          <div className="auth-landing__card auth-landing__card--login">
            <h2 className="auth-landing__card-title">Log in</h2>
            <p className="auth-landing__card-subtitle">
              
            </p>
            <form className="auth-landing__form" onSubmit={handleLoginSubmit}>
              <div className="auth-landing__field">
                <label htmlFor="landing-username">Username</label>
                <input
                  id="landing-username"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="auth-landing__field">
                <label htmlFor="landing-password">Password</label>
                <input
                  id="landing-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="auth-landing__btn auth-landing__btn--primary auth-landing__btn--full" disabled={submitting}>
                {submitting ? 'Checking access…' : 'Log in'}
              </button>
            </form>
            <p className="auth-landing__card-hint">
              Don&apos;t have access yet? Use the request access button to contact the team.
            </p>
          </div>
        </section>
      </main>
      {toast && (
        <div className="auth-landing__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

