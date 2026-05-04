import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL, INCOME_TYPES, TEXT, formatEmbedCurrency, num } from './embed-shared.jsx';
import { FinanciacionChartStyles, Tabs, positionOptions } from './financiacion-chart-element.jsx';

const TOP_COUNT = 5;
const REST_KEY = '__rest__';
const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 82;
const STROKE_WIDTH = 28;
const ACTIVE_STROKE_WIDTH = 34;
const ACTIVE_OUTLINE_WIDTH = 38;
const HIT_STROKE_WIDTH = 44;
const SEGMENT_GAP = 2.5;
const MIN_BAR_WIDTH = 12;
const DONOR_COLORS = ['#2563eb', '#0f766e', '#d97706', '#dc2626', '#0891b2'];
const REST_COLOR = '#d0d5dd';

const TOP_DONANTES_CHART_CSS = `
  .mf-top-donor-breakdown{
    display:grid;
    grid-template-columns:minmax(200px,236px) minmax(0,1fr);
    gap:28px;
    align-items:start;
    width:100%;
  }
  .mf-top-donor-breakdown__visual{
    display:flex;
    justify-content:center;
  }
  .mf-top-donor-breakdown__donut{
    position:relative;
    width:min(100%,220px);
    aspect-ratio:1;
  }
  .mf-top-donor-breakdown__svg{
    display:block;
    width:100%;
    height:auto;
    overflow:visible;
  }
  .mf-top-donor-breakdown__center{
    position:absolute;
    inset:0;
    display:grid;
    place-content:center;
    justify-items:center;
    text-align:center;
    gap:8px;
    padding:22%;
    pointer-events:none;
  }
  .mf-top-donor-breakdown__eyebrow{
    font-size:.78rem;
    line-height:1.2;
    font-weight:700;
    letter-spacing:.02em;
    color:#667085;
    text-transform:uppercase;
  }
  .mf-top-donor-breakdown__total{
    font-size:1.15rem;
    line-height:1.05;
    font-weight:700;
    letter-spacing:-.03em;
    color:#344054;
  }
  .mf-top-donor-breakdown__share{
    font-size:.92rem;
    line-height:1;
    font-weight:600;
    color:#667085;
  }
  .mf-top-donor-breakdown__list{
    display:grid;
    gap:14px;
    min-width:0;
  }
  .mf-top-donor-breakdown__item{
    display:grid;
    gap:8px;
    min-width:0;
    padding:0;
    border:0;
    background:transparent;
    text-align:left;
    cursor:pointer;
    transition:opacity .18s ease;
  }
  .mf-top-donor-breakdown__item:focus-visible{
    outline:2px solid rgba(48,137,184,.35);
    outline-offset:4px;
    border-radius:12px;
  }
  .mf-top-donor-breakdown__item.is-dimmed{
    opacity:.48;
  }
  .mf-top-donor-breakdown__row{
    display:flex;
    align-items:baseline;
    justify-content:space-between;
    gap:14px;
  }
  .mf-top-donor-breakdown__label,
  .mf-top-donor-breakdown__value{
    font-size:1rem;
    line-height:1.2;
    color:#344054;
    letter-spacing:-.02em;
  }
  .mf-top-donor-breakdown__label{
    font-weight:650;
  }
  .mf-top-donor-breakdown__value{
    font-variant-numeric:tabular-nums;
  }
  .mf-top-donor-breakdown__bar{
    display:flex;
    align-items:center;
    width:100%;
    height:14px;
    border-radius:999px;
    overflow:hidden;
    background:#edf2f8;
    box-shadow:inset 0 0 0 1px rgba(17,24,39,.04);
  }
  .mf-top-donor-breakdown__bar-fill{
    display:flex;
    height:100%;
    border-radius:999px;
    overflow:hidden;
    min-width:0;
    transition:width .28s ease,opacity .18s ease;
  }
  .mf-top-donor-breakdown__segment-bar{
    height:100%;
    min-width:0;
    transition:filter .18s ease,opacity .18s ease,width .28s ease;
  }
  .mf-top-donor-breakdown__segment-bar:first-child{
    border-top-left-radius:999px;
    border-bottom-left-radius:999px;
  }
  .mf-top-donor-breakdown__segment-bar:last-child{
    border-top-right-radius:999px;
    border-bottom-right-radius:999px;
  }
  .mf-top-donor-breakdown__item.is-active .mf-top-donor-breakdown__label,
  .mf-top-donor-breakdown__item.is-active .mf-top-donor-breakdown__value{
    color:#111827;
  }
  .mf-top-donor-breakdown__item.is-active .mf-top-donor-breakdown__bar{
    box-shadow:inset 0 0 0 1px rgba(17,24,39,.12);
  }
  .mf-top-donor-breakdown__segment{
    fill:none;
    stroke-linecap:butt;
    transition:stroke-dasharray .32s ease,stroke-dashoffset .32s ease,opacity .18s ease,stroke-width .18s ease,filter .18s ease;
  }
  .mf-top-donor-breakdown__segment.is-clickable{
    cursor:pointer;
  }
  .mf-top-donor-breakdown__segment.is-active{
    filter:saturate(1.04);
  }
  .mf-top-donor-breakdown__segment.is-dimmed,
  .mf-top-donor-breakdown__item.is-dimmed .mf-top-donor-breakdown__segment-bar{
    opacity:.5;
  }
  .mf-top-donor-breakdown__segment-outline{
    fill:none;
    stroke:#111827;
    opacity:.75;
    pointer-events:none;
  }
  .mf-top-donor-breakdown__note{
    margin:0;
    font-size:.88rem;
    line-height:1.35;
    color:#667085;
  }
  @media (min-width:1100px){
    .mf-top-donor-breakdown{
      margin-inline:auto;
      padding-inline:18%;
    }
  }
  @media (max-width:720px){
    .mf-top-donor-breakdown{
      grid-template-columns:1fr;
      gap:16px;
      width:100%;
    }
    .mf-top-donor-breakdown__visual{
      justify-content:center;
    }
    .mf-top-donor-breakdown__donut{
      width:min(100%,192px);
    }
    .mf-top-donor-breakdown__list{
      gap:12px;
    }
    .mf-top-donor-breakdown__bar{
      height:12px;
    }
  }
`;

function coverageLabel(position) {
  return position === ALL ? 'Total' : position;
}

function candidateStackLabel(row, position) {
  const name = TEXT(row?.candidateName) || 'Sin candidatura';
  const rowPosition = TEXT(row?.candidatePosition);
  if (position !== ALL || !rowPosition) return name;
  return `${name} · ${rowPosition}`;
}

function totalIncomeAmount(row) {
  return INCOME_TYPES.reduce((acc, type) => acc + num(row?.[type.key]), 0);
}

function sortByTotalThenLabel(a, b) {
  return b.total - a.total || a.label.localeCompare(b.label, 'es');
}

function hexToRgb(hex) {
  const normalized = `${hex || ''}`.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function mixHex(baseHex, targetHex, weight) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  if (!base || !target) return baseHex;
  const clamped = Math.max(0, Math.min(1, weight));
  const mix = (start, end) => Math.round(start + (end - start) * clamped);
  return `#${[mix(base.r, target.r), mix(base.g, target.g), mix(base.b, target.b)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function buildSegmentPalette(baseColor, count) {
  if (count <= 1) return [baseColor];
  return Array.from({ length: count }, (_, index) => {
    const weight = count === 1 ? 0 : (index / (count - 1)) * 0.56;
    return mixHex(baseColor, '#ffffff', weight);
  });
}

function buildTopDonorBreakdown(store, position) {
  const donors = store.donors
    .map((donor) => {
      const candidateTotals = new Map();
      let total = 0;

      for (const row of donor.ingresos) {
        if (position !== ALL && TEXT(row?.candidatePosition) !== position) continue;
        const amount = totalIncomeAmount(row);
        if (!(amount > 0)) continue;
        total += amount;

        const candidateKey = `${TEXT(row?.candidateName)}|${TEXT(row?.candidatePosition)}`;
        const existing = candidateTotals.get(candidateKey) || {
          key: candidateKey,
          label: candidateStackLabel(row, position),
          total: 0,
        };
        existing.total += amount;
        candidateTotals.set(candidateKey, existing);
      }

      if (!(total > 0)) return null;

      return {
        key: donor.id,
        label: TEXT(donor.name) || 'Sin nombre',
        total,
        candidates: [...candidateTotals.values()].sort(sortByTotalThenLabel),
      };
    })
    .filter(Boolean)
    .sort(sortByTotalThenLabel);

  const total = donors.reduce((acc, donor) => acc + donor.total, 0);
  const topDonors = donors.slice(0, TOP_COUNT).map((donor, index) => {
    const baseColor = DONOR_COLORS[index] || DONOR_COLORS[DONOR_COLORS.length - 1];
    const segmentColors = buildSegmentPalette(baseColor, donor.candidates.length);
    return {
      ...donor,
      baseColor,
      candidates: donor.candidates.map((candidate, candidateIndex) => ({
        ...candidate,
        color: segmentColors[candidateIndex] || baseColor,
      })),
    };
  });

  const restTotal = donors.slice(TOP_COUNT).reduce((acc, donor) => acc + donor.total, 0);
  const donutItems = topDonors.map((donor) => ({
    key: donor.key,
    label: donor.label,
    value: donor.total,
    color: donor.baseColor,
    interactive: true,
  }));

  if (restTotal > 0) {
    donutItems.push({
      key: REST_KEY,
      label: 'Resto',
      value: restTotal,
      color: REST_COLOR,
      interactive: false,
    });
  }

  return {
    total,
    topDonors,
    donutItems,
    maxTotal: topDonors.reduce((acc, donor) => Math.max(acc, donor.total), 0),
  };
}

function DonutSegment({ item, active, dimmed, strokeDasharray, strokeDashoffset, onSelect }) {
  const interactive = item.interactive !== false;

  function handleSelect(event) {
    if (!interactive) return;
    event.stopPropagation();
    onSelect();
  }

  return (
    <g
      onPointerDown={(event) => {
        if (!interactive) return;
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
          cursor: interactive ? 'pointer' : 'default',
          strokeDasharray,
          strokeDashoffset,
          pointerEvents: interactive ? 'stroke' : 'none',
        }}
      />
      {active ? (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          strokeWidth={ACTIVE_OUTLINE_WIDTH}
          className="mf-top-donor-breakdown__segment-outline"
          style={{ strokeDasharray, strokeDashoffset }}
        />
      ) : null}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke={item.color}
        strokeWidth={active ? ACTIVE_STROKE_WIDTH : STROKE_WIDTH}
        className={`mf-top-donor-breakdown__segment${interactive ? ' is-clickable' : ''}${active ? ' is-active' : ''}${dimmed ? ' is-dimmed' : ''}`}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : -1}
        aria-pressed={interactive ? (active ? 'true' : 'false') : undefined}
        aria-label={`${item.label}: ${formatEmbedCurrency(item.value, 0)}`}
        style={{
          strokeDasharray,
          strokeDashoffset,
          pointerEvents: 'none',
        }}
        onKeyDown={(event) => {
          if (!interactive) return;
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

function TopDonorsChart({ store, position }) {
  const rootRef = useRef(null);
  const [activeDonorKey, setActiveDonorKey] = useState(null);

  const breakdown = useMemo(() => buildTopDonorBreakdown(store, position), [position, store]);

  useEffect(() => {
    if (!activeDonorKey) return;
    if (!breakdown.topDonors.some((donor) => donor.key === activeDonorKey)) {
      setActiveDonorKey(null);
    }
  }, [activeDonorKey, breakdown.topDonors]);

  useEffect(() => {
    if (!activeDonorKey) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setActiveDonorKey(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [activeDonorKey]);

  if (!(breakdown.total > 0) || !breakdown.topDonors.length) {
    return <div className="empty">Sin datos.</div>;
  }

  const activeDonor = breakdown.topDonors.find((donor) => donor.key === activeDonorKey) || null;
  const hasSelection = !!activeDonor;
  const circumference = 2 * Math.PI * RADIUS;
  const gap = breakdown.donutItems.filter((item) => item.value > 0).length > 1 ? SEGMENT_GAP : 0;
  const displayValue = activeDonor ? activeDonor.total : breakdown.total;
  const displayShare = activeDonor ? Math.round((activeDonor.total / breakdown.total) * 100) : 100;
  const displayLabel = activeDonor ? activeDonor.label : coverageLabel(position);
  let offset = 0;

  return (
    <div className="mf-top-donor-breakdown" ref={rootRef}>
      <div
        className="mf-top-donor-breakdown__visual"
        onClick={() => {
          if (hasSelection) setActiveDonorKey(null);
        }}
      >
        <div className="mf-top-donor-breakdown__donut">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mf-top-donor-breakdown__svg"
            role="img"
            aria-label={`Mayores donantes en ${coverageLabel(position)}. Total ${formatEmbedCurrency(breakdown.total, 0)}.`}
          >
            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#edf2f8" strokeWidth={STROKE_WIDTH} />
            <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
              {breakdown.donutItems.map((item) => {
                const segment = (item.value / breakdown.total) * circumference;
                const visible = Math.max(0, segment - gap);
                const segmentOffset = offset;
                offset += segment;
                const active = item.key === activeDonor?.key;
                const dimmed = hasSelection && item.interactive !== false && !active;
                return (
                  <DonutSegment
                    key={item.key}
                    item={item}
                    active={active}
                    dimmed={dimmed}
                    strokeDasharray={`${visible} ${Math.max(0, circumference - visible)}`}
                    strokeDashoffset={-segmentOffset}
                    onSelect={() => setActiveDonorKey((current) => (current === item.key ? null : item.key))}
                  />
                );
              })}
            </g>
          </svg>
          <div className="mf-top-donor-breakdown__center">
            <div className="mf-top-donor-breakdown__eyebrow">{displayLabel}</div>
            <div className="mf-top-donor-breakdown__total">{formatEmbedCurrency(displayValue, 0)}</div>
            <div className="mf-top-donor-breakdown__share">{displayShare}%</div>
          </div>
        </div>
      </div>

      <div className="mf-top-donor-breakdown__list">
        {breakdown.topDonors.map((donor) => {
          const active = donor.key === activeDonor?.key;
          const dimmed = hasSelection && !active;
          return (
            <button
              key={donor.key}
              type="button"
              className={`mf-top-donor-breakdown__item${active ? ' is-active' : ''}${dimmed ? ' is-dimmed' : ''}`}
              aria-pressed={active ? 'true' : 'false'}
              onClick={() => setActiveDonorKey((current) => (current === donor.key ? null : donor.key))}
            >
              <div className="mf-top-donor-breakdown__row">
                <div className="mf-top-donor-breakdown__label">{donor.label}</div>
                <div className="mf-top-donor-breakdown__value">{formatEmbedCurrency(donor.total, 0)}</div>
              </div>
              <div className="mf-top-donor-breakdown__bar" aria-hidden="true">
                <div
                  className="mf-top-donor-breakdown__bar-fill"
                  style={{
                    width:
                      breakdown.maxTotal > 0
                        ? `max(${(donor.total / breakdown.maxTotal) * 100}%, ${MIN_BAR_WIDTH}px)`
                        : '0%',
                  }}
                >
                  {donor.candidates.map((candidate) => {
                    const width = donor.total > 0 ? (candidate.total / donor.total) * 100 : 0;
                    return (
                      <div
                        key={candidate.key}
                        className="mf-top-donor-breakdown__segment-bar"
                        title={`${candidate.label}: ${formatEmbedCurrency(candidate.total, 0)}`}
                        style={{
                          width: `${width}%`,
                          background: candidate.color,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </button>
          );
        })}
        
      </div>
    </div>
  );
}

export function FinanciacionTopDonantesChartElementApp({ element, store, loading = false, error = null }) {
  const position = element?.getAttribute('position') || ALL;
  const options = store ? positionOptions(store) : [ALL];
  const hasData = useMemo(() => {
    if (!store) return false;
    const rows =
      position === ALL ? store.ingresos : store.ingresos.filter((row) => TEXT(row?.candidatePosition) === position);
    return rows.some((row) => totalIncomeAmount(row) > 0);
  }, [position, store]);

  return (
    <>
      <FinanciacionChartStyles />
      <style>{TOP_DONANTES_CHART_CSS}</style>
      <section className="wc-panel">
        <h4>Mayores donantes</h4>
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
              {hasData ? <TopDonorsChart store={store} position={position} /> : <div className="empty">Sin datos.</div>}
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}