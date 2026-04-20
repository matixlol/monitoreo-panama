import { useEffect, useMemo, useRef, useState } from 'react';
import { NORM, TEXT, uniq } from './embed-shared.jsx';

export const BOOTSTRAP_STYLESHEET_HREF =
  'https://www.libertadciudadana.org/wp-content/themes/libertad-ciudadana/css/bootstrap.min.css';

const FILTER_TYPE_OPTIONS = [
  { value: 'province', label: 'Provincia' },
  { value: 'party', label: 'Partido' },
];

const FILTER_STORE = {
  stateByScope: new Map(),
  listenersByScope: new Map(),
};

const DEFAULT_FILTER = Object.freeze({ type: null, value: '' });

function cloneFilterState(filter) {
  return {
    type: filter?.type || null,
    value: TEXT(filter?.value),
  };
}

function defaultFilterState() {
  return { ...DEFAULT_FILTER };
}

function listenersForScope(scopeKey) {
  if (!FILTER_STORE.listenersByScope.has(scopeKey)) FILTER_STORE.listenersByScope.set(scopeKey, new Set());
  return FILTER_STORE.listenersByScope.get(scopeKey);
}

export function sharedChartFilterScopeKey(element) {
  if (!element) return 'window';
  const ingresosUrl = TEXT(element.getAttribute?.('ingresos-url'));
  const egresosUrl = TEXT(element.getAttribute?.('egresos-url'));
  return ingresosUrl || egresosUrl ? `${ingresosUrl}|${egresosUrl}` : 'window';
}

export function getSharedChartFilter(scopeKey) {
  return cloneFilterState(FILTER_STORE.stateByScope.get(scopeKey) || DEFAULT_FILTER);
}

export function setSharedChartFilter(scopeKey, nextFilter) {
  const previous = getSharedChartFilter(scopeKey);
  const next = cloneFilterState(nextFilter);
  if (!next.type || !next.value) {
    next.type = null;
    next.value = '';
  }
  if (previous.type === next.type && previous.value === next.value) return;
  FILTER_STORE.stateByScope.set(scopeKey, next);
  listenersForScope(scopeKey).forEach((listener) => listener(cloneFilterState(next)));
}

export function subscribeSharedChartFilter(scopeKey, listener) {
  const listeners = listenersForScope(scopeKey);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSharedChartFilterOptions(store) {
  const byLocale = (a, b) => a.localeCompare(b, 'es');
  const provinces = uniq(store.candidates.flatMap((candidate) => candidate.provinces || []).map(TEXT).filter(Boolean)).sort(
    byLocale,
  );
  const parties = uniq(store.candidates.flatMap((candidate) => candidate.parties || []).map(TEXT).filter(Boolean)).sort(
    byLocale,
  );
  return {
    province: provinces.map((value) => ({ value, label: value })),
    party: parties.map((value) => ({ value, label: value })),
  };
}

export function sharedChartFilterActive(filter) {
  return !!(filter?.type && TEXT(filter?.value));
}

function optionLabelMap(options) {
  return new Map(options.map((option) => [NORM(option.value), option.label]));
}

export function sharedChartFilterSummary(filter, filterOptions) {
  if (!sharedChartFilterActive(filter)) return '';
  const typeLabel = FILTER_TYPE_OPTIONS.find((option) => option.value === filter.type)?.label?.toLowerCase() || 'filtro';
  const labels = {
    province: optionLabelMap(filterOptions?.province || []),
    party: optionLabelMap(filterOptions?.party || []),
  };
  const valueLabel = labels[filter.type]?.get(NORM(filter.value)) || TEXT(filter.value);
  return `Filtrando por ${typeLabel}: ${valueLabel}`;
}

function valuesInclude(filterValue, values) {
  const normalizedFilterValue = NORM(filterValue);
  return (Array.isArray(values) ? values : [values]).some((value) => NORM(value) === normalizedFilterValue);
}

export function matchesSharedChartFilter(filter, values = {}) {
  if (!sharedChartFilterActive(filter)) return true;
  if (filter.type === 'province') return valuesInclude(filter.value, values.province);
  if (filter.type === 'party') return valuesInclude(filter.value, values.party);
  return true;
}

function filterSelectAllLabel(type) {
  return type === 'party' ? 'Todos los partidos' : 'Todas las provincias';
}

function eventWithinNode(node, event) {
  if (!node || !event) return false;
  if (typeof event.composedPath === 'function') return event.composedPath().includes(node);
  return node.contains(event.target);
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2 3.25h12L9.3 8.3v3.8l-2.6 1.4V8.3L2 3.25Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BootstrapShadowStyles() {
  return <link rel="stylesheet" href={BOOTSTRAP_STYLESHEET_HREF} />;
}

export const SHARED_CHART_FILTER_CSS = `
  .wc-tabs-shell{
    display:flex;
    flex-wrap:wrap;
    align-items:flex-start;
    justify-content:space-between;
    gap:12px;
    margin:0 0 16px;
  }
  .wc-tabs-shell>.wc-tabs-wrap{
    flex:1 1 320px;
    min-width:0;
    margin:0;
  }
  .wc-filter-wrap{
    position:relative;
    flex:none;
    min-width:max-content;
  }
  .wc-filter-trigger{
    display:inline-flex;
    align-items:center;
    gap:8px;
  }
  .wc-filter-trigger svg{
    width:16px;
    height:16px;
    flex:none;
  }
  .wc-filter-trigger.active{
    border-color:#0f766e;
    background:#ecfdf3;
    color:#115e59;
  }
  .wc-filter-trigger.is-open{
    border-color:#98a2b3;
    box-shadow:0 0 0 3px rgba(17,24,39,.06);
  }
  .wc-filter-dot{
    width:8px;
    height:8px;
    border-radius:999px;
    background:currentColor;
    flex:none;
  }
  .wc-filter-menu{
    position:absolute;
    top:calc(100% + 8px);
    right:0;
    left:auto;
    z-index:10;
    width:min(320px,calc(100vw - 32px));
    padding:1rem;
  }
  .custom-select.is-active{
    border-color:#0f766e;
    background:#f6fef9;
    color:#064e3b;
  }
  .wc-filter-status-text{
    font-size:.94rem;
    font-weight:600;
    line-height:1.35;
  }
  .wc-filter-status{
    display:flex;
    align-items:center;
    gap:12px;
  }
  .wc-filter-status-clear{
    margin-left:auto;
    padding:.2rem .55rem !important;
    border:1px solid currentColor;
    border-radius:.25rem;
    background:rgba(255,255,255,.45);
    color:inherit;
    font-weight:600;
    text-decoration:none;
  }
  .wc-filter-status-clear:hover{
    background:rgba(255,255,255,.72);
    color:inherit;
  }
  @media (max-width:720px){
    .wc-tabs-shell{
      gap:10px;
      margin-bottom:14px;
    }
    .wc-tabs-shell>.wc-tabs-wrap{
      flex-basis:100%;
    }
    .wc-filter-wrap{
      width:100%;
    }
    .wc-filter-trigger{
      width:100%;
      justify-content:center;
    }
    .wc-filter-menu{
      left:0;
      right:auto;
      width:100%;
    }
    .wc-filter-status{
      margin-bottom:14px;
      align-items:flex-start;
    }
    .wc-filter-status-clear{
      margin-left:0;
    }
  }
`;

export function useSharedChartFilterState(scopeKey) {
  const [filter, setFilter] = useState(() => getSharedChartFilter(scopeKey));

  useEffect(() => {
    setFilter(getSharedChartFilter(scopeKey));
    return subscribeSharedChartFilter(scopeKey, setFilter);
  }, [scopeKey]);

  return [filter, (nextFilter) => setSharedChartFilter(scopeKey, nextFilter)];
}

function afterInteraction(callback) {
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    window.setTimeout(callback, 0);
    return;
  }
  setTimeout(callback, 0);
}

function SharedChartFilterControlBase({ scopeKey, filterOptions }) {
  const [filter, setFilter] = useSharedChartFilterState(scopeKey);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const provinceValue = filter.type === 'province' ? filter.value : '';
  const partyValue = filter.type === 'party' ? filter.value : '';

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!eventWithinNode(rootRef.current, event)) setIsOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      <div className="wc-filter-wrap" ref={rootRef}>
        <button
          type="button"
          className={`btn btn-sm btn-outline-secondary wc-filter-trigger${sharedChartFilterActive(filter) ? ' active' : ''}${isOpen ? ' is-open' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen ? 'true' : 'false'}
          onClick={() => setIsOpen((open) => !open)}
        >
          <FilterIcon />
          <span>Filtrar</span>
          {sharedChartFilterActive(filter) ? <span className="wc-filter-dot" aria-hidden="true" /> : null}
        </button>

        {isOpen ? (
          <div className="dropdown-menu show wc-filter-menu" role="dialog" aria-label="Filtrar gráfico">
            <p className="form-label mb-2">Filtrar todas estas visualizaciones por</p>
            <div>
              <div className="form-group mb-2">
                <label className="d-block mb-1">Provincia</label>
                <select
                  className={`custom-select${provinceValue ? ' is-active' : ''}`}
                  aria-label="Seleccionar provincia"
                  value={provinceValue}
                  onChange={(event) => setFilter({ type: 'province', value: event.currentTarget.value })}
                >
                  <option value="">{filterSelectAllLabel('province')}</option>
                  {(filterOptions?.province || []).map((option) => (
                    <option key={`province:${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group mb-2">
                <label className="d-block mb-1">Partido</label>
                <select
                  className={`custom-select${partyValue ? ' is-active' : ''}`}
                  aria-label="Seleccionar partido"
                  value={partyValue}
                  onChange={(event) => setFilter({ type: 'party', value: event.currentTarget.value })}
                >
                  <option value="">{filterSelectAllLabel('party')}</option>
                  {(filterOptions?.party || []).map((option) => (
                    <option key={`party:${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {sharedChartFilterActive(filter) ? (
              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 wc-filter-status-clear"
                  onClick={() => {
                    setIsOpen(false);
                    afterInteraction(() => setFilter(defaultFilterState()));
                  }}
                >
                  Limpiar filtro
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function SharedChartFilterStatus({ scopeKey, filterOptions }) {
  const [filter, setFilter] = useSharedChartFilterState(scopeKey);
  const summary = useMemo(() => sharedChartFilterSummary(filter, filterOptions), [filter, filterOptions]);

  if (!sharedChartFilterActive(filter)) return null;

  return (
    <div className="alert alert-success wc-filter-status" role="status" aria-live="polite">
      <div className="wc-filter-status-text">
        <strong>{summary}</strong>
      </div>
      <button
        type="button"
        className="btn btn-link btn-sm p-0 wc-filter-status-clear"
        onClick={() => setFilter(defaultFilterState())}
      >
        Quitar filtro
      </button>
    </div>
  );
}

export function SharedChartTabs({ scopeKey, label, value, options, onChange, filterOptions }) {
  return (
    <div className="wc-filter-shell">
      <div className="wc-tabs-shell">
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
        <SharedChartFilterControlBase scopeKey={scopeKey} filterOptions={filterOptions} />
      </div>
      <SharedChartFilterStatus scopeKey={scopeKey} filterOptions={filterOptions} />
    </div>
  );
}
