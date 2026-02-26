import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  HiOutlineBanknotes,
  HiOutlineChartBar,
  HiOutlineHome,
  HiOutlineUserGroup,
  HiOutlineBuildingOffice2,
  HiOutlineExclamationTriangle,
  HiOutlineMapPin,
  HiOutlineTruck,
  HiOutlineUsers,
  HiOutlineShoppingBag,
  HiOutlineBriefcase,
  HiOutlineCalculator,
  HiOutlineSquare2Stack,
  HiOutlineShieldExclamation,
  HiOutlinePresentationChartLine,
  HiOutlineChartBarSquare,
  HiOutlineArrowTrendingUp,
  HiOutlineArrowTrendingDown,
  HiOutlineArrowRight,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineSparkles,
  HiOutlineChatBubbleLeftRight,
  HiOutlineXMark,
  HiOutlineEnvelope,
  HiOutlineInformationCircle,
  HiOutlinePaperAirplane,
  HiOutlineDocumentText,
  HiOutlinePlus,
  HiOutlineTrash,
  HiArrowRightOnRectangle,
} from 'react-icons/hi2';
import './Dashboard.css';
import './AnalysisScreen.css';

const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="dashboard-logo-icon">
    <path d="M8 8h6v6H8V8zm10 0h6v6h-6V8zM8 18h6v6H8v-6zm10 0h6v6h-6v-6z" fill="url(#dashboard-logo-grad)" />
    <path d="M14 8v6h4V8h-4zm0 10v6h4v-6h-4zM8 14h6v4H8v-4zm10 0h6v4h-6v-4z" fill="url(#dashboard-logo-grad2)" opacity="0.8" />
    <defs>
      <linearGradient id="dashboard-logo-grad" x1="8" y1="8" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#5B4FFF" />
        <stop offset="1" stopColor="#8B7CFE" />
      </linearGradient>
      <linearGradient id="dashboard-logo-grad2" x1="8" y1="14" x2="24" y2="18" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7C6FFF" />
        <stop offset="1" stopColor="#A89BFE" />
      </linearGradient>
    </defs>
  </svg>
);

const INSIGHT_ICON_MAP = [
  { match: /income|revenue|disposable/i, Icon: HiOutlineBanknotes },
  { match: /traffic|footfall|count/i, Icon: HiOutlineTruck },
  { match: /rent|lease/i, Icon: HiOutlineHome },
  { match: /forecast|trend/i, Icon: HiOutlinePresentationChartLine },
  { match: /infrastructure|location|area/i, Icon: HiOutlineMapPin },
  { match: /co-tenancy|tenant mix|tenancy/i, Icon: HiOutlineUserGroup },
  { match: /demographic|consumer|population/i, Icon: HiOutlineUsers },
  { match: /vacancy/i, Icon: HiOutlineBuildingOffice2 },
  { match: /tenant.*trend|category trend/i, Icon: HiOutlineChartBarSquare },
  { match: /risk|landlord/i, Icon: HiOutlineExclamationTriangle },
  { match: /market|activity/i, Icon: HiOutlineShoppingBag },
  { match: /sales|comps/i, Icon: HiOutlineChartBar },
  { match: /portfolio/i, Icon: HiOutlineBriefcase },
  { match: /noi|occupancy/i, Icon: HiOutlineCalculator },
  { match: /parking/i, Icon: HiOutlineSquare2Stack },
  { match: /crime|safety/i, Icon: HiOutlineShieldExclamation },
];

function getIconForTitle(title) {
  const t = title || '';
  const found = INSIGHT_ICON_MAP.find(({ match }) => match.test(t));
  return found ? found.Icon : HiOutlineChartBar;
}

const NO_DATA_PLACEHOLDERS = /^(no data|n\/a|n\.a\.?|not available|enable api key|—|none|no evidence)$/i;
/** Short placeholder-only evidence (exact or very short) - hide these; longer text with real insight is shown */
const SHORT_NO_DATA = /^(no (current )?data found|no data|insufficient data(\s+for\s+comparison)?\.?)$/i;

function dedupeCardsByTitle(cardList) {
  if (!Array.isArray(cardList) || cardList.length === 0) return cardList;
  const seen = new Set();
  return cardList.filter((card) => {
    const key = (card?.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasCardData(card) {
  if (!card || typeof card !== 'object') return false;
  const title = (card.title || '').trim();
  if (!title) return false;
  const evidence = (card.data_evidence || card.insight || '').trim();
  if (!evidence || NO_DATA_PLACEHOLDERS.test(evidence)) return false;
  if (evidence.length <= 60 && SHORT_NO_DATA.test(evidence)) return false;
  return true;
}

function InsightCardTile({ card, onViewEvidence, onEdit, isNew }) {
  const impactClass = card.impact === 'positive' ? 'positive' : card.impact === 'negative' ? 'negative' : 'neutral';
  const impactLabel = card.impact === 'positive' ? 'POSITIVE' : card.impact === 'negative' ? 'NEGATIVE' : 'NEUTRAL';
  const summary = (card.insight || card.data_evidence)?.slice(0, 80) || card.why_it_matters?.slice(0, 80) || '';
  const IconComponent = getIconForTitle(card.title);
  const TrendIcon = impactClass === 'positive' ? HiOutlineArrowTrendingUp : impactClass === 'negative' ? HiOutlineArrowTrendingDown : null;

  return (
    <div className={`dashboard-insight-tile dashboard-insight-tile--${impactClass}${isNew ? ' dashboard-insight-tile--new' : ''}`}>
      {isNew && <span className="dashboard-insight-tile__new-badge">NEW</span>}
      <div className="dashboard-insight-tile__head">
        <div className="dashboard-insight-tile__icon" aria-hidden>
          <IconComponent className="dashboard-insight-tile__icon-svg" size={22} />
        </div>
        <div className="dashboard-insight-tile__head-right">
          <span className={`dashboard-insight-tile__badge dashboard-insight-tile__badge--${impactClass}`}>
            {TrendIcon && <TrendIcon className="dashboard-insight-tile__badge-icon" size={12} />}
            {impactLabel}
          </span>
          {onEdit && (
            <button
              type="button"
              className="dashboard-insight-tile__edit"
              onClick={onEdit}
              aria-label="Edit card"
            >
              ✎
            </button>
          )}
        </div>
      </div>
      <h3 className="dashboard-insight-tile__title">{card.title}</h3>
      <p className="dashboard-insight-tile__summary">{summary}{summary.length >= 80 ? '...' : ''}</p>
      <button type="button" className="dashboard-insight-tile__link" onClick={() => onViewEvidence(card)}>
        <span>View Evidence</span>
        <HiOutlineArrowRight className="dashboard-insight-tile__link-arrow" size={16} />
      </button>
    </div>
  );
}

function ChartPointMarker({ x, y, color, size = 5 }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d={`M ${-size} ${-size} L ${size} ${size} M ${size} ${-size} L ${-size} ${size}`} stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" className="dashboard-modal__chart-marker" />
    </g>
  );
}

function BaselineTrendChart({ baselinePct, trendPct }) {
  const w = 340;
  const h = 180;
  const pad = { left: 36, right: 40, top: 16, bottom: 32 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const hasBaseline = baselinePct != null;
  const hasTrend = trendPct != null;
  const hasData = hasBaseline || hasTrend;
  const bl = hasBaseline ? Math.min(100, Math.max(0, Number(baselinePct))) : 0;
  const tr = hasTrend ? Math.min(100, Math.max(0, Number(trendPct))) : bl;
  const y = (pct) => pad.top + plotH * (1 - pct / 100);
  const x0 = pad.left;
  const x1 = pad.left + plotW;
  const yTicks = [0, 25, 50, 75, 100];
  const baselinePath = `M ${x0} ${y(bl)} L ${x1} ${y(bl)}`;
  const trendPath = `M ${x0} ${y(bl)} L ${x1} ${y(tr)}`;

  const labelGapMin = 18;
  const yBl = y(bl);
  const yTr = y(tr);
  const labelsOverlap = hasBaseline && hasTrend && Math.abs(yBl - yTr) < labelGapMin;
  const baselineLabelY = labelsOverlap ? yBl - 10 : yBl + 4;
  const trendLabelY = labelsOverlap ? yTr + 14 : yTr + 4;

  if (!hasData) return <div className="dashboard-modal__chart-placeholder">No baseline or trend data</div>;

  return (
    <div className="dashboard-modal__chart-wrap">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="dashboard-modal__chart-svg" preserveAspectRatio="xMidYMid meet">
        {/* Y-axis line */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="#1a1a2e" strokeWidth="1" />
        {/* X-axis line */}
        <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="#1a1a2e" strokeWidth="1" />
        {/* Y-axis ticks and labels */}
        {yTicks.map((pct) => (
          <g key={pct}>
            <line x1={pad.left} y1={y(pct)} x2={pad.left + plotW} y2={y(pct)} stroke="var(--chart-grid, #e5e7eb)" strokeWidth="0.5" strokeDasharray="4 2" />
            <line x1={pad.left - 4} y1={y(pct)} x2={pad.left} y2={y(pct)} stroke="#1a1a2e" strokeWidth="1" />
            <text x={pad.left - 8} y={y(pct) + 4} textAnchor="end" className="dashboard-modal__chart-axis" fill="#374151">{pct}</text>
          </g>
        ))}
        {/* X-axis ticks and labels */}
        <line x1={x0} y1={pad.top + plotH} x2={x0} y2={pad.top + plotH + 4} stroke="#1a1a2e" strokeWidth="1" />
        <line x1={x1} y1={pad.top + plotH} x2={x1} y2={pad.top + plotH + 4} stroke="#1a1a2e" strokeWidth="1" />
        <text x={x0} y={h - 8} textAnchor="middle" className="dashboard-modal__chart-axis" fill="#374151">Past</text>
        <text x={x1} y={h - 8} textAnchor="middle" className="dashboard-modal__chart-axis" fill="#374151">Current</text>
        {/* Zigzag: baseline (flat) + trend (sloped) — straight segments */}
        {hasBaseline && <path d={baselinePath} fill="none" stroke="var(--chart-baseline, #6b7280)" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter" />}
        {hasTrend && <path d={trendPath} fill="none" stroke="var(--chart-trend, #5B4FFF)" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter" />}
        {/* Data point markers (x style like reference) */}
        {hasBaseline && <ChartPointMarker x={x0} y={y(bl)} color="var(--chart-baseline, #6b7280)" />}
        {hasBaseline && <ChartPointMarker x={x1} y={y(bl)} color="var(--chart-baseline, #6b7280)" />}
        {hasTrend && <ChartPointMarker x={x1} y={y(tr)} color="var(--chart-trend, #5B4FFF)" />}
        {/* % labels on the lines only; offset when overlapping */}
        {hasBaseline && <text x={x1 + 8} y={baselineLabelY} className="dashboard-modal__chart-label dashboard-modal__chart-label--baseline" fill="var(--chart-baseline, #6b7280)">{Math.round(bl)}%</text>}
        {hasTrend && <text x={x1 + 8} y={trendLabelY} className="dashboard-modal__chart-label dashboard-modal__chart-label--trend" fill="var(--chart-trend, #5B4FFF)">{Math.round(tr)}%</text>}
      </svg>
      <div className="dashboard-modal__chart-legend">
        {hasBaseline && <span className="dashboard-modal__chart-legend-item"><span className="dashboard-modal__chart-legend-line dashboard-modal__chart-legend-line--baseline" /> Baseline</span>}
        {hasTrend && <span className="dashboard-modal__chart-legend-item"><span className="dashboard-modal__chart-legend-line dashboard-modal__chart-legend-line--trend" /> Current / Trend</span>}
      </div>
    </div>
  );
}

function EvidenceModal({ card, onClose }) {
  if (!card) return null;
  const impactClass = card.impact === 'positive' ? 'positive' : card.impact === 'negative' ? 'negative' : 'neutral';
  const impactLabel = card.impact === 'positive' ? 'POSITIVE IMPACT' : card.impact === 'negative' ? 'NEGATIVE IMPACT' : 'NEUTRAL IMPACT';
  const confidence = card.confidence_score != null ? Number(card.confidence_score) : 0;
  const source = card.source || 'Not available';
  const rawSourceUrl = (card.source_url || '').trim();
  const sourceUrl = rawSourceUrl
    ? (rawSourceUrl.startsWith('http://') || rawSourceUrl.startsWith('https://')
        ? rawSourceUrl
        : `https://${rawSourceUrl}`)
    : null;
  const baselinePct = card.baseline_pct != null ? Math.min(100, Math.max(0, Number(card.baseline_pct))) : null;
  const trendPct = card.current_trend_pct != null ? Math.min(100, Math.max(0, Number(card.current_trend_pct))) : null;
  const insightText = (card.insight || card.data_evidence || '').trim() || card.why_it_matters || '';
  const ModalIcon = getIconForTitle(card.title);

  return (
    <div className="dashboard-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title">
      <div className="dashboard-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="dashboard-modal__close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
        </button>
        <div className="dashboard-modal__header">
          <div className="dashboard-modal__icon-wrap">
            <ModalIcon className="dashboard-modal__icon-svg" size={26} />
          </div>
          <h2 id="evidence-modal-title" className="dashboard-modal__title">{card.title}</h2>
        </div>
        <div className={`dashboard-modal__impact dashboard-modal__impact--${impactClass}`}>{impactLabel}</div>

        <div className="dashboard-modal__section">
          <div className="dashboard-modal__section-label">WHAT&apos;S THE INSIGHT</div>
          <div className="dashboard-modal__section-content">
            <p className="dashboard-modal__evidence-text">{insightText || '—'}</p>
          </div>
        </div>

        <div className="dashboard-modal__section">
          <div className="dashboard-modal__section-label">DATA EVIDENCE (FROM WHERE)</div>
          <div className="dashboard-modal__section-content">
            <p className="dashboard-modal__evidence-text">{card.data_evidence || 'No data'}</p>
            {(baselinePct != null || trendPct != null) && <BaselineTrendChart baselinePct={baselinePct} trendPct={trendPct} />}
          </div>
        </div>

        <div className="dashboard-modal__section">
          <div className="dashboard-modal__section-label dashboard-modal__section-label--blue">WHY IT MATTERS</div>
          <div className="dashboard-modal__section-content">
            <p className="dashboard-modal__evidence-text">{card.why_it_matters || '—'}</p>
          </div>
        </div>

        <div className="dashboard-modal__footer">
          <span className="dashboard-modal__source">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dashboard-modal__source-link"
                onClick={(e) => e.stopPropagation()}
              >
                Source: {source} · Open in new tab
              </a>
            ) : (
              <>Source: {source}</>
            )}
          </span>
          <span className="dashboard-modal__confidence">Confidence: <strong>{confidence}%</strong></span>
        </div>
      </div>
    </div>
  );
}

export { InsightCardTile, EvidenceModal, SettingsModal };

const INDUSTRY_OPTIONS = ['Retail / Apparel', 'F&B', 'Office'];

function SettingsModal({ open, onClose, onSave }) {
  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('Retail / Apparel');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  // Default: OpenAI. Only one provider can be enabled. Stored value applied when modal opens.
  const [openaiEnabled, setOpenaiEnabled] = useState(true);
  const [anthropicEnabled, setAnthropicEnabled] = useState(false);
  const [llmProviderModalOpen, setLlmProviderModalOpen] = useState(false);
  const [llmProviderModalMessage, setLlmProviderModalMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('lg_llm_provider') : null;
    if (stored === 'anthropic') {
      setOpenaiEnabled(false);
      setAnthropicEnabled(true);
    } else if (stored === 'openai') {
      setOpenaiEnabled(true);
      setAnthropicEnabled(false);
    } else {
      setOpenaiEnabled(true);
      setAnthropicEnabled(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setLlmProviderModalOpen(false);
      setLlmProviderModalMessage('');
    }
  }, [open]);

  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setCategoryDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [categoryDropdownOpen]);

  if (!open) return null;

  const handleAddDocument = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const newDocs = Array.from(files).map((file, i) => ({
      id: `${file.name}-${Date.now()}-${i}`,
      name: file.name,
      status: 'Indexed',
    }));
    setDocuments((prev) => [...prev, ...newDocs]);
    e.target.value = '';
  };

  const handleSaveChanges = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lg_llm_provider', openaiEnabled ? 'openai' : 'anthropic');
      }
    } catch (_) {}
    onSave?.();
    onClose();
  };

  const handleRemoveDocument = (id) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  return (
    <div className="dashboard-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <div className="dashboard-settings-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="dashboard-modal__close" onClick={onClose} aria-label="Close">
          <HiOutlineXMark size={22} />
        </button>
        <h2 id="settings-modal-title" className="dashboard-settings-modal__title">Research Agent Settings</h2>

        <section className="dashboard-settings-modal__section">
          <h3 className="dashboard-settings-modal__section-title">Company Profile</h3>
          <div className="dashboard-settings-modal__row">
            <div className="dashboard-settings-modal__field">
              <label className="dashboard-settings-modal__label">Company Name</label>
              <input
                type="text"
                className="dashboard-settings-modal__input"
                placeholder="Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="dashboard-settings-modal__field dashboard-settings-modal__field--dropdown" ref={dropdownRef}>
              <label className="dashboard-settings-modal__label">Industry</label>
              <div className="dashboard-settings-modal__dropdown-wrap">
                <button
                  type="button"
                  className="dashboard-settings-modal__dropdown-trigger"
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  aria-expanded={categoryDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <span>{category}</span>
                  <HiOutlineChevronDown size={18} className="dashboard-settings-modal__dropdown-arrow" />
                </button>
                {categoryDropdownOpen && (
                  <div className="dashboard-settings-modal__dropdown-panel" role="listbox">
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        role="option"
                        aria-selected={category === opt}
                        className={`dashboard-settings-modal__dropdown-option ${category === opt ? 'dashboard-settings-modal__dropdown-option--selected' : ''}`}
                        onClick={() => { setCategory(opt); setCategoryDropdownOpen(false); }}
                      >
                        {category === opt && <span className="dashboard-settings-modal__dropdown-check">✓</span>}
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-settings-modal__section">
          <h3 className="dashboard-settings-modal__section-title">LLM Provider</h3>
          <p className="dashboard-settings-modal__label">
            Current: <strong>{openaiEnabled ? 'OpenAI' : 'Anthropic'}</strong> (OpenAI: {openaiEnabled ? 'On' : 'Off'}, Anthropic: {anthropicEnabled ? 'On' : 'Off'}). Stored preference is applied when you open this modal; Save persists it.
          </p>
          {llmProviderModalOpen && (
            <p role="alert" className="dashboard-settings-modal__alert">
              {llmProviderModalMessage}
            </p>
          )}
        </section>

        <section className="dashboard-settings-modal__section">
          <h3 className="dashboard-settings-modal__section-title">Knowledge Base (Documents)</h3>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="dashboard-settings-modal__file-input"
            accept=".pdf,.csv,.doc,.docx,.txt"
            onChange={handleFileChange}
            aria-hidden
          />
          <ul className="dashboard-settings-modal__doc-list">
            {documents.length === 0 ? (
              <li className="dashboard-settings-modal__doc-empty">No documents added yet. Click &quot;Add Document&quot; to upload.</li>
            ) : (
              documents.map((doc) => (
                <li key={doc.id} className="dashboard-settings-modal__doc-item">
                  <HiOutlineDocumentText size={20} className="dashboard-settings-modal__doc-icon" />
                  <span className="dashboard-settings-modal__doc-name">{doc.name}</span>
                  <span className="dashboard-settings-modal__doc-status">{doc.status}</span>
                  <button
                    type="button"
                    className="dashboard-settings-modal__doc-remove"
                    onClick={() => handleRemoveDocument(doc.id)}
                    aria-label={`Remove ${doc.name}`}
                    title="Remove document"
                  >
                    <HiOutlineTrash size={18} />
                  </button>
                </li>
              ))
            )}
          </ul>
          <button type="button" className="dashboard-settings-modal__add-doc" onClick={handleAddDocument}>
            <HiOutlinePlus size={18} />
            Add Document
          </button>
        </section>

        <div className="dashboard-settings-modal__footer">
          <button type="button" className="dashboard-settings-modal__btn dashboard-settings-modal__btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="dashboard-settings-modal__btn dashboard-settings-modal__btn--primary" onClick={handleSaveChanges}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

const SESSION_STORAGE_KEY = 'lg_analysis_session_id';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  // Prefer state (from navigation); fall back to localStorage so chat works after refresh or return later
  const sessionIdFromState = state.sessionId || null;
  const [sessionId, setSessionId] = useState(() => {
    if (sessionIdFromState) return sessionIdFromState;
    try {
      return (typeof window !== 'undefined' && window.localStorage.getItem(SESSION_STORAGE_KEY)) || null;
    } catch {
      return null;
    }
  });
  // Sync: when we have state.sessionId, persist it and use it; when state updates with new session, update local state
  useEffect(() => {
    if (state.sessionId) {
      setSessionId(state.sessionId);
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(SESSION_STORAGE_KEY, state.sessionId);
      } catch (_) {}
    }
  }, [state.sessionId]);

  // Restore dashboard data when we have sessionId (e.g. from localStorage after refresh) but no state
  const [restoredData, setRestoredData] = useState(null);
  const restoredSummary = restoredData?.dashboard_summary ?? null;
  const restoredCards = restoredData?.cards ?? [];
  const restoredProperty = restoredData?.property ?? {};
  useEffect(() => {
    const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
    const hasCards = Array.isArray(state.cards) && state.cards.length > 0;
    const hasSummary = state.dashboardSummary && (state.dashboardSummary.fair_market_rent != null || state.dashboardSummary.property);
    if (!sessionId) return;
    if (hasSummary && hasCards) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/analyze/dashboard?session_id=${encodeURIComponent(sessionId)}`, {
          credentials: 'include',
        });
        if (cancelled) return;
        if (res.status === 404) {
          setRestoredData({ session_found: false, property: {}, dashboard_summary: null, cards: [] });
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRestoredData(data);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [sessionId, state.dashboardSummary, state.cards]);

  const dashboardSummary = state.dashboardSummary || restoredSummary || {};
  // Mutable local edits override both router state and restored data so card updates are reflected immediately
  const [editedValidationCards, setEditedValidationCards] = useState(null);
  const baseCards = state.cards?.length ? state.cards : restoredCards;
  const allCards = dedupeCardsByTitle(editedValidationCards !== null ? editedValidationCards : baseCards);
  const cards = allCards.filter(hasCardData);
  const property = state.property || dashboardSummary?.property || restoredProperty || {};
  const sessionNotFoundOnServer = restoredData && restoredData.session_found === false;

  const [evidenceCard, setEvidenceCard] = useState(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [insightImpactFilter, setInsightImpactFilter] = useState('all');
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  useEffect(() => {
    if (insightImpactFilter === 'all') return;
    const filtered = allCards.filter(hasCardData);
    const count = filtered.filter((c) => c.impact === insightImpactFilter).length;
    if (count === 0) setInsightImpactFilter('all');
  }, [allCards, insightImpactFilter]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeChip, setActiveChip] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const chatMessagesContainerRef = useRef(null);
  const [credits, setCredits] = useState(null);
  const [navUsername] = useState(() => {
    try { return (typeof window !== 'undefined' && window.localStorage.getItem('lg_username')) || ''; } catch { return ''; }
  });
  const [customCards, setCustomCards] = useState([]);
  const [activeInsightsTab, setActiveInsightsTab] = useState('validation');
  const [customCardModalOpen, setCustomCardModalOpen] = useState(false);
  const [customCardPrompt, setCustomCardPrompt] = useState('');
  const [customCardSubmitting, setCustomCardSubmitting] = useState(false);
  const [customCardError, setCustomCardError] = useState(null);
  const [customCardStreamDone, setCustomCardStreamDone] = useState(false);
  const [newCustomCardIndices, setNewCustomCardIndices] = useState(new Set());
  // Sidebar log state (same pattern as AnalysisScreen)
  const [sidebarSteps, setSidebarSteps] = useState([]);
  const [sidebarDisplayedCount, setSidebarDisplayedCount] = useState(0);
  const [sidebarExitingSteps, setSidebarExitingSteps] = useState([]);
  const SIDEBAR_STEP_REVEAL_MS = 320;
  const SIDEBAR_MAX_VISIBLE = 6;
  const SIDEBAR_LOG_EXIT_MS = 450;
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [editingSource, setEditingSource] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState('');
  const [editingSubmitting, setEditingSubmitting] = useState(false);
  const [editingError, setEditingError] = useState(null);
  // Edit modal phases: 'form' | 'streaming' | 'compare'
  const [editPhase, setEditPhase] = useState('form');
  const [editSidebarSteps, setEditSidebarSteps] = useState([]);
  const [editSidebarDisplayedCount, setEditSidebarDisplayedCount] = useState(0);
  const [editSidebarExitingSteps, setEditSidebarExitingSteps] = useState([]);
  const [editStreamDone, setEditStreamDone] = useState(false);
  const [editUpdatedCard, setEditUpdatedCard] = useState(null);
  const [editConfirming, setEditConfirming] = useState(false);
  const EDIT_STEP_REVEAL_MS = 320;
  const EDIT_MAX_VISIBLE = 6;
  const EDIT_EXIT_MS = 450;
  const [toastMessage, setToastMessage] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  // Sidebar log step-reveal (same staggered pattern as AnalysisScreen)
  useEffect(() => {
    if (sidebarSteps.length <= sidebarDisplayedCount) return;
    const timer = setTimeout(() => {
      const nextCount = Math.min(sidebarDisplayedCount + 1, sidebarSteps.length);
      if (nextCount > SIDEBAR_MAX_VISIBLE && sidebarDisplayedCount >= SIDEBAR_MAX_VISIBLE) {
        const leaving = sidebarSteps[sidebarDisplayedCount - SIDEBAR_MAX_VISIBLE];
        if (leaving) {
          setSidebarExitingSteps((prev) => [...prev, { ...leaving, exitId: leaving.id }]);
          setTimeout(() => {
            setSidebarExitingSteps((prev) => prev.filter((s) => s.exitId !== leaving.id));
          }, SIDEBAR_LOG_EXIT_MS);
        }
      }
      setSidebarDisplayedCount(nextCount);
    }, SIDEBAR_STEP_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [sidebarSteps, sidebarSteps.length, sidebarDisplayedCount, SIDEBAR_MAX_VISIBLE, SIDEBAR_LOG_EXIT_MS, SIDEBAR_STEP_REVEAL_MS]);

  // Edit modal sidebar step-reveal (same staggered pattern)
  useEffect(() => {
    if (editSidebarSteps.length <= editSidebarDisplayedCount) return;
    const timer = setTimeout(() => {
      const nextCount = Math.min(editSidebarDisplayedCount + 1, editSidebarSteps.length);
      if (nextCount > EDIT_MAX_VISIBLE && editSidebarDisplayedCount >= EDIT_MAX_VISIBLE) {
        const leaving = editSidebarSteps[editSidebarDisplayedCount - EDIT_MAX_VISIBLE];
        if (leaving) {
          setEditSidebarExitingSteps((prev) => [...prev, { ...leaving, exitId: leaving.id }]);
          setTimeout(() => {
            setEditSidebarExitingSteps((prev) => prev.filter((s) => s.exitId !== leaving.id));
          }, EDIT_EXIT_MS);
        }
      }
      setEditSidebarDisplayedCount(nextCount);
    }, EDIT_STEP_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [editSidebarSteps, editSidebarSteps.length, editSidebarDisplayedCount, EDIT_MAX_VISIBLE, EDIT_EXIT_MS, EDIT_STEP_REVEAL_MS]);

  // Scroll chat to bottom when new message or thinking indicator appears
  useEffect(() => {
    const el = chatMessagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight - el.clientHeight;
  }, [chatMessages, chatLoading]);
  // Helper function to refresh credits
  const refreshCredits = async () => {
    let username = '';
    try {
      if (typeof window !== 'undefined') {
        username = window.localStorage.getItem('lg_username') || '';
      }
    } catch {
      username = '';
    }
    if (!username) return;
    try {
      const res = await fetch(`${API_BASE}/api/user/credits?username=${encodeURIComponent(username)}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.credits === 'number') {
        setCredits(data.credits);
      }
    } catch {
      // ignore credit fetch errors
    }
  };

  // Fetch credits for the logged-in user (if any) to show in navbar
  useEffect(() => {
    refreshCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE]);

  // Fetch any previously saved custom cards for this session
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/custom-cards?session_id=${encodeURIComponent(sessionId)}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.cards)) {
          setCustomCards(data.cards);
        }
      } catch {
        // ignore fetch errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API_BASE, sessionId]);

  const showDashboardToast = (message) => {
    setToastMessage(message);
    if (typeof window !== 'undefined') {
      window.clearTimeout(showDashboardToast._timer);
      // eslint-disable-next-line no-param-reassign
      showDashboardToast._timer = window.setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const sendChatMessage = async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    setChatMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setChatInput('');
    // Re-sync sessionId from localStorage so template clicks and returns from card view still work
    let effectiveSessionId = sessionId;
    try {
      if (typeof window !== 'undefined' && !effectiveSessionId) {
        const fromStorage = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (fromStorage) {
          effectiveSessionId = fromStorage;
          setSessionId(fromStorage);
        }
      }
    } catch (_) {}
    if (!effectiveSessionId) {
      setChatMessages((prev) => [...prev, { role: 'assistant', text: 'Complete an analysis from the form to chat with full context (property, documents, and insights).' }]);
      return;
    }
    setChatLoading(true);
    try {
      let llmProvider = 'openai';
      try {
        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem('lg_llm_provider');
          if (stored === 'openai' || stored === 'anthropic') llmProvider = stored;
        }
      } catch {
        // ignore storage errors, default stays openai
      }
      const res = await fetch(`${API_BASE}/api/analyze/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: effectiveSessionId,
          message: trimmed,
          llm_provider: llmProvider,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChatMessages((prev) => [...prev, { role: 'assistant', text: data.detail || res.statusText || 'Request failed.' }]);
        return;
      }
      const reply = data.reply || 'No response.';
      const isSessionExpired = typeof reply === 'string' && reply.includes('session has expired') && reply.includes('Run a new analysis');
      if (isSessionExpired) {
        try {
          if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch (_) {}
        setSessionId(null);
      }
      setChatMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${err.message || 'Could not reach the server.'}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Template prompts sent to the model when user clicks a chip (use full prompts for better answers)
  const QUICK_PROMPTS = [
    { id: 'draft', label: 'Draft negotiation email', Icon: HiOutlineEnvelope, prompt: 'Using the analysis and evidence we have for this property, draft a short professional negotiation email I can send to the landlord (or tenant) to open a rent discussion. Keep it concise and reference key points from the forecast.' },
    { id: 'risk', label: 'Explain risk factors', Icon: HiOutlineInformationCircle, prompt: 'Based on the analysis and evidence we have gathered, explain the main risk factors for this lease and how they might affect the tenant, landlord, or deal. Be specific and reference the insights where relevant.' },
    { id: 'comps', label: 'Compare with recent comps', Icon: HiOutlineChartBar, prompt: 'Using the data and comps we have, compare this property’s rent and terms with recent comparable leases in the area. Summarize how this deal stacks up and any notable differences.' },
  ];
  const INITIAL_INSIGHTS = 6;
  const IMPACT_ORDER = { positive: 0, neutral: 1, negative: 2 };
  const cardsSortedByImpact = [...cards].sort((a, b) => (IMPACT_ORDER[a.impact] ?? 1) - (IMPACT_ORDER[b.impact] ?? 1));
  const cardsFiltered = insightImpactFilter === 'all'
    ? cardsSortedByImpact
    : cardsSortedByImpact.filter((c) => c.impact === insightImpactFilter);
  const displayCards = insightsExpanded ? cardsFiltered : cardsFiltered.slice(0, INITIAL_INSIGHTS);
  const hasMore = cardsFiltered.length > INITIAL_INSIGHTS;
  const countByImpact = { positive: cards.filter((c) => c.impact === 'positive').length, neutral: cards.filter((c) => c.impact === 'neutral').length, negative: cards.filter((c) => c.impact === 'negative').length };

  const fairRent = dashboardSummary.fair_market_rent != null ? Number(dashboardSummary.fair_market_rent) : null;
  const confidence = dashboardSummary.confidence_score != null ? Number(dashboardSummary.confidence_score) : 85;
  const vsCurrentPct = dashboardSummary.vs_current_pct != null ? Number(dashboardSummary.vs_current_pct) : null;
  const currentRent = property.current_base_rent != null ? String(property.current_base_rent) : '';
  const rec = dashboardSummary.recommendations || {};
  const port = dashboardSummary.portfolio_context || {};

  const thisRent = port.this_property_rent != null ? Number(port.this_property_rent) : fairRent;
  const portfolioAvg = port.portfolio_avg_rent != null ? Number(port.portfolio_avg_rent) : null;
  const comparisonPct = port.comparison_pct != null ? Number(port.comparison_pct) : null;
  const comparisonText = port.comparison_text || '';

  const hasValidationCards = cards.length > 0;
  const hasCustomCards = customCards.length > 0;

  // Redirect to form page if no dashboard data exists
  if (!property.name && !dashboardSummary.fair_market_rent) {
    // Use useEffect to prevent navigation during render
    // But for immediate redirect, we can use Navigate component
    return <Navigate to="/start" replace />;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-navbar">
        <div className="dashboard-navbar__left">
          <LogoIcon />
          <span className="dashboard-navbar__name">LegalGraph.AI</span>
        </div>
        <div className="dashboard-navbar__right">
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
          <button type="button" className="dashboard-navbar__settings" onClick={() => setSettingsModalOpen(true)} aria-label="Open settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
            Settings
          </button>
          <div className="dashboard-navbar__user">
            <div className="dashboard-navbar__user-text">
              <span className="dashboard-navbar__user-name">{navUsername || 'LegalGraph User'}</span>
              <span className="dashboard-navbar__user-role">Admin</span>
            </div>
            <div className="dashboard-navbar__avatar" aria-hidden>
              {navUsername ? navUsername.slice(0, 2).toUpperCase() : 'LG'}
            </div>
            <button
              type="button"
              className="dashboard-navbar__logout-btn"
              onClick={() => {
                try { if (typeof window !== 'undefined') { window.localStorage.removeItem('lg_username'); window.localStorage.removeItem(SESSION_STORAGE_KEY); } } catch (_) {}
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

      <div className="dashboard-body">
        <section className="dashboard-property-header">
          <div className="dashboard-property-header__info">
            <h1 className="dashboard-property-header__title">{property.name || 'Property'}</h1>
            <div className="dashboard-property-header__meta">
              <span className="dashboard-property-header__meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                {property.address || '—'}
              </span>
              <span className="dashboard-property-header__meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
                {property.leasable_area ? `${Number(property.leasable_area).toLocaleString()} sq ft` : '—'}
              </span>
            </div>
          </div>
          <div className="dashboard-property-header__actions">
            <button
              type="button"
              className="dashboard-btn dashboard-btn--outline dashboard-btn--assistant"
              onClick={() => setChatPanelOpen(true)}
              aria-label="Ask LegalGraph"
            >
              <HiOutlineChatBubbleLeftRight size={18} />
              Ask LegalGraph
            </button>
          </div>
        </section>

        <section className="dashboard-cards">
          <div className="dashboard-card dashboard-card--rent">
            <div className="dashboard-card__label">FAIR MARKET RENT</div>
            <div className="dashboard-card__value">
              {fairRent != null ? `$${Number(fairRent).toFixed(2)}` : '—'}
              <span className="dashboard-card__value-suffix">/ sq ft</span>
            </div>
            {vsCurrentPct != null && currentRent && (
              <div className="dashboard-card__vs">
                <span className={`dashboard-card__vs-pill ${vsCurrentPct < 0 ? 'dashboard-card__vs-pill--down' : vsCurrentPct > 0 ? 'dashboard-card__vs-pill--up' : ''}`}>
                  <span className="dashboard-card__vs-arrow">{vsCurrentPct < 0 ? '↓' : vsCurrentPct > 0 ? '↑' : '−'}</span>
                  <span className="dashboard-card__vs-pct">
                    {vsCurrentPct > 0 ? '+' : ''}{vsCurrentPct}%
                  </span>
                </span>
                <span className="dashboard-card__vs-label">vs Current (${currentRent})</span>
              </div>
            )}
            <div className="dashboard-card__confidence">
              <div className="dashboard-card__confidence-bar">
                <div className="dashboard-card__confidence-fill" style={{ width: `${confidence}%` }} />
              </div>
              <div className="dashboard-card__confidence-text">Confidence Score: <strong className="dashboard-card__confidence-pct">{confidence}%</strong></div>
            </div>
          </div>

          <div className="dashboard-card dashboard-card--recs">
            <div className="dashboard-card__label dashboard-card__label--recs">
              <svg className="dashboard-card__recs-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" /></svg>
              RECOMMENDATIONS
            </div>
            <div className="dashboard-card__rec-list">
              <div className="dashboard-card__rec-row">
                <div className="dashboard-card__rec-row-head">
                  <span className="dashboard-card__rec-label">Ideal Term</span>
                  {(rec.ideal_term_reasoning || '').trim() && (
                    <span className="dashboard-card__rec-tooltip-wrap">
                      <HiOutlineInformationCircle className="dashboard-card__rec-info-icon" size={22} aria-label="Why we suggested this" />
                      <span className="dashboard-card__rec-tooltip">{rec.ideal_term_reasoning}</span>
                    </span>
                  )}
                </div>
                <p className="dashboard-card__rec-value">{rec.ideal_term || '—'}</p>
              </div>
              <div className="dashboard-card__rec-row">
                <div className="dashboard-card__rec-row-head">
                  <span className="dashboard-card__rec-label">Negotiation Leverage</span>
                  {(rec.negotiation_leverage_reasoning || '').trim() && (
                    <span className="dashboard-card__rec-tooltip-wrap">
                      <HiOutlineInformationCircle className="dashboard-card__rec-info-icon" size={22} aria-label="Why we suggested this" />
                      <span className="dashboard-card__rec-tooltip">{rec.negotiation_leverage_reasoning}</span>
                    </span>
                  )}
                </div>
                <p className="dashboard-card__rec-value dashboard-card__rec-value--green">{rec.negotiation_leverage || '—'}</p>
              </div>
              <div className="dashboard-card__rec-row">
                <div className="dashboard-card__rec-row-head">
                  <span className="dashboard-card__rec-label">Renewals</span>
                  {(rec.renewals_reasoning || '').trim() && (
                    <span className="dashboard-card__rec-tooltip-wrap">
                      <HiOutlineInformationCircle className="dashboard-card__rec-info-icon" size={22} aria-label="Why we suggested this" />
                      <span className="dashboard-card__rec-tooltip">{rec.renewals_reasoning}</span>
                    </span>
                  )}
                </div>
                <p className="dashboard-card__rec-value">{rec.renewals || '—'}</p>
              </div>
            </div>
          </div>

          <div className="dashboard-card dashboard-card--portfolio">
            <div className="dashboard-card__label">PORTFOLIO CONTEXT</div>
            <div className="dashboard-card__portfolio-bars">
              <div className="dashboard-card__portfolio-item">
                <div className="dashboard-card__portfolio-row">
                  <span className="dashboard-card__portfolio-label">This Property</span>
                  <span className="dashboard-card__portfolio-sf">${thisRent != null ? Number(thisRent).toFixed(2) : '—'}/sf</span>
                </div>
                <div className="dashboard-card__portfolio-bar-wrap">
                  <div className="dashboard-card__portfolio-bar dashboard-card__portfolio-bar--this" style={{ width: portfolioAvg ? `${Math.min(100, (thisRent / portfolioAvg) * 100)}%` : '75%' }} />
                </div>
              </div>
              <div className="dashboard-card__portfolio-item">
                <div className="dashboard-card__portfolio-row">
                  <span className="dashboard-card__portfolio-label">Portfolio Avg (SF)</span>
                  <span className="dashboard-card__portfolio-sf">${portfolioAvg != null ? Number(portfolioAvg).toFixed(2) : '—'}/sf</span>
                </div>
                <div className="dashboard-card__portfolio-bar-wrap">
                  <div className="dashboard-card__portfolio-bar dashboard-card__portfolio-bar--avg" />
                </div>
              </div>
            </div>
            {comparisonText && (
              <div className={`dashboard-card__portfolio-summary ${comparisonPct != null && comparisonPct < 0 ? 'dashboard-card__portfolio-summary--below' : ''}`}>
                <span className="dashboard-card__portfolio-check">{comparisonPct != null && comparisonPct < 0 ? '↓' : '✓'}</span>
                <span className="dashboard-card__portfolio-text">
                  {(() => {
                    const m = comparisonText.match(/(^.*?)(\d+\.?\d*%\s*(?:below|above))(\s*.*$)/i);
                    if (m) return <>{m[1]}<strong className="dashboard-card__portfolio-pct">{m[2]}</strong>{m[3]}</>;
                    return comparisonText;
                  })()}
                </span>
              </div>
            )}
          </div>
        </section>

        {sessionNotFoundOnServer && (
        <section className="dashboard-insights dashboard-insights--empty">
          <div className="dashboard-insights__head">
            <h2 className="dashboard-insights__title">
              <span className="dashboard-insights__title-icon">
                <HiOutlineSparkles size={20} />
              </span>
              Validation Insights
            </h2>
          </div>
          <div className="dashboard-empty-state">
            <p className="dashboard-empty-state__text">
              This session was created on a different server. Insights are stored per server, so they don’t appear here.
            </p>
            <p className="dashboard-empty-state__hint">
              Run a new analysis using the form above to see your dashboard and insight cards on this server.
            </p>
            <button
              type="button"
              className="dashboard-btn dashboard-btn--primary"
              onClick={() => navigate('/start')}
            >
              Start new analysis
            </button>
          </div>
        </section>
        )}

        {(hasValidationCards || hasCustomCards) && (
        <section className={`dashboard-insights ${insightsExpanded ? 'dashboard-insights--expanded' : ''}`}>
          {/* Section header: title + Create button */}
          <div className="dashboard-insights__head">
            <h2 className="dashboard-insights__title">
              <span className="dashboard-insights__title-icon">
                <HiOutlineSparkles size={20} />
              </span>
              Insights
              <span className="dashboard-insights__title-count">{activeInsightsTab === 'customCard' ? customCards.length : cards.length}</span>
            </h2>
            <button
              type="button"
              className="dashboard-insights__create-btn"
              onClick={() => {
                setCustomCardError(null);
                setCustomCardPrompt('');
                setCustomCardModalOpen(true);
              }}
            >
              <span className="dashboard-insights__create-btn-icon">
                <HiOutlinePlus size={16} />
              </span>
              Create Custom Card
            </button>
          </div>

          {/* Filter bar: All / Positive / Neutral / Negative + dynamic Custom Cards tab */}
          <div className="dashboard-insights__filterbar" role="tablist" aria-label="Filter insights">
            <button
              type="button"
              role="tab"
              aria-selected={activeInsightsTab === 'validation' && insightImpactFilter === 'all'}
              className={`dashboard-insights__filterbar-btn ${activeInsightsTab === 'validation' && insightImpactFilter === 'all' ? 'dashboard-insights__filterbar-btn--active' : ''}`}
              onClick={() => { setActiveInsightsTab('validation'); setInsightImpactFilter('all'); }}
            >
              All
              <span className="dashboard-insights__filterbar-count">{cards.length}</span>
            </button>
            {countByImpact.positive > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={activeInsightsTab === 'validation' && insightImpactFilter === 'positive'}
                className={`dashboard-insights__filterbar-btn dashboard-insights__filterbar-btn--positive ${activeInsightsTab === 'validation' && insightImpactFilter === 'positive' ? 'dashboard-insights__filterbar-btn--active dashboard-insights__filterbar-btn--active-positive' : ''}`}
                onClick={() => { setActiveInsightsTab('validation'); setInsightImpactFilter('positive'); }}
              >
                <span className="dashboard-insights__filterbar-dot dashboard-insights__filterbar-dot--positive" />
                Positive
                <span className="dashboard-insights__filterbar-count">{countByImpact.positive}</span>
              </button>
            )}
            {countByImpact.neutral > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={activeInsightsTab === 'validation' && insightImpactFilter === 'neutral'}
                className={`dashboard-insights__filterbar-btn dashboard-insights__filterbar-btn--neutral ${activeInsightsTab === 'validation' && insightImpactFilter === 'neutral' ? 'dashboard-insights__filterbar-btn--active dashboard-insights__filterbar-btn--active-neutral' : ''}`}
                onClick={() => { setActiveInsightsTab('validation'); setInsightImpactFilter('neutral'); }}
              >
                <span className="dashboard-insights__filterbar-dot dashboard-insights__filterbar-dot--neutral" />
                Neutral
                <span className="dashboard-insights__filterbar-count">{countByImpact.neutral}</span>
              </button>
            )}
            {countByImpact.negative > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={activeInsightsTab === 'validation' && insightImpactFilter === 'negative'}
                className={`dashboard-insights__filterbar-btn dashboard-insights__filterbar-btn--negative ${activeInsightsTab === 'validation' && insightImpactFilter === 'negative' ? 'dashboard-insights__filterbar-btn--active dashboard-insights__filterbar-btn--active-negative' : ''}`}
                onClick={() => { setActiveInsightsTab('validation'); setInsightImpactFilter('negative'); }}
              >
                <span className="dashboard-insights__filterbar-dot dashboard-insights__filterbar-dot--negative" />
                Negative
                <span className="dashboard-insights__filterbar-count">{countByImpact.negative}</span>
              </button>
            )}
            {/* Custom Cards tab — only appears once user has created at least one */}
            {hasCustomCards && (
              <button
                type="button"
                role="tab"
                aria-selected={activeInsightsTab === 'customCard'}
                className={`dashboard-insights__filterbar-btn dashboard-insights__filterbar-btn--custom ${activeInsightsTab === 'customCard' ? 'dashboard-insights__filterbar-btn--active dashboard-insights__filterbar-btn--active-custom' : ''}`}
                onClick={() => setActiveInsightsTab('customCard')}
              >
                <HiOutlineSparkles size={13} />
                Custom Cards
                <span className="dashboard-insights__filterbar-count">{customCards.length}</span>
              </button>
            )}
          </div>

          <div className="dashboard-insights-grid">
            {activeInsightsTab === 'validation' &&
              displayCards.map((card, i) => (
                <InsightCardTile
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${card.title}-${i}`}
                  card={card}
                  onViewEvidence={setEvidenceCard}
                  onEdit={() => {
                    const idx = cards.findIndex((c) => c === card);
                    if (idx >= 0) {
                      setEditingCard(card);
                      setEditingSource('validation');
                      setEditingIndex(idx);
                      setEditingPrompt('');
                      setEditingError(null);
                      setEditModalOpen(true);
                    }
                  }}
                />
              ))}
            {activeInsightsTab === 'customCard' &&
              customCards.map((card, i) => (
                <InsightCardTile
                  // eslint-disable-next-line react/no-array-index-key
                  key={`customCard-${card.title}-${i}`}
                  card={card}
                  isNew={newCustomCardIndices.has(i)}
                  onViewEvidence={setEvidenceCard}
                  onEdit={() => {
                    const idx = customCards.findIndex((c) => c === card);
                    if (idx >= 0) {
                      setEditingCard(card);
                      setEditingSource('custom');
                      setEditingIndex(idx);
                      setEditingPrompt('');
                      setEditingError(null);
                      setEditModalOpen(true);
                    }
                  }}
                />
              ))}
          </div>
          {activeInsightsTab === 'validation' && hasMore && (
            <div className="dashboard-insights__toggle-wrap">
              <button
                type="button"
                className="dashboard-insights__toggle"
                onClick={() => setInsightsExpanded(!insightsExpanded)}
              >
                {insightsExpanded ? (
                  <>
                    <HiOutlineChevronUp className="dashboard-insights__toggle-icon" size={18} />
                    Show less
                  </>
                ) : (
                  <>
                    <HiOutlineChevronDown className="dashboard-insights__toggle-icon" size={18} />
                    Show more ({cardsFiltered.length - INITIAL_INSIGHTS} more)
                  </>
                )}
              </button>
            </div>
          )}
        </section>
        )}
      </div>
      <EvidenceModal card={evidenceCard} onClose={() => setEvidenceCard(null)} />
      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSave={() => {
          setSaveToastVisible(true);
          setTimeout(() => setSaveToastVisible(false), 3000);
        }}
      />
      {saveToastVisible && (
        <div className="dashboard-toast" role="status" aria-live="polite">
          Changes have been saved.
        </div>
      )}
      {toastMessage && (
        <div className="dashboard-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}

      <div className={`dashboard-chat-panel ${chatPanelOpen ? 'dashboard-chat-panel--open' : ''}`} aria-hidden={!chatPanelOpen}>
        <div className="dashboard-chat-panel__backdrop" onClick={() => setChatPanelOpen(false)} aria-hidden />
        <aside className="dashboard-chat-panel__drawer">
          <div className="dashboard-chat-panel__header">
            <div className="dashboard-chat-panel__header-left">
              <div className="dashboard-chat-panel__avatar dashboard-chat-panel__avatar--agent">
                <HiOutlineChatBubbleLeftRight size={20} />
              </div>
              <div>
                <h3 className="dashboard-chat-panel__title">Ask the Research Agent</h3>
                <p className="dashboard-chat-panel__subtitle">Ask about specific data points or negotiation strategies.</p>
              </div>
            </div>
            <button type="button" className="dashboard-chat-panel__close" onClick={() => setChatPanelOpen(false)} aria-label="Close">
              <HiOutlineXMark size={22} />
            </button>
          </div>

          <div className="dashboard-chat-panel__chips">
            {QUICK_PROMPTS.map(({ id, label, Icon, prompt }) => (
              <button
                key={id}
                type="button"
                className={`dashboard-chat-panel__chip ${activeChip === id ? 'dashboard-chat-panel__chip--active' : ''}`}
                onClick={() => {
                  setActiveChip(id);
                  sendChatMessage(prompt || label);
                }}
                disabled={chatLoading}
              >
                <Icon size={16} className="dashboard-chat-panel__chip-icon" />
                {label}
              </button>
            ))}
          </div>

          <div className="dashboard-chat-panel__messages" ref={chatMessagesContainerRef}>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`dashboard-chat-panel__msg-row dashboard-chat-panel__msg-row--${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="dashboard-chat-panel__avatar dashboard-chat-panel__avatar--agent">
                    <HiOutlineChatBubbleLeftRight size={18} />
                  </div>
                )}
                <div className={`dashboard-chat-panel__msg dashboard-chat-panel__msg--${msg.role}`}>
                  {msg.role === 'assistant' && msg.text.includes('**') ? (
                    msg.text.split(/\*\*(.*?)\*\*/g).map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))
                  ) : (
                    <span className="dashboard-chat-panel__msg-text">{msg.text}</span>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="dashboard-chat-panel__avatar dashboard-chat-panel__avatar--user" aria-hidden>RS</div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="dashboard-chat-panel__msg-row dashboard-chat-panel__msg-row--assistant">
                <div className="dashboard-chat-panel__avatar dashboard-chat-panel__avatar--agent">
                  <HiOutlineChatBubbleLeftRight size={18} />
                </div>
                <div className="dashboard-chat-panel__msg dashboard-chat-panel__msg--assistant dashboard-chat-panel__msg--loading">
                  <span className="dashboard-chat-panel__msg-text">Thinking…</span>
                </div>
              </div>
            )}
          </div>

          <form
            className="dashboard-chat-panel__form"
            onSubmit={(e) => {
              e.preventDefault();
              sendChatMessage(chatInput);
            }}
          >
            <input
              type="text"
              className="dashboard-chat-panel__input"
              placeholder="Ask a question about this forecast..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              aria-label="Message"
              disabled={chatLoading}
            />
            <button type="submit" className="dashboard-chat-panel__send" aria-label="Send" disabled={chatLoading}>
              <HiOutlinePaperAirplane size={18} />
            </button>
          </form>
        </aside>
      </div>
      {customCardModalOpen && (
        <div className="dashboard-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="custom-card-title">
          <div
            className={"dashboard-settings-modal dashboard-custom-card-modal" + (customCardSubmitting ? " dashboard-custom-card-modal--streaming" : "")}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button — hidden while streaming */}
            {!customCardSubmitting && (
              <button
                type="button"
                className="dashboard-modal__close"
                onClick={() => {
                  setCustomCardModalOpen(false);
                  setSidebarSteps([]);
                  setSidebarDisplayedCount(0);
                  setSidebarExitingSteps([]);
                  setCustomCardStreamDone(false);
                  setCustomCardError(null);
                }}
                aria-label="Close"
              >
                <HiOutlineXMark size={22} />
              </button>
            )}

            {/* LEFT: prompt form — hidden while streaming */}
            {!customCardSubmitting && !customCardStreamDone && (
              <div className="dashboard-custom-card-modal__left">
                <h2 id="custom-card-title" className="dashboard-settings-modal__title">
                  Create custom insight card
                </h2>
                <p className="dashboard-settings-modal__label">
                  Describe the metric, scenario, or question you want a new card for. The agent will create a card with
                  the same layout as your validation insights.
                </p>
                <form
                  className="dashboard-custom-card-modal__form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setCustomCardError(null);
                    const trimmed = (customCardPrompt || "").trim();
                    if (!trimmed) {
                      setCustomCardError("Please enter a short description for the custom card.");
                      return;
                    }
                    if (!sessionId) {
                      showDashboardToast("Run an analysis first to create custom cards.");
                      return;
                    }
                    setCustomCardSubmitting(true);
                    setSidebarSteps([]);
                    setSidebarDisplayedCount(0);
                    setSidebarExitingSteps([]);
                    setCustomCardStreamDone(false);
                    const addSidebarStep = (variant, message) => {
                      setSidebarSteps((prev) => [...prev, { id: Date.now() + Math.random(), variant, message }]);
                    };
                    try {
                      const res = await fetch(`${API_BASE}/api/custom-cards/stream`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ session_id: sessionId, prompt: trimmed }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        setCustomCardError(data.detail || res.statusText || "Failed to create custom card.");
                        setCustomCardSubmitting(false);
                        return;
                      }
                      const reader = res.body.getReader();
                      const decoder = new TextDecoder();
                      let buffer = "";
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        const chunks = buffer.split("\n");
                        buffer = chunks.pop();
                        for (const chunk of chunks) {
                          if (!chunk.trim()) continue;
                          try {
                            const evt = JSON.parse(chunk);
                            if (evt.type === "progress") {
                              addSidebarStep("info", evt.message);
                            } else if (evt.type === "done" && evt.card) {
                              addSidebarStep("success", "Card created successfully!");
                              setCustomCardStreamDone(true);
                              setCustomCards((prev) => {
                                const newIdx = prev.length;
                                setNewCustomCardIndices((s) => new Set([...s, newIdx]));
                                return [...prev, evt.card];
                              });
                              setActiveInsightsTab("customCard");
                              // Refresh credits after creating custom card
                              refreshCredits();
                              setTimeout(() => {
                                setCustomCardModalOpen(false);
                                setCustomCardPrompt("");
                                setSidebarSteps([]);
                                setSidebarDisplayedCount(0);
                                setSidebarExitingSteps([]);
                                setCustomCardStreamDone(false);
                              }, 1800);
                            } else if (evt.type === "error") {
                              addSidebarStep("error", evt.message || "Failed to create custom card.");
                              setCustomCardError(evt.message || "Failed to create custom card.");
                            }
                          } catch (_) {
                            // skip malformed line
                          }
                        }
                      }
                    } catch (err) {
                      setCustomCardError(err.message || "Failed to reach the server.");
                    } finally {
                      setCustomCardSubmitting(false);
                    }
                  }}
                >
                  <textarea
                    className="dashboard-custom-card-modal__textarea"
                    rows={5}
                    value={customCardPrompt}
                    onChange={(e) => setCustomCardPrompt(e.target.value)}
                    placeholder="Example: Compare this property’s rent to recent leases for similar anchors in this mall and highlight any leverage for a 3-year term."
                  />
                  {customCardError && (
                    <p className="dashboard-custom-card-modal__error" role="alert">
                      {customCardError}
                    </p>
                  )}
                  <div className="dashboard-custom-card-modal__actions">
                    <button
                      type="button"
                      className="dashboard-settings-modal__btn dashboard-settings-modal__btn--secondary"
                      onClick={() => {
                        setCustomCardModalOpen(false);
                        setCustomCardError(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="dashboard-settings-modal__btn dashboard-settings-modal__btn--primary">
                      Generate card
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* RIGHT: AnalysisScreen-style log sidebar — shown while streaming */}
            {customCardSubmitting && (
              <div className="dashboard-custom-card-modal__sidebar">
                <div className="dashboard-custom-card-modal__sidebar-head">
                  <span className="dashboard-custom-card-modal__sidebar-orb" />
                  <div>
                    <p className="dashboard-custom-card-modal__sidebar-title">Research in progress</p>
                    <p className="dashboard-custom-card-modal__sidebar-sub">Agent is analysing your property data...</p>
                  </div>
                </div>

                <div className="analysis-stream-steps">
                  {/* Skeleton placeholders before first real step */}
                  {sidebarDisplayedCount === 0 && (
                    <>
                      <div className="analysis-step--skeleton"><span className="analysis-step__skeleton-icon" /><span className="analysis-step__skeleton-text" /></div>
                      <div className="analysis-step--skeleton"><span className="analysis-step__skeleton-icon" /><span className="analysis-step__skeleton-text" style={{ maxWidth: "140px" }} /></div>
                      <div className="analysis-step--skeleton"><span className="analysis-step__skeleton-icon" /><span className="analysis-step__skeleton-text" style={{ maxWidth: "160px" }} /></div>
                    </>
                  )}

                  {/* Exiting steps */}
                  {sidebarExitingSteps.map((step) => (
                    <div key={step.exitId} className={"analysis-step analysis-step--" + step.variant + " analysis-step--exiting"}>
                      <svg className="analysis-step__icon" stroke="currentColor" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 16h-1v-4h1m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="analysis-step__text analysis-step--completed">{step.message}</p>
                    </div>
                  ))}

                  {/* Visible steps */}
                  {sidebarSteps.slice(
                    Math.max(0, sidebarDisplayedCount - SIDEBAR_MAX_VISIBLE),
                    sidebarDisplayedCount
                  ).map((step, i, arr) => {
                    const isLast = i === arr.length - 1;
                    const stepDone = !isLast || customCardStreamDone;
                    const iconPath = step.variant === "success"
                      ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      : step.variant === "error"
                      ? "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      : "M13 16h-1v-4h1m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
                    return (
                      <div
                        key={step.id}
                        className={"analysis-step analysis-step--" + step.variant + " analysis-step--enter" + (stepDone ? " analysis-step--completed" : "")}
                      >
                        <svg className="analysis-step__icon" stroke="currentColor" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d={iconPath} />
                        </svg>
                        <p className="analysis-step__text">{step.message}</p>
                        {!stepDone && <span className="dashboard-custom-card-modal__step-pulse" />}
                      </div>
                    );
                  })}
                </div>

                {/* Animated progress bar at bottom */}
                <div className="dashboard-custom-card-modal__progress-bar">
                  <div className={"dashboard-custom-card-modal__progress-fill" + (customCardStreamDone ? " dashboard-custom-card-modal__progress-fill--done" : "")} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editModalOpen && editingCard && (() => {
        const closeEdit = () => {
          setEditModalOpen(false);
          setEditingCard(null);
          setEditingSource(null);
          setEditingIndex(null);
          setEditingPrompt('');
          setEditingError(null);
          setEditPhase('form');
          setEditSidebarSteps([]);
          setEditSidebarDisplayedCount(0);
          setEditSidebarExitingSteps([]);
          setEditStreamDone(false);
          setEditUpdatedCard(null);
          setEditConfirming(false);
        };

        const addEditStep = (variant, message) => {
          setEditSidebarSteps((prev) => [...prev, { id: Date.now() + Math.random(), variant, message }]);
        };

        // ── PHASE: streaming ──────────────────────────────────────────────
        if (editPhase === 'streaming') {
          return (
            <div className="dashboard-modal-overlay" role="dialog" aria-modal="true">
              <div className="dashboard-modal dashboard-edit-card-modal dashboard-edit-card-modal--streaming" onClick={(e) => e.stopPropagation()}>
                <div className="dashboard-edit-card-modal__sidebar">
                  <div className="dashboard-custom-card-modal__sidebar-head">
                    <span className="dashboard-custom-card-modal__sidebar-orb" />
                    <div>
                      <p className="dashboard-custom-card-modal__sidebar-title">Refining your card</p>
                      <p className="dashboard-custom-card-modal__sidebar-sub">Agent is applying your changes...</p>
                    </div>
                  </div>
                  <div className="analysis-stream-steps">
                    {editSidebarDisplayedCount === 0 && (
                      <>
                        <div className="analysis-step--skeleton"><span className="analysis-step__skeleton-icon" /><span className="analysis-step__skeleton-text" /></div>
                        <div className="analysis-step--skeleton"><span className="analysis-step__skeleton-icon" /><span className="analysis-step__skeleton-text" style={{ maxWidth: "140px" }} /></div>
                        <div className="analysis-step--skeleton"><span className="analysis-step__skeleton-icon" /><span className="analysis-step__skeleton-text" style={{ maxWidth: "160px" }} /></div>
                      </>
                    )}
                    {editSidebarExitingSteps.map((step) => (
                      <div key={step.exitId} className={"analysis-step analysis-step--" + step.variant + " analysis-step--exiting"}>
                        <svg className="analysis-step__icon" stroke="currentColor" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13 16h-1v-4h1m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="analysis-step__text">{step.message}</p>
                      </div>
                    ))}
                    {editSidebarSteps.slice(
                      Math.max(0, editSidebarDisplayedCount - EDIT_MAX_VISIBLE),
                      editSidebarDisplayedCount
                    ).map((step, i, arr) => {
                      const isLast = i === arr.length - 1;
                      const stepDone = !isLast || editStreamDone;
                      const iconPath = step.variant === "success"
                        ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        : step.variant === "error"
                        ? "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        : "M13 16h-1v-4h1m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
                      return (
                        <div
                          key={step.id}
                          className={"analysis-step analysis-step--" + step.variant + " analysis-step--enter" + (stepDone ? " analysis-step--completed" : "")}
                        >
                          <svg className="analysis-step__icon" stroke="currentColor" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d={iconPath} />
                          </svg>
                          <p className="analysis-step__text">{step.message}</p>
                          {!stepDone && <span className="dashboard-custom-card-modal__step-pulse" />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="dashboard-custom-card-modal__progress-bar">
                    <div className={"dashboard-custom-card-modal__progress-fill" + (editStreamDone ? " dashboard-custom-card-modal__progress-fill--done" : "")} />
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // ── PHASE: compare ────────────────────────────────────────────────
        if (editPhase === 'compare' && editUpdatedCard) {
          const normalizeUrl = (u) => {
            const s = (u || '').trim();
            if (!s) return null;
            return s.startsWith('http://') || s.startsWith('https://') ? s : 'https://' + s;
          };
          const fields = [
            { label: "TITLE", oldVal: editingCard.title || "—", newVal: editUpdatedCard.title || "—", isText: true },
            { label: "INSIGHT", oldVal: editingCard.insight || editingCard.data_evidence || "—", newVal: editUpdatedCard.insight || editUpdatedCard.data_evidence || "—", isText: true },
            { label: "DATA EVIDENCE", oldVal: editingCard.data_evidence || "—", newVal: editUpdatedCard.data_evidence || "—", isText: true },
            { label: "WHY IT MATTERS", oldVal: editingCard.why_it_matters || "—", newVal: editUpdatedCard.why_it_matters || "—", isText: true },
            { label: "SOURCE", oldVal: editingCard.source || "—", newVal: editUpdatedCard.source || "—", isText: true },
            { label: "SOURCE LINK", oldVal: normalizeUrl(editingCard.source_url), newVal: normalizeUrl(editUpdatedCard.source_url), isUrl: true },
            { label: "IMPACT", oldVal: editingCard.impact || "neutral", newVal: editUpdatedCard.impact || "neutral", isText: true },
            { label: "CONFIDENCE", oldVal: (editingCard.confidence_score ?? 0) + "%", newVal: (editUpdatedCard.confidence_score ?? 0) + "%", isText: true },
          ];
          const changedCount = fields.filter((f) => (f.oldVal || "—") !== (f.newVal || "—")).length;
          const renderVal = (f, side) => {
            const val = side === "old" ? f.oldVal : f.newVal;
            const isNew = side === "new" && (f.oldVal || "—") !== (f.newVal || "—");
            if (f.isUrl) {
              return val
                ? <a href={val} target="_blank" rel="noreferrer" className={"dashboard-edit-card-modal__compare-field-val dashboard-edit-card-modal__compare-source-link" + (isNew ? " dashboard-edit-card-modal__compare-field-val--new" : "")}>{val}</a>
                : <span className="dashboard-edit-card-modal__compare-field-val">{side === "old" ? (editingCard.source_url ? editingCard.source_url : "—") : (editUpdatedCard.source_url ? editUpdatedCard.source_url : "—")}</span>;
            }
            return <div className={"dashboard-edit-card-modal__compare-field-val" + (isNew ? " dashboard-edit-card-modal__compare-field-val--new" : "")}>{val || "—"}</div>;
          };
          return (
            <div className="dashboard-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-compare-title">
              <div className="dashboard-modal dashboard-edit-card-modal dashboard-edit-card-modal--compare" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="dashboard-modal__close" onClick={closeEdit} aria-label="Close">
                  <HiOutlineXMark size={22} />
                </button>
                <h2 id="edit-compare-title" className="dashboard-edit-card-modal__compare-title">Review changes</h2>
                <p className="dashboard-edit-card-modal__compare-sub">Compare the original and updated card. Confirm to save or discard to go back.</p>
                <div className="dashboard-edit-card-modal__compare-grid">
                  <div className="dashboard-edit-card-modal__compare-col dashboard-edit-card-modal__compare-col--old">
                    <div className="dashboard-edit-card-modal__compare-col-head">
                      <span className="dashboard-edit-card-modal__compare-col-label">Before</span>
                    </div>
                    {fields.map((f) => {
                      const changed = (f.oldVal || "—") !== (f.newVal || "—");
                      return (
                        <div key={f.label} className={"dashboard-edit-card-modal__compare-field" + (changed ? " dashboard-edit-card-modal__compare-field--changed" : "")}>
                          <div className="dashboard-edit-card-modal__compare-field-label">{f.label}</div>
                          {renderVal(f, "old")}
                        </div>
                      );
                    })}
                  </div>
                  <div className="dashboard-edit-card-modal__compare-col dashboard-edit-card-modal__compare-col--new">
                    <div className="dashboard-edit-card-modal__compare-col-head">
                      <span className="dashboard-edit-card-modal__compare-col-label">After</span>
                      <span className="dashboard-edit-card-modal__compare-changes-badge">
                        {changedCount} change{changedCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {fields.map((f) => {
                      const changed = (f.oldVal || "—") !== (f.newVal || "—");
                      return (
                        <div key={f.label} className={"dashboard-edit-card-modal__compare-field" + (changed ? " dashboard-edit-card-modal__compare-field--changed" : "")}>
                          <div className="dashboard-edit-card-modal__compare-field-label">{f.label}</div>
                          {renderVal(f, "new")}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {editingError && (
                  <p className="dashboard-edit-card-modal__error" role="alert" style={{ marginTop: "8px" }}>{editingError}</p>
                )}
                <div className="dashboard-edit-card-modal__compare-actions">
                  <button
                    type="button"
                    className="dashboard-settings-modal__btn dashboard-settings-modal__btn--secondary"
                    onClick={closeEdit}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="dashboard-settings-modal__btn dashboard-settings-modal__btn--primary"
                    disabled={editConfirming}
                    onClick={async () => {
                      setEditConfirming(true);
                      setEditingError(null);
                      try {
                        const res = await fetch(
                          `${API_BASE}/api/custom-cards/${editingIndex}/confirm`,
                          {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              session_id: sessionId,
                              source: editingSource,
                              updated_card: editUpdatedCard,
                            }),
                          }
                        );
                        if (!res.ok) {
                          const d = await res.json().catch(() => ({}));
                          setEditingError(d.detail || "Failed to save card.");
                          return;
                        }
                        if (editingSource === "validation") {
                          setEditedValidationCards((prev) => {
                            const base = prev !== null ? prev : [...baseCards];
                            const next = [...base];
                            if (editingIndex >= 0 && editingIndex < next.length) next[editingIndex] = editUpdatedCard;
                            return next;
                          });
                        } else {
                          setCustomCards((prev) => {
                            const next = [...prev];
                            if (editingIndex >= 0 && editingIndex < next.length) next[editingIndex] = editUpdatedCard;
                            return next;
                          });
                        }
                        showDashboardToast("Card updated successfully.");
                        // Refresh credits after editing card
                        refreshCredits();
                        closeEdit();
                      } catch (err) {
                        setEditingError(err.message || "Failed to reach the server.");
                      } finally {
                        setEditConfirming(false);
                      }
                    }}
                  >
                    {editConfirming ? "Saving..." : "Confirm & Save"}
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // ── PHASE: form (default) ─────────────────────────────────────────
        return (
          <div className="dashboard-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-card-title">
            <div className="dashboard-modal dashboard-edit-card-modal" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="dashboard-modal__close" onClick={closeEdit} aria-label="Close">
                <HiOutlineXMark size={22} />
              </button>
              <div className="dashboard-edit-card-modal__body">
                <div className="dashboard-edit-card-modal__col dashboard-edit-card-modal__col--left">
                  <h2 id="edit-card-title" className="dashboard-modal__title">{editingCard.title}</h2>
                  <div className={"dashboard-modal__impact dashboard-modal__impact--" + (editingCard.impact || "neutral")}>
                    {(editingCard.impact || "neutral").toUpperCase()} IMPACT
                  </div>
                  <div className="dashboard-modal__section">
                    <div className="dashboard-modal__section-label">WHAT&apos;S THE INSIGHT</div>
                    <div className="dashboard-modal__section-content">
                      <p className="dashboard-modal__evidence-text">{editingCard.insight || editingCard.data_evidence || "—"}</p>
                    </div>
                  </div>
                  <div className="dashboard-modal__section">
                    <div className="dashboard-modal__section-label">DATA EVIDENCE (FROM WHERE)</div>
                    <div className="dashboard-modal__section-content">
                      <p className="dashboard-modal__evidence-text">{editingCard.data_evidence || "No data"}</p>
                    </div>
                  </div>
                  <div className="dashboard-modal__section">
                    <div className="dashboard-modal__section-label dashboard-modal__section-label--blue">WHY IT MATTERS</div>
                    <div className="dashboard-modal__section-content">
                      <p className="dashboard-modal__evidence-text">{editingCard.why_it_matters || "—"}</p>
                    </div>
                  </div>
                  <div className="dashboard-edit-card-modal__meta">
                    <span className="dashboard-modal__source">Source: {editingCard.source || "Not available"}</span>
                    <span className="dashboard-modal__confidence">Confidence: <strong>{editingCard.confidence_score ?? 0}%</strong></span>
                  </div>
                </div>
                <div className="dashboard-edit-card-modal__col dashboard-edit-card-modal__col--right">
                  <h3 className="dashboard-edit-card-modal__title">Refine this card</h3>
                  <p className="dashboard-edit-card-modal__subtitle">
                    Describe what you want to change or emphasize. The agent will update the card while keeping the same structure and fields.
                  </p>
                  <form
                    className="dashboard-edit-card-modal__form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setEditingError(null);
                      const trimmed = (editingPrompt || "").trim();
                      if (!trimmed) { setEditingError("Please describe how you want to refine this card."); return; }
                      if (!sessionId || editingIndex == null || !editingSource) {
                        showDashboardToast("Session not available. Run an analysis again and reopen the card.");
                        return;
                      }
                      setEditingSubmitting(true);
                      setEditPhase("streaming");
                      setEditSidebarSteps([]);
                      setEditSidebarDisplayedCount(0);
                      setEditSidebarExitingSteps([]);
                      setEditStreamDone(false);
                      setEditUpdatedCard(null);
                      try {
                        const res = await fetch(
                          `${API_BASE}/api/custom-cards/${editingIndex}/edit/stream`,
                          {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ session_id: sessionId, prompt: trimmed, source: editingSource }),
                          }
                        );
                        if (!res.ok) {
                          const d = await res.json().catch(() => ({}));
                          setEditingError(d.detail || res.statusText || "Failed to update card.");
                          setEditPhase("form");
                          return;
                        }
                        const reader = res.body.getReader();
                        const decoder = new TextDecoder();
                        let buf = "";
                        while (true) {
                          const { done, value } = await reader.read();
                          if (done) break;
                          buf += decoder.decode(value, { stream: true });
                          const chunks = buf.split("\n");
                          buf = chunks.pop();
                          for (const chunk of chunks) {
                            if (!chunk.trim()) continue;
                            try {
                              const evt = JSON.parse(chunk);
                              if (evt.type === "progress") {
                                addEditStep("info", evt.message);
                              } else if (evt.type === "done") {
                                addEditStep("success", "Changes ready — review below.");
                                setEditStreamDone(true);
                                setEditUpdatedCard(evt.updated);
                                setTimeout(() => { setEditPhase("compare"); }, 900);
                              } else if (evt.type === "error") {
                                addEditStep("error", evt.message || "Failed to update card.");
                                setEditingError(evt.message || "Failed to update card.");
                                setEditPhase("form");
                              }
                            } catch (_) {}
                          }
                        }
                      } catch (err) {
                        setEditingError(err.message || "Failed to reach the server.");
                        setEditPhase("form");
                      } finally {
                        setEditingSubmitting(false);
                      }
                    }}
                  >
                    <textarea
                      className="dashboard-edit-card-modal__textarea"
                      rows={6}
                      value={editingPrompt}
                      onChange={(e) => setEditingPrompt(e.target.value)}
                      placeholder="Example: Emphasize how this gives the tenant leverage on rent, and add clearer numbers for current vs baseline trend."
                    />
                    {editingError && <p className="dashboard-edit-card-modal__error" role="alert">{editingError}</p>}
                    <div className="dashboard-edit-card-modal__actions">
                      <button type="button" className="dashboard-settings-modal__btn dashboard-settings-modal__btn--secondary" onClick={closeEdit}>
                        Cancel
                      </button>
                      <button type="submit" className="dashboard-settings-modal__btn dashboard-settings-modal__btn--primary" disabled={editingSubmitting}>
                        {editingSubmitting ? "Updating..." : "Update card"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
