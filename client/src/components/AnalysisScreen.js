import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { InsightCardTile, EvidenceModal } from './Dashboard';
import './Dashboard.css';
import './AnalysisScreen.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

/** Keep first occurrence per title (case-insensitive) to avoid duplicate insight cards. */
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

export default function AnalysisScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState('connecting');
  const [streamSteps, setStreamSteps] = useState([]);
  const [displayedStepCount, setDisplayedStepCount] = useState(0);
  const [cards, setCards] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);
  const [evidenceCard, setEvidenceCard] = useState(null);
  const [showLess, setShowLess] = useState(false);
  const streamRef = useRef({ cards: [], dashboardSummary: null });
  const prevDisplayedCountRef = useRef(0);
  const [exitingSteps, setExitingSteps] = useState([]);
  const [redirectCountdown, setRedirectCountdown] = useState(null);
  const STEP_REVEAL_MS = 320;
  const MAX_VISIBLE_LOGS = 5;
  const LOG_EXIT_MS = 450;

  const addStep = useCallback((variant, message) => {
    setStreamSteps((prev) => [...prev, { id: Date.now() + Math.random(), variant, message }]);
  }, []);

  // Reveal steps one after the other
  useEffect(() => {
    if (streamSteps.length <= displayedStepCount) return;
    const timer = setTimeout(() => {
      const nextCount = Math.min(displayedStepCount + 1, streamSteps.length);
      if (nextCount > MAX_VISIBLE_LOGS && displayedStepCount >= MAX_VISIBLE_LOGS) {
        const leavingStep = streamSteps[displayedStepCount - MAX_VISIBLE_LOGS];
        if (leavingStep) {
          setExitingSteps((prev) => [...prev, { ...leavingStep, exitId: leavingStep.id }]);
          setTimeout(() => {
            setExitingSteps((prev) => prev.filter((s) => s.exitId !== leavingStep.id));
          }, LOG_EXIT_MS);
        }
      }
      setDisplayedStepCount(nextCount);
      prevDisplayedCountRef.current = nextCount;
    }, STEP_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [streamSteps, streamSteps.length, displayedStepCount]);

  // When done or error, show all steps immediately and clear exiting
  useEffect(() => {
    if (status === 'done' || status === 'error') {
      setDisplayedStepCount(streamSteps.length);
      setExitingSteps([]);
    }
  }, [status, streamSteps.length]);

  // 5-second redirect countdown when done
  useEffect(() => {
    if (status !== 'done') {
      setRedirectCountdown(null);
      return;
    }
    setRedirectCountdown(5);
    const id = setInterval(() => {
      setRedirectCountdown((c) => (c === null || c <= 1 ? null : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  const processStream = useCallback(async () => {
    if (!sessionId) {
      setError('Missing session_id');
      setStatus('error');
      return;
    }
    setStatus('streaming');
    addStep('info', 'Connecting to your research…');

    try {
      const res = await fetch(`${API_BASE}/api/analyze/stream?session_id=${encodeURIComponent(sessionId)}`);
      if (!res.ok) {
        throw new Error(res.statusText || 'Stream failed');
      }
      addStep('success', 'Connected. Gathering market data and rent insights…');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed);
            if (event.type === 'progress') {
              addStep('info', event.message || 'Working on it…');
            } else if (event.type === 'cards') {
              const newCards = event.cards || [];
              streamRef.current.cards = dedupeCardsByTitle([...streamRef.current.cards, ...newCards]);
              setCards(streamRef.current.cards);
              const n = newCards.length;
              addStep('success', n === 1 ? 'Found 1 new insight.' : `Found ${n} new insights.`);
            } else if (event.type === 'dashboard') {
              streamRef.current.dashboardSummary = event.data || null;
              setDashboardData(streamRef.current.dashboardSummary);
              addStep('success', 'Summary ready for your dashboard.');
            } else if (event.type === 'done') {
              setStatus('done');
              addStep('success', 'All set. Taking you to the dashboard…');
              const summary = streamRef.current.dashboardSummary;
              const allCards = streamRef.current.cards;
              setTimeout(() => {
                navigate('/dashboard', { state: { dashboardSummary: summary, cards: allCards, property: summary?.property, sessionId } });
              }, 5000);
            } else if (event.type === 'error') {
              setError(event.message || 'Unknown error');
              setStatus('error');
              addStep('error', event.message || 'Error');
            }
          } catch (_) {}
        }
      }
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim());
          if (event.type === 'cards') {
            streamRef.current.cards = dedupeCardsByTitle([...streamRef.current.cards, ...(event.cards || [])]);
            setCards(streamRef.current.cards);
            addStep('success', 'Insights received.');
          }
          if (event.type === 'dashboard') {
            streamRef.current.dashboardSummary = event.data || null;
            setDashboardData(streamRef.current.dashboardSummary);
          }
          if (event.type === 'done') {
            setStatus('done');
            addStep('success', 'Taking you to the dashboard…');
            setTimeout(() => {
              navigate('/dashboard', { state: { dashboardSummary: streamRef.current.dashboardSummary, cards: streamRef.current.cards, property: streamRef.current.dashboardSummary?.property, sessionId } });
            }, 5000);
          }
        } catch (_) {}
      }
    } catch (err) {
      setError(err.message || 'Stream error');
      setStatus('error');
      addStep('error', err.message || 'Connection error');
    }
  }, [sessionId, addStep]);

  useEffect(() => {
    if (sessionId && status === 'connecting') {
      processStream();
    }
  }, [sessionId, status, processStream]);

  if (!sessionId) {
    return (
      <div className="analysis-screen">
        <div className="analysis-error">
          <p>Missing session. Please start from the form.</p>
          <Link to="/">Back to form</Link>
        </div>
      </div>
    );
  }

  const displayCards = showLess ? cards.slice(0, 6) : cards;
  const hasMore = cards.length > 6;

  return (
    <div className="analysis-screen">
      <header className="analysis-header">
        <Link to="/" className="analysis-header__back" aria-label="Back to form">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="analysis-header__text">
          <h1 className="analysis-header__title">
            {status === 'done' ? 'Your insights are ready' : 'Research in progress'}
          </h1>
          {status !== 'done' && status !== 'error' && (
            <p className="analysis-header__subtitle">
              Your research agent is gathering market data and validating rent factors. This usually takes a minute.
            </p>
          )}
        </div>
      </header>

      <div className="analysis-layout">
        <aside className="analysis-sidebar">
          <div className="analysis-sidebar__head">
            <h3 className="analysis-sidebar__title">
              {status === 'done' ? 'Completed' : 'Progress'}
            </h3>
            {cards.length > 0 && (
              <div className="analysis-sidebar__count" aria-live="polite">
                {cards.length} insight{cards.length !== 1 ? 's' : ''} received
              </div>
            )}
          </div>
          {status !== 'done' && status !== 'error' && (
            <div className="analysis-loader-wrap">
              <div className="analysis-loader" aria-hidden />
              <span className="analysis-loader-label">Analyzing…</span>
            </div>
          )}
          <div className="analysis-stream-steps">
            {status !== 'done' && status !== 'error' && displayedStepCount === 0 && streamSteps.length === 0 && (
              <>
                <div className="analysis-step analysis-step--skeleton" aria-hidden>
                  <span className="analysis-step__skeleton-icon" />
                  <span className="analysis-step__skeleton-text" />
                </div>
                <div className="analysis-step analysis-step--skeleton" aria-hidden>
                  <span className="analysis-step__skeleton-icon" />
                  <span className="analysis-step__skeleton-text" />
                </div>
                <div className="analysis-step analysis-step--skeleton" aria-hidden>
                  <span className="analysis-step__skeleton-icon" />
                  <span className="analysis-step__skeleton-text" />
                </div>
              </>
            )}
            {exitingSteps.map((step) => (
              <div
                key={step.exitId || step.id}
                role="alert"
                className={`analysis-step analysis-step--${step.variant} analysis-step--exiting`}
                aria-hidden
              >
                <svg className="analysis-step__icon" stroke="currentColor" viewBox="0 0 24 24" fill="none">
                  <path d="M13 16h-1v-4h1m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
                <p className="analysis-step__text">{step.message}</p>
              </div>
            ))}
            {streamSteps.slice(0, displayedStepCount).slice(-MAX_VISIBLE_LOGS).map((step, index, arr) => {
              const isCompleted = index < arr.length - 1;
              const isNewest = index === arr.length - 1;
              return (
                <div
                  key={step.id}
                  role="alert"
                  className={`analysis-step analysis-step--${step.variant} ${isNewest ? 'analysis-step--enter' : ''} ${isCompleted ? 'analysis-step--completed' : ''}`}
                >
                  <svg className="analysis-step__icon" stroke="currentColor" viewBox="0 0 24 24" fill="none">
                    <path d="M13 16h-1v-4h1m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                  <p className="analysis-step__text">{step.message}</p>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="analysis-main">
          {error && (
            <div className="analysis-message analysis-message--error" role="alert">
              {error}
            </div>
          )}
          {status === 'done' && cards.length > 0 && (
            <p className="analysis-message analysis-message--success">
              All insight cards ready. Click “View Evidence” on any card for details.
            </p>
          )}
          <section className={`analysis-cards-wrap ${cards.length > 0 ? 'analysis-cards-wrap--has-cards' : ''}`}>
            <div className="dashboard-insights-grid analysis-stream-grid">
              {displayCards.map((card, i) => (
                <InsightCardTile
                  key={`${card.title}-${i}`}
                  card={card}
                  onViewEvidence={setEvidenceCard}
                />
              ))}
            </div>
          </section>
          {hasMore && (
            <div className="analysis-show-less-wrap">
              <button
                type="button"
                className="analysis-show-less"
                onClick={() => setShowLess((v) => !v)}
              >
                {showLess ? 'Show more' : 'Show less'} {showLess ? '▴' : '▾'}
              </button>
            </div>
          )}
        </main>
      </div>
      {status === 'done' && redirectCountdown != null && redirectCountdown > 0 && (
        <div className="analysis-redirect-overlay" aria-live="polite" aria-busy="true">
          <div className="analysis-redirect-loader">
            <div className="analysis-redirect-dots">
              <div className="analysis-redirect-dot analysis-redirect-dot--1" aria-hidden />
              <div className="analysis-redirect-dot analysis-redirect-dot--2" aria-hidden />
              <div className="analysis-redirect-dot analysis-redirect-dot--3" aria-hidden />
            </div>
            <p className="analysis-redirect-loader__text">
            Adding the insights into dashboard…
            </p>
          </div>
        </div>
      )}
      <EvidenceModal card={evidenceCard} onClose={() => setEvidenceCard(null)} />
    </div>
  );
}
