import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiArrowRightOnRectangle } from 'react-icons/hi2';
import { SettingsModal } from './Dashboard';
import './LeaseForecasterForm.css';
import './Dashboard.css';

const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-icon">
    <path d="M8 8h6v6H8V8zm10 0h6v6h-6V8zM8 18h6v6H8v-6zm10 0h6v6h-6v-6z" fill="url(#logo-grad)" />
    <path d="M14 8v6h4V8h-4zm0 10v6h4v-6h-4zM8 14h6v4H8v-4zm10 0h6v4h-6v-4z" fill="url(#logo-grad2)" opacity="0.8" />
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

const PersonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
  </svg>
);

const CloudUploadIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="upload-icon">
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
  </svg>
);

const LightningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 2v11h3v9l7-12h-4l4-8z" />
  </svg>
);

const ROLES = [
  { id: 'tenant', label: 'Tenant', icon: PersonIcon },
  { id: 'landlord', label: 'Landlord', icon: BuildingIcon },
];

export default function LeaseForecasterForm() {
  const navigate = useNavigate();
  const [analyzeAs, setAnalyzeAs] = useState('tenant');
  const [propertyName, setPropertyName] = useState('Westfield Centre');
  const [address, setAddress] = useState('1200 Market Street, San Francisco, CA');
  const [leasableArea, setLeasableArea] = useState('2500');
  const [currentBaseRent, setCurrentBaseRent] = useState('42.00');
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'text'
  const [documentText, setDocumentText] = useState('');
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [summaryContext, setSummaryContext] = useState(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [credits, setCredits] = useState(null);
  const [navUsername] = useState(() => {
    try { return (typeof window !== 'undefined' && window.localStorage.getItem('lg_username')) || ''; } catch { return ''; }
  });

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  // Fetch credits for the logged-in user (if any) to show in header
  useEffect(() => {
    let username = '';
    try {
      if (typeof window !== 'undefined') {
        username = window.localStorage.getItem('lg_username') || '';
      }
    } catch {
      username = '';
    }
    if (!username) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/user/credits?username=${encodeURIComponent(username)}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.credits === 'number') {
          setCredits(data.credits);
        }
      } catch {
        // ignore credit fetch errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    setFiles((prev) => [...prev, ...dropped]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    setSummaryContext(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('analyze_as', analyzeAs);
      formData.append('property_name', propertyName);
      formData.append('address', address);
      formData.append('leasable_area', leasableArea);
      formData.append('current_base_rent', currentBaseRent);
      let llmProvider = 'openai';
      try {
        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem('lg_llm_provider');
          if (stored === 'openai' || stored === 'anthropic') llmProvider = stored;
        }
      } catch {
        // ignore storage errors, default stays openai
      }
      formData.append('llm_provider', llmProvider);
      try {
        if (typeof window !== 'undefined') {
          const username = window.localStorage.getItem('lg_username');
          if (username && username.trim()) {
            formData.append('username', username.trim());
          }
        }
      } catch {
        // ignore storage errors
      }
      if (inputMode === 'text' && documentText.trim()) {
        formData.append('document_text', documentText.trim());
      } else if (inputMode === 'file' && files.length > 0) {
        files.forEach((file) => formData.append('files', file));
      }

      const response = await fetch(`${API_BASE}/api/analyze/start`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        let errMessage = response.statusText;
        try {
          const errText = await response.text();
          if (errText) {
            try {
              const errJson = JSON.parse(errText);
              errMessage = errJson.detail ? (Array.isArray(errJson.detail) ? errJson.detail.map((d) => d.msg || JSON.stringify(d)).join(', ') : String(errJson.detail)) : errText;
            } catch (_) {
              errMessage = errText;
            }
          }
        } catch (_) {}
        throw new Error(`Analysis start failed (${response.status}): ${errMessage}`);
      }
      const data = await response.json();
      const sessionId = data.session_id;
      console.debug('[LeaseForecasterForm] analyze/start response', data);
      if (sessionId) {
        console.debug('[LeaseForecasterForm] Navigating to /analyze?session_id=', sessionId);
        // Optimistically decrement credits in the UI if we know they're tracked
        setCredits((prev) => (typeof prev === 'number' ? Math.max(0, prev - 2) : prev));
        navigate(`/analyze?session_id=${encodeURIComponent(sessionId)}`);
      } else {
        setSubmitError('No session_id returned');
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to start analysis.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lease-forecaster">
      <header className="app-header">
        <div className="header-left">
          <LogoIcon />
          <span className="app-name">LegalGraph.AI</span>
        </div>
        <div className="header-right">
          {typeof credits === 'number' && (
            <div className="credits-pill" title="Remaining analysis credits">
              <span className="credits-pill__label">Credits</span>
              <div className="credits-pill__bar">
                <div
                  className="credits-pill__fill"
                  style={{ width: `${Math.max(0, Math.min(100, (credits / 20) * 100))}%` }}
                />
              </div>
              <span className="credits-pill__value">
                {credits}
                /20
              </span>
            </div>
          )}
          <button type="button" className="header-btn settings-btn" onClick={() => setSettingsModalOpen(true)} aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
            Settings
          </button>
          <div className="user-info">
            <div className="user-text">
              <span className="user-name">{navUsername || 'LegalGraph User'}</span>
              <span className="user-role">Admin</span>
            </div>
            <div className="user-avatar" aria-hidden>
              {navUsername ? navUsername.slice(0, 2).toUpperCase() : 'LG'}
            </div>
            <button
              type="button"
              className="dashboard-navbar__logout-btn"
              onClick={() => {
                try { if (typeof window !== 'undefined') { window.localStorage.removeItem('lg_username'); window.localStorage.removeItem('lg_analysis_session_id'); } } catch (_) {}
                navigate('/');
              }}
              aria-label={"Logout " + (navUsername || "user")}
            >
              <span className="dashboard-navbar__logout-btn-icon">
                <HiArrowRightOnRectangle size={20} />
              </span>
              <span className="dashboard-navbar__logout-btn-text">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="form-hero">
          <h1 className="form-title">AI Research Agent for Lease</h1>
          <p className="form-subtitle">Uncover fair market rent and data backed leverage to strengthen your negotiation</p>
        </div>
        <div className="form-card">
          <form onSubmit={handleSubmit} className="forecaster-form">
            <div className="form-section">
              <label className="section-label">Analyze As</label>
              <div className="analyze-as-buttons">
                {ROLES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`analyze-as-btn ${analyzeAs === id ? 'active' : ''}`}
                    onClick={() => setAnalyzeAs(id)}
                  >
                    <Icon />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full">
                <label htmlFor="property-name">Property Name</label>
                <input
                  id="property-name"
                  type="text"
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder="Enter property name"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full">
                <label htmlFor="address">Address</label>
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter address"
                />
              </div>
            </div>

            <div className="form-row two-cols">
              <div className="form-group">
                <label htmlFor="leasable-area">Leasable Area (sq ft)</label>
                <input
                  id="leasable-area"
                  type="text"
                  value={leasableArea}
                  onChange={(e) => setLeasableArea(e.target.value)}
                  placeholder="e.g. 2500"
                />
              </div>
              <div className="form-group">
                <label htmlFor="base-rent">Current Base Rent ($/sf)</label>
                <input
                  id="base-rent"
                  type="text"
                  value={currentBaseRent}
                  onChange={(e) => setCurrentBaseRent(e.target.value)}
                  placeholder="e.g. 42.00"
                />
              </div>
            </div>

            <div className="form-section">
              <label className="section-label">Context for research</label>
              <div className="context-toggle">
                <button
                  type="button"
                  className={`context-toggle__btn ${inputMode === 'file' ? 'context-toggle__btn--active' : ''}`}
                  onClick={() => setInputMode('file')}
                >
                  File Upload
                </button>
                <button
                  type="button"
                  className={`context-toggle__btn ${inputMode === 'text' ? 'context-toggle__btn--active' : ''}`}
                  onClick={() => setInputMode('text')}
                >
                  Text
                </button>
              </div>
              {inputMode === 'file' && (
                <div
                  className={`upload-zone ${dragActive ? 'drag-active' : ''} ${files.length ? 'has-files' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    id="context-docs"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="upload-input"
                  />
                  <label htmlFor="context-docs" className="upload-label">
                    <CloudUploadIcon />
                    <span className="upload-text">Upload Lease or Market Reports</span>
                    <span className="upload-hint">PDF, DOCX (Max 10MB)</span>
                    {files.length > 0 && (
                      <span className="upload-files-count">{files.length} file(s) selected</span>
                    )}
                  </label>
                </div>
              )}
              {inputMode === 'text' && (
                <textarea
                  className="context-textarea"
                  placeholder="Paste or type lease terms, market notes, or other context for the research agent…"
                  value={documentText}
                  onChange={(e) => setDocumentText(e.target.value)}
                  rows={6}
                  aria-label="Document context as text"
                />
              )}
            </div>

            {submitError && (
              <div className="form-message form-message-error" role="alert">
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="form-message form-message-success" role="status">
                Data sent to backend successfully.
              </div>
            )}
            {submitSuccess && summaryContext && (
              <div className="summary-context">
                <h3 className="summary-context-title">Document summary</h3>
                {summaryContext.error && (
                  <p className="summary-context-error">{summaryContext.error}</p>
                )}
                {summaryContext.summary && (
                  <p className="summary-context-text">{summaryContext.summary}</p>
                )}
                {summaryContext.key_points && summaryContext.key_points.length > 0 && (
                  <ul className="summary-context-list">
                    {summaryContext.key_points.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button type="submit" className="submit-btn" disabled={submitting}>
              <LightningIcon />
              <span>{submitting ? 'Sending…' : 'Analyze Property'}</span>
            </button>
          </form>
        </div>
      </main>
      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSave={() => setSettingsModalOpen(false)}
      />
    </div>
  );
}
