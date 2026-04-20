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

export function bootstrapShadowLinkHtml() {
  return `<link rel="stylesheet" href="${BOOTSTRAP_STYLESHEET_HREF}">`;
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
    width:min(320px,calc(100vw - 32px));
    margin-top:8px;
    padding:1rem;
  }
  .form-select.is-active{
    border-color:#0f766e;
    background:#f6fef9;
    color:#064e3b;
  }
  .wc-filter-status-text{
    font-size:.94rem;
    font-weight:600;
    line-height:1.35;
  }
  .wc-filter-status-clear{
    color:inherit;
    text-decoration:underline;
    text-underline-offset:2px;
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
            <div className="d-grid gap-2">
              <label className="d-grid gap-1">
                <span className="form-label">Provincia</span>
                <select
                  className={`form-select${provinceValue ? ' is-active' : ''}`}
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
              </label>
              <label className="d-grid gap-1">
                <span className="form-label">Partido</span>
                <select
                  className={`form-select${partyValue ? ' is-active' : ''}`}
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
              </label>
            </div>
            {sharedChartFilterActive(filter) ? (
              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 wc-filter-status-clear"
                  onClick={() => {
                    setFilter(defaultFilterState());
                    setIsOpen(false);
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

function updateButtonState(button, filter, isOpen) {
  button.classList.toggle('active', sharedChartFilterActive(filter));
  button.classList.toggle('is-open', !!isOpen);
  const dot = button.querySelector('.wc-filter-dot');
  if (sharedChartFilterActive(filter) && !dot) {
    const nextDot = document.createElement('span');
    nextDot.className = 'wc-filter-dot';
    nextDot.setAttribute('aria-hidden', 'true');
    button.append(nextDot);
  }
  if (!sharedChartFilterActive(filter) && dot) dot.remove();
}

function renderSelectOptions(select, type, filter, filterOptions) {
  select.innerHTML = '';
  select.setAttribute('aria-label', type === 'party' ? 'Seleccionar partido' : 'Seleccionar provincia');
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = filterSelectAllLabel(type);
  select.append(allOption);
  (filterOptions[type] || []).forEach((option) => {
    const optionNode = document.createElement('option');
    optionNode.value = option.value;
    optionNode.textContent = option.label;
    if (type === filter.type && option.value === filter.value) optionNode.selected = true;
    select.append(optionNode);
  });
  select.value = type === filter.type ? filter.value : '';
}

export function createSharedChartFilterControls({ control, onSelect, scopeKey, filterOptions }) {
  const shell = document.createElement('div');
  shell.className = 'wc-filter-shell';

  const tabsShell = document.createElement('div');
  tabsShell.className = 'wc-tabs-shell';

  const tabsWrap = document.createElement('div');
  tabsWrap.className = 'wc-tabs-wrap';
  const list = document.createElement('ul');
  list.className = 'nav nav-tabs wc-tabs';
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', control.label);

  control.options.forEach((option) => {
    const active = option.value === control.value;
    const item = document.createElement('li');
    item.className = 'nav-item wc-tab-item';

    const link = document.createElement('a');
    link.href = '#';
    link.className = `nav-link wc-tab-link${active ? ' active' : ''}`;
    link.setAttribute('role', 'tab');
    link.setAttribute('aria-selected', active ? 'true' : 'false');
    link.tabIndex = active ? 0 : -1;
    link.textContent = option.label;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (!active) onSelect(option.value);
    });

    item.append(link);
    list.append(item);
  });

  tabsWrap.append(list);
  tabsShell.append(tabsWrap);

  const filterWrap = document.createElement('div');
  filterWrap.className = 'wc-filter-wrap';
  const filterButton = document.createElement('button');
  filterButton.type = 'button';
  filterButton.className = 'btn btn-sm btn-outline-secondary wc-filter-trigger';
  filterButton.setAttribute('aria-haspopup', 'dialog');
  filterButton.innerHTML =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3.25h12L9.3 8.3v3.8l-2.6 1.4V8.3L2 3.25Z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"></path></svg><span>Filtrar</span>';
  filterWrap.append(filterButton);
  tabsShell.append(filterWrap);

  const status = document.createElement('div');
  status.className = 'alert alert-success wc-filter-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  status.style.display = 'none';
  const statusText = document.createElement('div');
  statusText.className = 'wc-filter-status-text';
  const statusStrong = document.createElement('strong');
  statusText.append(statusStrong);
  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'btn btn-link btn-sm p-0 wc-filter-status-clear';
  clearButton.textContent = 'Quitar filtro';
  clearButton.addEventListener('click', () => setSharedChartFilter(scopeKey, defaultFilterState()));
  status.append(statusText, clearButton);

  let popover = null;
  let removeOutsideHandlers = () => {};
  let provinceSelect = null;
  let partySelect = null;
  let actions = null;

  const closePopover = () => {
    if (!popover) return;
    popover.remove();
    popover = null;
    provinceSelect = null;
    partySelect = null;
    actions = null;
    removeOutsideHandlers();
    updateButtonState(filterButton, getSharedChartFilter(scopeKey), false);
  };

  const refreshPopoverInputs = () => {
    if (!popover || !provinceSelect || !partySelect || !actions) return;
    const filter = getSharedChartFilter(scopeKey);
    renderSelectOptions(provinceSelect, 'province', filter, filterOptions);
    renderSelectOptions(partySelect, 'party', filter, filterOptions);
    provinceSelect.classList.toggle('is-active', filter.type === 'province' && !!filter.value);
    partySelect.classList.toggle('is-active', filter.type === 'party' && !!filter.value);
    actions.innerHTML = '';
    if (sharedChartFilterActive(filter)) {
      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'btn btn-link btn-sm p-0 wc-filter-status-clear';
      resetButton.textContent = 'Limpiar filtro';
      resetButton.addEventListener('click', () => {
        setSharedChartFilter(scopeKey, defaultFilterState());
        closePopover();
      });
      actions.append(resetButton);
    }
  };

  const openPopover = () => {
    closePopover();
    const filter = getSharedChartFilter(scopeKey);

    popover = document.createElement('div');
    popover.className = 'dropdown-menu show wc-filter-menu';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Filtrar gráfico');

    const heading = document.createElement('p');
    heading.className = 'form-label mb-2';
    heading.textContent = 'Filtrar todas estas visualizaciones por';

    const fields = document.createElement('div');
    fields.className = 'd-grid gap-2';

    const provinceField = document.createElement('label');
    provinceField.className = 'd-grid gap-1';
    const provinceLabel = document.createElement('span');
    provinceLabel.className = 'form-label';
    provinceLabel.textContent = 'Provincia';
    provinceSelect = document.createElement('select');
    provinceSelect.className = 'form-select';
    provinceSelect.setAttribute('aria-label', 'Seleccionar provincia');
    provinceSelect.addEventListener('change', () => {
      setSharedChartFilter(scopeKey, { type: 'province', value: provinceSelect.value });
    });
    provinceField.append(provinceLabel, provinceSelect);

    const partyField = document.createElement('label');
    partyField.className = 'd-grid gap-1';
    const partyLabel = document.createElement('span');
    partyLabel.className = 'form-label';
    partyLabel.textContent = 'Partido';
    partySelect = document.createElement('select');
    partySelect.className = 'form-select';
    partySelect.setAttribute('aria-label', 'Seleccionar partido');
    partySelect.addEventListener('change', () => {
      setSharedChartFilter(scopeKey, { type: 'party', value: partySelect.value });
    });
    partyField.append(partyLabel, partySelect);

    fields.append(provinceField, partyField);

    actions = document.createElement('div');
    actions.className = 'd-flex justify-content-end';

    refreshPopoverInputs();
    popover.append(heading, fields, actions);
    filterWrap.append(popover);
    updateButtonState(filterButton, filter, true);

    const handlePointerDown = (event) => {
      if (!eventWithinNode(filterWrap, event)) closePopover();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') closePopover();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    removeOutsideHandlers = () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
      removeOutsideHandlers = () => {};
    };
  };

  const syncUi = (filter) => {
    const summary = sharedChartFilterSummary(filter, filterOptions);
    status.hidden = !summary;
    status.style.display = summary ? 'flex' : 'none';
    statusStrong.textContent = summary;
    updateButtonState(filterButton, filter, !!popover);
    if (!popover) return;
    refreshPopoverInputs();
  };

  filterButton.addEventListener('click', () => {
    if (popover) closePopover();
    else openPopover();
  });

  syncUi(getSharedChartFilter(scopeKey));

  shell.append(tabsShell, status);
  shell.cleanup = () => closePopover();
  return shell;
}
