import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
} from 'react-icons/hi2';
import './Dashboard.css';

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
  const evidence = (card.data_evidence || '').trim();
  if (evidence.length === 0 || NO_DATA_PLACEHOLDERS.test(evidence)) return false;
  return true;
}

function InsightCardTile({ card, onViewEvidence }) {
  const impactClass = card.impact === 'positive' ? 'positive' : card.impact === 'negative' ? 'negative' : 'neutral';
  const impactLabel = card.impact === 'positive' ? 'POSITIVE' : card.impact === 'negative' ? 'NEGATIVE' : 'NEUTRAL';
  const summary = (card.insight || card.data_evidence)?.slice(0, 80) || card.why_it_matters?.slice(0, 80) || '';
  const IconComponent = getIconForTitle(card.title);
  const TrendIcon = impactClass === 'positive' ? HiOutlineArrowTrendingUp : impactClass === 'negative' ? HiOutlineArrowTrendingDown : null;

  return (
    <div className={`dashboard-insight-tile dashboard-insight-tile--${impactClass}`}>
      <div className="dashboard-insight-tile__head">
        <div className="dashboard-insight-tile__icon" aria-hidden>
          <IconComponent className="dashboard-insight-tile__icon-svg" size={22} />
        </div>
        <span className={`dashboard-insight-tile__badge dashboard-insight-tile__badge--${impactClass}`}>
          {TrendIcon && <TrendIcon className="dashboard-insight-tile__badge-icon" size={12} />}
          {impactLabel}
        </span>
      </div>
      <h3 className="dashboard-insight-tile__title">{card.title}</h3>
      <p className="dashboard-insight-tile__summary">{summary}{summary.length >= 80 ? '…' : ''}</p>
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
  const [integrations, setIntegrations] = useState({ costar: true, yardi: false, reonomy: false });
  const [documents, setDocuments] = useState([]);
  // Default: OpenAI. Only one provider can be enabled. Stored value applied when modal opens.
  const [openaiEnabled, setOpenaiEnabled] = useState(true);
  const [anthropicEnabled, setAnthropicEnabled] = useState(false);
  const [llmProviderModalOpen, setLlmProviderModalOpen] = useState(false);
  const [llmProviderModalMessage, setLlmProviderModalMessage] = useState('');
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('lg_llm_provider') : null;
    if (stored === 'openai') {
      setOpenaiEnabled(true);
      setAnthropicEnabled(false);
    } else {
      setOpenaiEnabled(true);
      setAnthropicEnabled(false);
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem('lg_llm_provider', 'openai');
      } catch (_) {}
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

  const toggleIntegration = (key) => {
    setIntegrations((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenAIToggle = () => {
    if (!openaiEnabled && anthropicEnabled) {
      setLlmProviderModalMessage('You can enable only one provider. Disable Anthropic first or keep the current selection.');
      setLlmProviderModalOpen(true);
      return;
    }
    setOpenaiEnabled(!openaiEnabled);
    if (!openaiEnabled) setAnthropicEnabled(false);
  };

  const handleAnthropicToggle = () => {
    if (!anthropicEnabled && openaiEnabled) {
      setLlmProviderModalMessage('You can enable only one provider. Disable OpenAI first or keep the current selection.');
      setLlmProviderModalOpen(true);
      return;
    }
    setAnthropicEnabled(!anthropicEnabled);
    if (!anthropicEnabled) setOpenaiEnabled(false);
  };

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
    if (openaiEnabled && anthropicEnabled) {
      setLlmProviderModalMessage('Please enable only one provider.');
      setLlmProviderModalOpen(true);
      return;
    }
    if (!openaiEnabled && !anthropicEnabled) {
      setLlmProviderModalMessage('Please enable at least one provider (OpenAI or Anthropic).');
      setLlmProviderModalOpen(true);
      return;
    }
    const provider = anthropicEnabled ? 'anthropic' : 'openai';
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lg_llm_provider', provider);
      }
    } catch {
      // ignore storage errors
    }
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

        <section className="dashboard-settings-modal__section">
          <h3 className="dashboard-settings-modal__section-title">AI Provider</h3>
          <p className="dashboard-settings-modal__helper">
            Enable one provider only. Changes apply when you click Save.
          </p>
          <div className="dashboard-settings-modal__integrations">
            <div className="dashboard-settings-modal__integration">
              <span className="dashboard-settings-modal__integration-name">OpenAI</span>
              <button
                type="button"
                role="switch"
                aria-checked={openaiEnabled}
                className={`dashboard-settings-modal__toggle ${openaiEnabled ? 'dashboard-settings-modal__toggle--on' : ''}`}
                onClick={handleOpenAIToggle}
              >
                <span className="dashboard-settings-modal__toggle-thumb" />
              </button>
            </div>
            <div className="dashboard-settings-modal__integration">
              <span className="dashboard-settings-modal__integration-name">Anthropic (Claude)</span>
              <button
                type="button"
                role="switch"
                aria-checked={anthropicEnabled}
                className={`dashboard-settings-modal__toggle ${anthropicEnabled ? 'dashboard-settings-modal__toggle--on' : ''}`}
                onClick={handleAnthropicToggle}
              >
                <span className="dashboard-settings-modal__toggle-thumb" />
              </button>
            </div>
          </div>
        </section>

        {llmProviderModalOpen && (
          <div className="dashboard-modal-overlay" style={{ zIndex: 10001 }} onClick={() => setLlmProviderModalOpen(false)} role="dialog" aria-modal="true">
            <div className="dashboard-settings-modal dashboard-settings-modal--alert" onClick={e => e.stopPropagation()}>
              <p className="dashboard-settings-modal__alert-text">{llmProviderModalMessage}</p>
              <button type="button" className="dashboard-settings-modal__btn dashboard-settings-modal__btn--primary" onClick={() => setLlmProviderModalOpen(false)}>
                OK
              </button>
            </div>
          </div>
        )}

        <section className="dashboard-settings-modal__section">
          <h3 className="dashboard-settings-modal__section-title">Integrations</h3>
          <div className="dashboard-settings-modal__integrations">
            <div className="dashboard-settings-modal__integration">
              <div className="dashboard-settings-modal__integration-icon dashboard-settings-modal__integration-icon--costar">C</div>
              <span className="dashboard-settings-modal__integration-name">CoStar</span>
              <button
                type="button"
                role="switch"
                aria-checked={integrations.costar}
                className={`dashboard-settings-modal__toggle ${integrations.costar ? 'dashboard-settings-modal__toggle--on' : ''}`}
                onClick={() => toggleIntegration('costar')}
              >
                <span className="dashboard-settings-modal__toggle-thumb" />
              </button>
            </div>
            <div className="dashboard-settings-modal__integration">
              <div className="dashboard-settings-modal__integration-icon dashboard-settings-modal__integration-icon--yardi">Y</div>
              <span className="dashboard-settings-modal__integration-name">Yardi</span>
              <button
                type="button"
                role="switch"
                aria-checked={integrations.yardi}
                className={`dashboard-settings-modal__toggle ${integrations.yardi ? 'dashboard-settings-modal__toggle--on' : ''}`}
                onClick={() => toggleIntegration('yardi')}
              >
                <span className="dashboard-settings-modal__toggle-thumb" />
              </button>
            </div>
            <div className="dashboard-settings-modal__integration">
              <div className="dashboard-settings-modal__integration-icon dashboard-settings-modal__integration-icon--reonomy">R</div>
              <span className="dashboard-settings-modal__integration-name">Reonomy</span>
              <button
                type="button"
                role="switch"
                aria-checked={integrations.reonomy}
                className={`dashboard-settings-modal__toggle ${integrations.reonomy ? 'dashboard-settings-modal__toggle--on' : ''}`}
                onClick={() => toggleIntegration('reonomy')}
              >
                <span className="dashboard-settings-modal__toggle-thumb" />
              </button>
            </div>
          </div>
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
    if (!sessionId || state.dashboardSummary) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/analyze/dashboard?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setRestoredData(data);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [sessionId, state.dashboardSummary]);

  const dashboardSummary = state.dashboardSummary || restoredSummary || {};
  const allCards = dedupeCardsByTitle(state.cards?.length ? state.cards : restoredCards);
  const cards = allCards.filter(hasCardData);
  const property = state.property || dashboardSummary?.property || restoredProperty || {};

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

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  // Scroll chat to bottom when new message or thinking indicator appears
  useEffect(() => {
    const el = chatMessagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight - el.clientHeight;
  }, [chatMessages, chatLoading]);

  const sendChatMessage = async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    setChatMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setChatInput('');
    if (!sessionId) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: trimmed, llm_provider: llmProvider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChatMessages((prev) => [...prev, { role: 'assistant', text: data.detail || res.statusText || 'Request failed.' }]);
        return;
      }
      const reply = data.reply || 'No response.';
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

  if (!property.name && !dashboardSummary.fair_market_rent) {
    return (
      <div className="dashboard">
        <div className="dashboard-empty">
          <p>No dashboard data. Run an analysis first.</p>
          <Link to="/">Go to form</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-navbar">
        <div className="dashboard-navbar__left">
          <LogoIcon />
          <span className="dashboard-navbar__name">LegalGraph.AI</span>
        </div>
        <div className="dashboard-navbar__right">
          <button type="button" className="dashboard-navbar__settings" onClick={() => setSettingsModalOpen(true)} aria-label="Open settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
            Settings
          </button>
          <div className="dashboard-navbar__user">
            <div className="dashboard-navbar__user-text">
              <span className="dashboard-navbar__user-name">Rajat Sharma</span>
              <span className="dashboard-navbar__user-role">LegalGraph Admin</span>
            </div>
            <div className="dashboard-navbar__avatar" aria-hidden>RS</div>
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
            <button type="button" className="dashboard-btn dashboard-btn--outline">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>
              Report
            </button>
            <button
              type="button"
              className="dashboard-btn dashboard-btn--outline dashboard-btn--assistant"
              onClick={() => setChatPanelOpen(true)}
              aria-label="Ask LegalGraph"
            >
              <HiOutlineChatBubbleLeftRight size={18} />
              Ask LegalGraph
            </button>
            <button type="button" className="dashboard-btn dashboard-btn--primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" /></svg>
              Share
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

        {cards.length > 0 && (
        <section className={`dashboard-insights ${insightsExpanded ? 'dashboard-insights--expanded' : ''}`}>
          <div className="dashboard-insights__head">
            <h2 className="dashboard-insights__title">
              <span className="dashboard-insights__title-icon">
                <HiOutlineSparkles size={20} />
              </span>
              Validation Insights
            </h2>
            <span className="dashboard-insights__sources">Total Sources: {cards.length}</span>
          </div>
          <div className="dashboard-insights__filters" role="group" aria-label="Filter by impact">
            <button
              type="button"
              className={`dashboard-insights__filter ${insightImpactFilter === 'all' ? 'dashboard-insights__filter--active' : ''}`}
              onClick={() => setInsightImpactFilter('all')}
            >
              All
            </button>
            {countByImpact.positive > 0 && (
              <button
                type="button"
                className={`dashboard-insights__filter dashboard-insights__filter--positive ${insightImpactFilter === 'positive' ? 'dashboard-insights__filter--active' : ''}`}
                onClick={() => setInsightImpactFilter('positive')}
              >
                Positive <span className="dashboard-insights__filter-count">({countByImpact.positive})</span>
              </button>
            )}
            {countByImpact.neutral > 0 && (
              <button
                type="button"
                className={`dashboard-insights__filter dashboard-insights__filter--neutral ${insightImpactFilter === 'neutral' ? 'dashboard-insights__filter--active' : ''}`}
                onClick={() => setInsightImpactFilter('neutral')}
              >
                Neutral <span className="dashboard-insights__filter-count">({countByImpact.neutral})</span>
              </button>
            )}
            {countByImpact.negative > 0 && (
              <button
                type="button"
                className={`dashboard-insights__filter dashboard-insights__filter--negative ${insightImpactFilter === 'negative' ? 'dashboard-insights__filter--active' : ''}`}
                onClick={() => setInsightImpactFilter('negative')}
              >
                Negative <span className="dashboard-insights__filter-count">({countByImpact.negative})</span>
              </button>
            )}
          </div>
          <div className="dashboard-insights-grid">
            {displayCards.map((card, i) => (
              <InsightCardTile key={`${card.title}-${i}`} card={card} onViewEvidence={setEvidenceCard} />
            ))}
          </div>
          {hasMore && (
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
    </div>
  );
}
