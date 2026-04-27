import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL, INCOME_TYPES, formatEmbedCurrency, incomeBreakdown, sortPos, uniq } from './embed-shared.jsx';

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 82;
const STROKE_WIDTH = 28;
const ACTIVE_STROKE_WIDTH = 34;
const ACTIVE_OUTLINE_WIDTH = 38;
const HIT_STROKE_WIDTH = 44;
const MIN_BAR_WIDTH = 8;
const SEGMENT_GAP = 2.5;

const FINANCIACION_CHART_CSS = `
  :host{
    display:block;
    min-width:0;
    color:#111827;
  }
  *{box-sizing:border-box}
  .wc-panel{
    display:grid;
    gap:16px;
    padding:16px;
    background:#f8f8f8;
    border-radius:12px;
  }
  .wc-body{
    min-width:0;
  }
  .wc-body--bare{
    display:grid;
    gap:12px;
    min-width:0;
  }
  .loading,.error,.empty{
    padding:14px 0;
    color:#667085;
  }
  .wc-tabs-wrap,.wc-tabs,.wc-tab-item,.wc-tab-link{
    box-sizing:border-box;
  }
  .wc-tabs-wrap{
    margin:0 0 16px;
    overflow-x:auto;
    -webkit-overflow-scrolling:touch;
    scrollbar-width:thin;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans","Liberation Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";
    font-size:1rem;
    font-weight:400;
    line-height:1.5;
    color:#212529;
    -webkit-text-size-adjust:100%;
    -webkit-tap-highlight-color:transparent;
  }
  .wc-tabs{
    display:flex;
    flex-wrap:wrap;
    margin:0;
    padding-left:0;
    list-style:none;
    border-bottom:1px solid #dee2e6;
  }
  .wc-tab-item{
    margin-bottom:-1px;
    flex:none;
    list-style:none;
  }
  .wc-tab-link{
    display:block;
    padding:.5rem 1rem;
    border:1px solid transparent;
    border-top-left-radius:.25rem;
    border-top-right-radius:.25rem;
    background-color:transparent;
    color:inherit;
    font:inherit;
    line-height:1.5;
    text-decoration:none;
    white-space:nowrap;
    transition:color .18s ease,background-color .18s ease,border-color .18s ease;
    cursor:pointer;
  }
  .wc-tab-link:hover,
  .wc-tab-link:focus{
    text-decoration:none;
    border-color:#e9ecef #e9ecef #dee2e6;
  }
  .wc-tab-link:focus-visible{
    outline:2px solid rgba(0,123,255,.35);
    outline-offset:2px;
  }
  .wc-tab-link.active{
    color:#495057;
    background-color:#fff;
    border-color:#dee2e6 #dee2e6 #fff;
  }
  .mf-income-breakdown{
    display:grid;
    grid-template-columns:minmax(200px,236px) minmax(0,1fr);
    gap:28px;
    align-items:center;
    width:100%;
  }
  .mf-income-breakdown__visual{
    display:flex;
    justify-content:center;
  }
  .mf-income-breakdown__donut{
    position:relative;
    width:min(100%,220px);
    aspect-ratio:1;
  }
  .mf-income-breakdown__svg{
    display:block;
    width:100%;
    height:auto;
    overflow:visible;
    animation:mf-income-breakdown-donut-in .24s ease;
  }
  .mf-income-breakdown__center{
    position:absolute;
    inset:0;
    display:grid;
    place-content:center;
    justify-items:center;
    text-align:center;
    padding:24%;
    pointer-events:none;
  }
  .mf-income-breakdown__metric{
    display:grid;
    justify-items:center;
    animation:mf-income-breakdown-center-swap .2s ease;
  }
  .mf-income-breakdown__total{
    font-size:1.15rem;
    font-weight:700;
    line-height:1.05;
    letter-spacing:-.03em;
    color:#344054;
  }
  .mf-income-breakdown__share{
    margin-top:8px;
    font-size:clamp(.88rem,1.35vw,1.02rem);
    font-weight:600;
    line-height:1;
    color:#667085;
  }
  .mf-income-breakdown__list{
    display:grid;
    gap:16px;
    min-width:0;
    width:100%;
  }
  .mf-income-breakdown__item{
    display:grid;
    gap:6px;
    min-width:0;
    padding:0;
    border:0;
    background:transparent;
    text-align:left;
    cursor:pointer;
    transition:opacity .18s ease;
  }
  .mf-income-breakdown__item:focus-visible{
    outline:2px solid rgba(48,137,184,.35);
    outline-offset:4px;
    border-radius:12px;
  }
  .mf-income-breakdown__row{
    display:flex;
    align-items:baseline;
    justify-content:space-between;
    gap:14px;
  }
  .mf-income-breakdown__label,
  .mf-income-breakdown__value{
    font-size:1.02rem;
    line-height:1.2;
    color:#344054;
    letter-spacing:-.6px;
    transition:color .18s ease;
  }
  .mf-income-breakdown__label{
    font-weight:650;
  }
  .mf-income-breakdown__value{
    font-variant-numeric:tabular-nums;
  }
  .mf-income-breakdown__track{
    height:12px;
    border-radius:999px;
    background:#edf2f8;
    overflow:hidden;
    transition:background-color .18s ease,box-shadow .18s ease;
  }
  .mf-income-breakdown__fill{
    height:100%;
    border-radius:999px;
    transition:width .32s ease,filter .18s ease,opacity .18s ease;
  }
  .mf-income-breakdown__item.is-active .mf-income-breakdown__label,
  .mf-income-breakdown__item.is-active .mf-income-breakdown__value{
    color:#111827;
  }
  .mf-income-breakdown__item.is-active .mf-income-breakdown__track{
    background:#e3e9f2;
    box-shadow:inset 0 0 0 1px rgba(17,24,39,.08);
  }
  .mf-income-breakdown__item.is-dimmed{
    opacity:.5;
  }
  .mf-income-breakdown__ring-track{
    stroke:#edf2f8;
  }
  .mf-income-breakdown__segment{
    fill:none;
    stroke-linecap:butt;
    cursor:pointer;
    transition:stroke-dasharray .32s ease,stroke-dashoffset .32s ease,opacity .18s ease,stroke-width .18s ease,filter .18s ease;
  }
  .mf-income-breakdown__segment-outline{
    fill:none;
    stroke:#111827;
    opacity:.75;
    pointer-events:none;
  }
  .mf-income-breakdown__segment.is-active{
    filter:saturate(1.05);
  }
  .mf-income-breakdown__segment.is-dimmed{
    opacity:.5;
  }
  @keyframes mf-income-breakdown-donut-in{
    0%{transform:scale(.94)}
    100%{transform:scale(1)}
  }
  @keyframes mf-income-breakdown-center-swap{
    0%{opacity:.35;transform:translateY(4px)}
    100%{opacity:1;transform:translateY(0)}
  }
  @media (max-width:720px){
    .wc-panel{
      gap:14px;
      padding:14px;
    }
    .wc-tabs-wrap{
      margin-bottom:14px;
    }
    .wc-tab-link{
      padding:.5rem .875rem;
      font-size:.95rem;
    }
    .mf-income-breakdown{
      grid-template-columns:1fr;
      gap:16px;
      width:100%;
    }
    .mf-income-breakdown__visual{
      justify-content:center;
    }
    .mf-income-breakdown__donut{
      width:min(100%,192px);
    }
    .mf-income-breakdown__list{
      gap:14px;
    }
    .mf-income-breakdown__track{
      height:10px;
    }
  }
`;

export function positionOptions(store) {
  return [ALL, ...uniq(store.ingresos.map((row) => row.candidatePosition)).sort(sortPos)];
}

export function FinanciacionChartStyles() {
  return <style>{FINANCIACION_CHART_CSS}</style>;
}

function normalizeBreakdownItems(items) {
  const byKey = new Map(items.map((item) => [item.key, item]));
  return INCOME_TYPES.map((type) => {
    const match = byKey.get(type.key);
    return {
      ...type,
      value: match?.value ?? 0,
      color: match?.color ?? type.color,
    };
  });
}

export function Tabs({ label, value, options, onChange }) {
  return (
    <div className="wc-tabs-wrap">
      <ul className="nav nav-tabs wc-tabs" role="tablist" aria-label={label}>
        {options.map((option) => {
          const active = option === value;
          return (
            <li className="nav-item wc-tab-item" key={option}>
              <button
                type="button"
                className={`nav-link wc-tab-link${active ? ' active' : ''}`}
                role="tab"
                aria-selected={active ? 'true' : 'false'}
                tabIndex={active ? 0 : -1}
                onClick={() => {
                  if (!active) onChange(option);
                }}
              >
                {option}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Segment({ item, active, dimmed, strokeDasharray, strokeDashoffset, onSelect }) {
  function handleSelect(event) {
    event.stopPropagation();
    onSelect();
  }

  return (
    <g
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={handleSelect}
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_STROKE_WIDTH}
        style={{
          cursor: 'pointer',
          strokeDasharray,
          strokeDashoffset,
          pointerEvents: 'stroke',
        }}
      />
      {active ? (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          strokeWidth={ACTIVE_OUTLINE_WIDTH}
          className="mf-income-breakdown__segment-outline"
          style={{
            strokeDasharray,
            strokeDashoffset,
          }}
        />
      ) : null}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke={item.color}
        strokeWidth={active ? ACTIVE_STROKE_WIDTH : STROKE_WIDTH}
        className={`mf-income-breakdown__segment${active ? ' is-active' : ''}${dimmed ? ' is-dimmed' : ''}`}
        role="button"
        tabIndex={0}
        aria-pressed={active ? 'true' : 'false'}
        aria-label={`${item.label}: ${formatEmbedCurrency(item.value, 0)} (${Math.round(item.ratio * 100)}%)`}
        style={{
          strokeDasharray,
          strokeDashoffset,
          pointerEvents: 'none',
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onSelect();
          }
        }}
      />
    </g>
  );
}

export function IncomeBreakdownChart({ items }) {
  const rootRef = useRef(null);
  const rows = useMemo(() => normalizeBreakdownItems(items), [items]);
  const total = useMemo(() => rows.reduce((acc, item) => acc + (+item.value || 0), 0), [rows]);
  const [activeKey, setActiveKey] = useState(null);

  const preparedRows = useMemo(() => {
    if (!(total > 0)) return [];
    return rows.map((item) => ({ ...item, ratio: (+item.value || 0) / total }));
  }, [rows, total]);

  useEffect(() => {
    if (!activeKey) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setActiveKey(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [activeKey]);

  if (!(total > 0)) return <div className="empty">Sin datos.</div>;

  const activeItem = preparedRows.find((item) => item.key === activeKey) || null;
  const displayValue = activeItem ? activeItem.value : total;
  const displayShare = activeItem ? Math.round(activeItem.ratio * 100) : 100;
  const hasSelection = !!activeItem;
  const circumference = 2 * Math.PI * RADIUS;
  const gap = preparedRows.filter((item) => item.ratio > 0).length > 1 ? SEGMENT_GAP : 0;
  let offset = 0;

  return (
    <div className="mf-income-breakdown" ref={rootRef}>
      <div
        className="mf-income-breakdown__visual"
        onClick={() => {
          if (hasSelection) setActiveKey(null);
        }}
      >
        <div className="mf-income-breakdown__donut">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mf-income-breakdown__svg"
            role="img"
            aria-label={`Distribución de ingresos. Total ${formatEmbedCurrency(total, 0)}.`}
          >
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="#edf2f8"
              strokeWidth={STROKE_WIDTH}
              className="mf-income-breakdown__ring-track"
            />
            <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
              {preparedRows.map((item) => {
                const segment = item.ratio * circumference;
                const visible = Math.max(0, segment - gap);
                const segmentOffset = offset;
                offset += segment;
                const active = item.key === activeItem?.key;
                const dimmed = hasSelection && !active;
                return (
                  <Segment
                    key={item.key}
                    item={item}
                    active={active}
                    dimmed={dimmed}
                    strokeDasharray={`${visible} ${Math.max(0, circumference - visible)}`}
                    strokeDashoffset={-segmentOffset}
                    onSelect={() => setActiveKey(item.key)}
                  />
                );
              })}
            </g>
          </svg>
          <div className="mf-income-breakdown__center">
            <div className="mf-income-breakdown__metric" key={activeItem?.key || `total-${total}`}>
              <div className="mf-income-breakdown__total">{formatEmbedCurrency(displayValue, 0)}</div>
              <div className="mf-income-breakdown__share">{displayShare}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mf-income-breakdown__list">
        {preparedRows.map((item) => {
          const active = item.key === activeItem?.key;
          const dimmed = hasSelection && !active;
          return (
            <button
              key={item.key}
              type="button"
              className={`mf-income-breakdown__item${active ? ' is-active' : ''}${dimmed ? ' is-dimmed' : ''}`}
              aria-pressed={active ? 'true' : 'false'}
              onClick={() => setActiveKey(item.key)}
            >
              <div className="mf-income-breakdown__row">
                <div className="mf-income-breakdown__label">{item.label}</div>
                <div className="mf-income-breakdown__value">{formatEmbedCurrency(item.value, 0)}</div>
              </div>
              <div className="mf-income-breakdown__track">
                <div
                  className="mf-income-breakdown__fill"
                  style={{
                    width: item.ratio > 0 ? `max(${item.ratio * 100}%, ${MIN_BAR_WIDTH}px)` : '0%',
                    background: item.color,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FinanciacionChartElementApp({ element, store, loading = false, error = null }) {
  const position = element?.getAttribute('position') || ALL;
  const options = store ? positionOptions(store) : [ALL];
  const breakdown = store
    ? incomeBreakdown(
        position === ALL ? store.ingresos : store.ingresos.filter((row) => row.candidatePosition?.trim() === position),
      )
    : [];

  return (
    <>
      <FinanciacionChartStyles />
      <section className="wc-panel">
        <h4>Financiación por tipo</h4>
        <div className="wc-body wc-body--bare">
          {loading ? <div className="loading">Cargando…</div> : null}
          {!loading && error ? <div className="error">{error}</div> : null}
          {!loading && !error && store ? (
            <>
              <Tabs
                label="Cobertura"
                value={position}
                options={options}
                onChange={(value) => element.applyAttrs({ position: value })}
              />
              <IncomeBreakdownChart items={breakdown} />
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}
