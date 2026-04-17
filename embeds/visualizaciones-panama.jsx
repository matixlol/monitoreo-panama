import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';
import ingresosDatasetUrl from './data/documentos-ingresos.csv?url';
import egresosDatasetUrl from './data/documentos-egresos.csv?url';
import donorBeeswarmLayout from './data/donor-beeswarm.json';
import { beeswarm } from './charts/beeswarm.js';
import { createDonorBeeswarmSignature } from './charts/beeswarm-precomputed.js';
import { contributorHistogram } from './charts/contributor-histogram.js';
import { groupedBarsChart, groupedBarsChartCss } from './charts/grouped-bars.js';
import { incomeBreakdownChart, incomeBreakdownChartCss } from './charts/income-breakdown.js';
import { line } from './charts/line.js';
import { mapChart } from './charts/map.js';
import { PANAMA_PROVINCE_NAMES } from './charts/panama-map.js';
import { treemap } from './charts/treemap.js';
import { ModalRouter } from './modal-router.jsx';
import { GeneralSearchElementApp } from './general-search-element.jsx';
import { CandidatesTableElementApp, TransactionsTableElementApp } from './tables-elements.jsx';
import {
  ALL,
  COLORS,
  INT,
  MONEY,
  NORM,
  POS,
  SHORT,
  TEXT,
  candidateIdFromRow,
  candidateLabel,
  chartOpts,
  buildHashRoute,
  byPos,
  expenseAmount,
  expenseTreemapBreakdown,
  expenseTimeline,
  incomeBreakdown,
  num,
  parseCsvText,
  parseHashRoute,
  parsePanamaDate,
  slugify,
  sortPos,
  sum,
  uniq,
} from './embed-shared.jsx';

const ROOTS = new WeakMap();
const STORE_CACHE = new Map();
const resolveModuleAssetUrl = (assetUrl) => new URL(assetUrl, import.meta.url).href;
const DEFAULT_INGRESOS_URL = resolveModuleAssetUrl(ingresosDatasetUrl);
const DEFAULT_EGRESOS_URL = resolveModuleAssetUrl(egresosDatasetUrl);

const provinceName = (id) => PANAMA_PROVINCE_NAMES.get(id);

const PROVINCE_ALIASES = new Map(
  Object.entries({
    'bocas del toro': provinceName('g18'),
    'chiriqui': provinceName('chiriqui'),
    'cocle': provinceName('cocle'),
    'colon': provinceName('colon'),
    'darien': provinceName('darien'),
    'herrera': provinceName('herrera'),
    'los santos': provinceName('los_santos'),
    'panama': provinceName('panama'),
    'panama oeste': provinceName('panama_oeste'),
    'veraguas': provinceName('veraguas'),
    'comarca embera wounaan': provinceName('embera_wounaan'),
    'comarca emberawounaan': provinceName('embera_wounaan'),
    'comarca embera wounann': provinceName('embera_wounaan'),
    'comarca emberawounann': provinceName('embera_wounaan'),
    'comarca guna yala': provinceName('guna_yala'),
    'guna yala': provinceName('guna_yala'),
    'comarca ngabe bugle': provinceName('ngabe_bugle'),
    'comarca ngabebugle': provinceName('ngabe_bugle'),
    'embera wounaan': provinceName('embera_wounaan'),
    'emberawounaan': provinceName('embera_wounaan'),
    'embera wounann': provinceName('embera_wounaan'),
    'emberawounann': provinceName('embera_wounaan'),
    'ngabe bugle': provinceName('ngabe_bugle'),
    'ngabebugle': provinceName('ngabe_bugle'),
  }),
);

const SUMMARY_CARDS_CSS = `.mf-summary-grid{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}.mf-summary-card{min-width:0;min-height:200px;padding:34px 24px 28px;display:grid;justify-items:center;align-content:center;text-align:center;background:#fff;border:1px solid #d0d5dd;border-radius:18px;box-shadow:0 1px 3px rgba(16,24,40,.08)}.mf-summary-icon{width:64px;height:64px;display:grid;place-items:center;color:#1f1f24}.mf-summary-icon svg{width:64px;height:64px;display:block;stroke:currentColor;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}.mf-summary-value{margin-top:16px;font-size:clamp(1.15rem,1.7vw,1.55rem);font-weight:700;line-height:1.1;letter-spacing:-.015em;overflow-wrap:anywhere}.mf-summary-label{margin-top:10px;font-size:clamp(.72rem,1vw,.9rem);line-height:1.15;color:#202531}@media (max-width:720px){.mf-summary-grid{gap:16px;grid-template-columns:repeat(2,minmax(0,1fr))}.mf-summary-card{min-height:auto;padding:22px 16px 18px}.mf-summary-icon{width:52px;height:52px}.mf-summary-icon svg{width:52px;height:52px}.mf-summary-value{font-size:clamp(.95rem,4.2vw,1.15rem)}.mf-summary-label{font-size:clamp(.68rem,3vw,.8rem)}}`;

let cssDone = false;

function province(v) {
  return PROVINCE_ALIASES.get(NORM(v)) ?? TEXT(v);
}

function inject() {
  if (cssDone || typeof document === 'undefined') return;
  document.head.append(
    Object.assign(document.createElement('style'), {
      textContent: `
  .mf-root,.mf-overlay{--ink:#111827;--muted:#667085;--line:#dee2e6;--blue:#3089b8;color:var(--ink);font-family:'Montserrat',sans-serif;font-size:14.5px;line-height:1.5}.mf-root a,.mf-overlay a{color:inherit}.mf-root{max-width:1200px;margin:0 auto;padding:24px}.mf-hero,.mf-card,.mf-stat,.mf-meta-item{background:#fff;border:1px solid var(--line);border-radius:.25rem;box-shadow:none}
  .mf-hero{padding:20px 22px;display:grid;gap:10px}.mf-kicker{margin:0;color:var(--blue);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.mf-title{margin:0;line-height:1.1}.mf-sub{margin:0;color:var(--muted);max-width:72ch}.mf-grid{display:grid;gap:16px;margin-top:16px}.mf-card{min-width:0;padding:18px;overflow-x:clip}.mf-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:flex-start;margin-bottom:16px}.mf-head>div{min-width:0}.mf-head h2{margin:0 0 4px;overflow-wrap:anywhere}.mf-note{margin:0;color:var(--muted);overflow-wrap:anywhere}.mf-controls{display:flex;flex-wrap:wrap;gap:8px}.mf-toggle{display:inline-flex;flex-wrap:wrap;gap:8px}.mf-toggle .btn{border-radius:.25rem!important}.mf-toggle .btn-primary{background-color:var(--blue);border-color:var(--blue)}.mf-icon-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:32px;padding:0 12px;border:1px solid var(--line);border-radius:.25rem;background:#fff;color:#344054;cursor:pointer;white-space:nowrap}.mf-icon-button:hover{background:#f8fafc;color:var(--ink)}.mf-icon-button:focus-visible{outline:2px solid transparent;box-shadow:0 0 0 3px rgba(48,137,184,.18)}.mf-icon-button svg{width:16px;height:16px;display:block;flex:none}.mf-icon-button__label{font-size:13px;font-weight:600;line-height:1}.mf-section-body{display:grid;gap:16px}.mf-section-body>*{min-width:0}.mf-code{min-width:0;max-width:100%;overflow:auto;border:1px solid var(--line);background:#f8fafc}.mf-code pre{margin:0;padding:14px 16px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}.mf-section-main{min-width:0}.mf-figure{overflow:auto}.mf-map{overflow-x:auto;overflow-y:hidden}.mf-empty{color:var(--muted);padding:14px 0}.mf-stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}.mf-stat{padding:18px;text-align:center}.mf-stat b{display:block;font-size:1.75rem;line-height:1.1}.mf-meta{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.mf-meta-item{min-width:0;padding:14px 16px}.mf-meta-item strong{display:block;margin-bottom:4px;font-weight:600}.mf-meta-item p{margin:0;color:var(--muted)}.mf-modal-stack{display:grid;gap:20px}.mf-table-wrap{max-height:55vh;border:1px solid var(--line);border-radius:.25rem;background:#fff}.mf-table{min-width:720px;background:#fff}.mf-table thead th{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);color:#495057;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.mf-table td,.mf-table th{vertical-align:top}.mf-strong{font-weight:700}.mf-overlay{position:fixed;inset:0;padding:16px;background:rgba(17,24,39,.52);overflow:auto;z-index:9999}.mf-modal{margin:0 auto;max-width:1180px}.mf-modal-content{position:relative;isolation:isolate;max-height:calc(100vh - 32px);overflow:auto;border:1px solid var(--line);border-radius:0;box-shadow:none}.mf-modal-header{position:sticky;top:0;z-index:1000;align-items:flex-start;padding:16px 20px;background:#fff;border-bottom:1px solid var(--line)}.mf-modal-title{margin:0;padding-right:16px;line-height:1.1}.mf-modal-close{margin:0;padding:0;width:40px;height:40px;border:0;background:transparent;color:var(--ink);font-size:34px;line-height:1;opacity:.72;text-shadow:none}.mf-modal-close:hover{opacity:1}.mf-modal-body{padding:20px;background:#fff}.mf-map svg{display:block;width:100%;height:auto;max-width:960px;margin:auto}.mf-map .legend{display:grid;gap:8px;margin-top:12px;color:var(--muted);font-size:12px}.mf-legend-scale{display:grid;gap:6px}.mf-legend-bar{height:12px;border:1px solid var(--line);border-radius:999px}.mf-legend-ticks{position:relative;height:16px}.mf-legend-ticks.is-single{height:auto}.mf-legend-tick{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}.mf-legend-tick:first-child{transform:none}.mf-legend-tick:last-child{transform:translateX(-100%)}.mf-legend-ticks.is-single .mf-legend-tick{position:static;transform:none}.mf-legend-note{display:flex;align-items:center;gap:8px}.mf-legend-swatch{width:12px;height:12px;border:1px solid #a6a6a6;border-radius:999px;background:#f2f2f2;flex:none}
  ${incomeBreakdownChartCss}
  ${SUMMARY_CARDS_CSS}
  @media (max-width:720px){.mf-root{padding:14px}.mf-card,.mf-hero,.mf-stat{padding:16px}.mf-code pre{padding:12px 14px;font-size:13px}.mf-overlay{padding:8px}.mf-modal-content{max-height:calc(100vh - 16px)}.mf-modal-header,.mf-modal-body{padding:16px}}
  `,
    }),
  );
  cssDone = true;
}

async function loadCsvDatasets({ ingresosUrl, egresosUrl, assignToWindow = true }) {
  const [ingresosResponse, egresosResponse] = await Promise.all([fetch(ingresosUrl), fetch(egresosUrl)]);
  if (!ingresosResponse.ok || !egresosResponse.ok) throw new Error('No se pudieron cargar los CSVs');
  const [ingresos, egresos] = await Promise.all([
    ingresosResponse.text().then(parseCsvText),
    egresosResponse.text().then(parseCsvText),
  ]);
  if (assignToWindow && typeof window !== 'undefined') {
    window.documentosIngresos = ingresos;
    window.documentosEgresos = egresos;
  }
  return { ingresos, egresos };
}

function resolveDatasets(options = {}) {
  if (options.datasets) return options.datasets;
  if (
    typeof window === 'undefined' ||
    !Array.isArray(window.documentosIngresos) ||
    !Array.isArray(window.documentosEgresos)
  ) {
    throw new Error('Faltan window.documentosIngresos o window.documentosEgresos.');
  }
  return { ingresos: window.documentosIngresos, egresos: window.documentosEgresos };
}

function topPartyRows(rows, n = 4) {
  const top = new Set(
    d3
      .rollups(
        rows,
        (values) => values.length,
        (d) => d.party,
      )
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, n)
      .map(([key]) => key),
  );
  return rows
    .map((d) => ({ ...d, group: top.has(d.party) ? d.party : 'Otros' }))
    .sort((a, b) => (a.group === 'Otros') - (b.group === 'Otros') || d3.ascending(a.group, b.group));
}

function buildStore({ ingresos = [], egresos = [] }) {
  const candidateBuckets = new Map();
  const donorBuckets = new Map();
  const providerBuckets = new Map();
  const put = (map, key, make) => map.get(key) || (map.set(key, make()), map.get(key));

  for (const row of ingresos) {
    const candidateId = candidateIdFromRow(row);
    const donorId = slugify(row.contribuyenteNombre);
    if (candidateId) put(candidateBuckets, candidateId, () => ({ ingresos: [], egresos: [] })).ingresos.push(row);
    if (donorId) put(donorBuckets, donorId, () => ({ ingresos: [] })).ingresos.push(row);
  }

  for (const row of egresos) {
    const candidateId = candidateIdFromRow(row);
    const providerId = slugify(row.proveedorNombre);
    if (candidateId) put(candidateBuckets, candidateId, () => ({ ingresos: [], egresos: [] })).egresos.push(row);
    if (providerId) put(providerBuckets, providerId, () => ({ egresos: [] })).egresos.push(row);
  }

  const candidates = [...candidateBuckets]
    .map(([id, bucket]) => {
      const rows = [...bucket.ingresos, ...bucket.egresos];
      return {
        kind: 'candidato',
        id,
        name: d3.mode(rows.map((r) => TEXT(r.candidateName)).filter(Boolean)) || id,
        parties: uniq(rows.map((r) => r.candidateParty)),
        positions: uniq(rows.map((r) => r.candidatePosition)).sort(sortPos),
        provinces: uniq(rows.map((r) => province(r.candidateProvince))),
        districts: uniq(rows.map((r) => r.candidateDistrict)),
        ingresos: bucket.ingresos.sort((a, b) => d3.descending(parsePanamaDate(a.fecha), parsePanamaDate(b.fecha))),
        egresos: bucket.egresos.sort((a, b) => d3.descending(parsePanamaDate(a.fecha), parsePanamaDate(b.fecha))),
        ingresoTotal: sum(bucket.ingresos, (r) => num(r.total)),
        egresoTotal: sum(bucket.egresos, (r) => expenseAmount(r)),
        contributorCount: new Set(bucket.ingresos.map((r) => NORM(r.contribuyenteNombre)).filter(Boolean)).size,
        providerCount: new Set(bucket.egresos.map((r) => NORM(r.proveedorNombre)).filter(Boolean)).size,
      };
    })
    .sort((a, b) => d3.descending(a.ingresoTotal + a.egresoTotal, b.ingresoTotal + b.egresoTotal));

  const donors = [...donorBuckets]
    .map(([id, bucket]) => ({
      kind: 'aportante',
      id,
      name: d3.mode(bucket.ingresos.map((r) => TEXT(r.contribuyenteNombre)).filter(Boolean)) || id,
      parties: uniq(bucket.ingresos.map((r) => r.candidateParty)),
      positions: uniq(bucket.ingresos.map((r) => r.candidatePosition)).sort(sortPos),
      ingresos: bucket.ingresos.sort((a, b) => d3.descending(parsePanamaDate(a.fecha), parsePanamaDate(b.fecha))),
      total: sum(bucket.ingresos, (r) => num(r.total)),
      candidateCount: new Set(bucket.ingresos.map((r) => candidateIdFromRow(r)).filter(Boolean)).size,
    }))
    .sort((a, b) => d3.descending(a.total, b.total));

  const providers = [...providerBuckets]
    .map(([id, bucket]) => ({
      kind: 'proveedor',
      id,
      name: d3.mode(bucket.egresos.map((r) => TEXT(r.proveedorNombre)).filter(Boolean)) || id,
      parties: uniq(bucket.egresos.map((r) => r.candidateParty)),
      positions: uniq(bucket.egresos.map((r) => r.candidatePosition)).sort(sortPos),
      egresos: bucket.egresos.sort((a, b) => d3.descending(parsePanamaDate(a.fecha), parsePanamaDate(b.fecha))),
      total: sum(bucket.egresos, (r) => expenseAmount(r)),
      candidateCount: new Set(bucket.egresos.map((r) => candidateIdFromRow(r)).filter(Boolean)).size,
    }))
    .sort((a, b) => d3.descending(a.total, b.total));

  const overviewCandidates = candidates.map((d) => ({
    ...d,
    position: d.positions[0] || '',
    party: d.parties[0] || 'Sin partido',
    province: d.provinces[0] || '',
    gender: d3.mode([...d.ingresos, ...d.egresos].map((r) => TEXT(r.candidateGender)).filter(Boolean)) || null,
  }));

  const donorDots = donors.map((d) => ({
    ...d,
    ingresoTotal: d.total,
    position: d.positions[0] || 'Sin cargo',
    party: d.parties[0] || 'Sin partido',
  }));

  return {
    ingresos,
    egresos,
    candidates,
    donors,
    providers,
    candidateById: new Map(candidates.map((d) => [d.id, d])),
    donorById: new Map(donors.map((d) => [d.id, d])),
    providerById: new Map(providers.map((d) => [d.id, d])),
    overview: { candidates: overviewCandidates, donors: donorDots },
  };
}

function targetNode(target) {
  if (typeof target === 'string') return document.querySelector(target);
  if (target instanceof Element) return target;
  return document.body.appendChild(document.createElement('div'));
}

function getCandidatesRows(store, position) {
  return topPartyRows(store.overview.candidates.filter((d) => d.position === position));
}

function getIncomeRows(store, position = ALL) {
  return byPos(store.ingresos, position);
}

function getExpenseRows(store, position = ALL) {
  return byPos(store.egresos, position);
}

function getParityRows(store, position) {
  return d3
    .rollups(
      store.overview.candidates.filter((d) => d.position === position && d.gender),
      (values) => {
        const mujeres = sum(values, (d) => (d.gender === 'female' ? 1 : 0));
        const hombres = sum(values, (d) => (d.gender === 'male' ? 1 : 0));
        return {
          provincia: values[0].province,
          mujeres,
          hombres,
          totalCandidaturas: values.length,
          paridad: values.length ? mujeres / values.length : 0,
        };
      },
      (d) => d.province,
    )
    .map(([, value]) => value);
}

function parityPositionLabel(position) {
  return position === 'Diputado(a)' ? 'Diputado/a' : position;
}

const PARITY_MAP_COLORS = {
  male: '#1d4ed8',
  midpoint: '#e9e2cf',
  female: '#b91c1c',
};

function getParitySummaryRows(store) {
  const counts = d3.rollup(
    store.overview.candidates.filter((d) => d.gender),
    (values) => ({
      male: sum(values, (d) => (d.gender === 'male' ? 1 : 0)),
      female: sum(values, (d) => (d.gender === 'female' ? 1 : 0)),
    }),
    (d) => d.position,
  );

  return POS.flatMap((position) => {
    const group = counts.get(position) || { male: 0, female: 0 };
    const groupLabel = parityPositionLabel(position);
    return [
      {
        group: position,
        groupLabel,
        series: 'male',
        seriesLabel: 'Varón',
        seriesIndex: 0,
        value: group.male,
        color: PARITY_MAP_COLORS.male,
      },
      {
        group: position,
        groupLabel,
        series: 'female',
        seriesLabel: 'Mujer',
        seriesIndex: 1,
        value: group.female,
        color: PARITY_MAP_COLORS.female,
      },
    ];
  });
}

function getFinancialRows(store, position, filter = 'all') {
  const rows = store.overview.candidates.filter(
    (d) =>
      d.position === position &&
      (filter === 'all' || (filter.startsWith('party:') ? d.party === filter.slice(6) : d.id === filter.slice(10))),
  );
  return d3
    .rollups(
      rows,
      (values) => ({
        provincia: values[0].province,
        cantidadCandidaturas: values.length,
        ingresoTotal: sum(values, (d) => d.ingresoTotal),
        egresoTotal: sum(values, (d) => d.egresoTotal),
      }),
      (d) => d.province,
    )
    .map(([, value]) => value);
}

function renderCandidateChart(store, position = POS[0]) {
  return beeswarm(getCandidatesRows(store, position), 'candidato', chartOpts);
}

function renderIncomeChart(store, position = ALL) {
  return incomeBreakdownChart(incomeBreakdown(getIncomeRows(store, position)), chartOpts);
}

function renderExpenseTimelineChart(store, position = ALL, grain = 'mes') {
  return wrapMobileScrollableChart(line(expenseTimeline(getExpenseRows(store, position), grain), chartOpts), 'plot');
}

function renderParityChart(store, position = POS[0]) {
  const root = document.createElement('div');
  root.className = 'mf-parity-layout';

  const mapWrap = document.createElement('div');
  mapWrap.className = 'mf-parity-layout__map';
  mapWrap.append(
    wrapMobileScrollableChart(
      mapChart({
        rows: getParityRows(store, position),
        valueKey: 'paridad',
        domain: [0, 1],
        valueFormat: (v) => d3.format('.0%')(v),
        colorScale: d3
          .scaleLinear()
          .domain([0, 0.5, 1])
          .range([PARITY_MAP_COLORS.male, PARITY_MAP_COLORS.midpoint, PARITY_MAP_COLORS.female])
          .interpolate(d3.interpolateRgb),
        tooltip: (row, value) =>
          `${row.provincia}\n${d3.format('.0%')(value)} mujeres\nMujeres: ${row.mujeres}\nHombres: ${row.hombres}\nTotal: ${row.totalCandidaturas}`,
      }),
      'map',
    ),
  );

  const breakdownWrap = document.createElement('div');
  breakdownWrap.className = 'mf-parity-layout__breakdown';
  const parityBreakdown = groupedBarsChart(getParitySummaryRows(store), {
    ...chartOpts,
    compact: isNarrowMobileViewport(),
  });
  if (parityBreakdown) parityBreakdown.classList.add('mf-parity-breakdown-chart');
  breakdownWrap.append(
    parityBreakdown ||
      Object.assign(document.createElement('div'), {
        className: 'empty',
        textContent: 'Sin datos.',
      }),
  );

  root.append(mapWrap, breakdownWrap);
  return root;
}

function renderFinancialMapChart(store, position = POS[0], metric = 'ingresoTotal', filter = 'all') {
  return wrapMobileScrollableChart(
    mapChart({
      rows: getFinancialRows(store, position, filter),
      valueKey: metric,
      valueFormat: SHORT,
      tooltip: (row, value) =>
        `${row.provincia}\n${metric === 'ingresoTotal' ? 'Ingresos' : 'Gastos'}: ${MONEY(value)}\n${row.cantidadCandidaturas} candidaturas`,
    }),
    'map',
  );
}

function renderDonorsChart(store, position = POS[0]) {
  const rows = store.overview.donors.filter((row) => row.position === position);
  const precomputedLayout = donorBeeswarmLayout.layoutsByPosition?.[position];
  const precomputedPositions =
    precomputedLayout?.signature === createDonorBeeswarmSignature(rows) ? precomputedLayout.positionsById : null;
  return wrapMobileScrollableChart(beeswarm(rows, 'aportante', { ...chartOpts, precomputedPositions }), 'beeswarm');
}

function renderExpenseTreemapChart(store) {
  return treemap(expenseTreemapBreakdown(store.egresos), chartOpts);
}

function renderHomeExpenseTreemapChart(store) {
  return treemap(expenseTreemapBreakdown(store.egresos), chartOpts);
}

const CONTRIBUTOR_HISTOGRAM_TABS = [
  { value: 'count', label: 'Por cantidad' },
  { value: 'sum', label: 'Por suma total' },
  { value: 'date', label: 'Por fecha de aporte' },
];

const CONTRIBUTOR_HISTOGRAM_POSITIONS = [...POS].reverse();
const CONTRIBUTOR_HISTOGRAM_BIN_STEP = 5000;

function contributorHistogramMode(value) {
  return CONTRIBUTOR_HISTOGRAM_TABS.some((tab) => tab.value === value) ? value : 'count';
}

function contributorTotalsByPosition(store) {
  return d3
    .rollups(
      store.ingresos.filter(
        (row) => TEXT(row.candidatePosition) && TEXT(row.contribuyenteNombre) && num(row.total) > 0,
      ),
      (values) => ({
        position: TEXT(values[0].candidatePosition),
        total: sum(values, (row) => num(row.total)),
        entries: values.length,
        firstDate: d3.min(values, (row) => parsePanamaDate(row.fecha)),
        lastDate: d3.max(values, (row) => parsePanamaDate(row.fecha)),
      }),
      (row) => TEXT(row.candidatePosition),
      (row) => NORM(row.contribuyenteNombre),
    )
    .flatMap(([position, donors]) =>
      donors.map(([, donor]) => ({
        ...donor,
        position,
      })),
    );
}

function contributionDatesByPosition(store) {
  return store.ingresos.flatMap((row) => {
    const position = TEXT(row.candidatePosition);
    const date = parsePanamaDate(row.fecha);
    const total = num(row.total);
    return position && date && total > 0 ? [{ position, date, total }] : [];
  });
}

function contributorDateExtent(rows) {
  const dates = rows
    .map((row) => +row.date)
    .filter(Number.isFinite)
    .sort(d3.ascending);
  if (!dates.length) return null;
  const min = dates.length > 200 ? d3.quantileSorted(dates, 0.01) : dates[0];
  const max = dates.length > 200 ? d3.quantileSorted(dates, 0.99) : dates[dates.length - 1];
  return [new Date(min), new Date(max)];
}

function roundedAmountDomainMax(maxValue) {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 20000;
  return Math.max(20000, Math.round(maxValue / 20000) * 20000 || 20000);
}

function contributorHistogramModel(store, mode = 'count') {
  const currentMode = contributorHistogramMode(mode);

  if (currentMode === 'date') {
    const rows = contributionDatesByPosition(store);
    const extent = contributorDateExtent(rows);
    if (!rows.length || !extent) return null;

    const [rawMin, rawMax] = extent;
    const minDate = d3.timeWeek.floor(rawMin);
    const maxDate = d3.timeWeek.offset(d3.timeWeek.ceil(rawMax), 1);
    const thresholds = d3.timeWeek.range(minDate, maxDate).map((date) => +date);
    const positions = CONTRIBUTOR_HISTOGRAM_POSITIONS.filter((position) =>
      rows.some((row) => row.position === position),
    );
    const minTime = +minDate;
    const maxTime = +maxDate;

    const series = positions.map((position) => {
      const values = rows.filter((row) => row.position === position);
      const bins = d3
        .bin()
        .domain([minTime, maxTime])
        .thresholds(thresholds)
        .value((row) => Math.max(minTime, Math.min(maxTime, +row.date)))(values)
        .map((bin) => ({
          x0: new Date(bin.x0),
          x1: new Date(bin.x1),
          count: bin.length,
          sum: sum(bin, (row) => row.total),
          y: bin.length,
        }));
      return { key: position, label: position, bins };
    });

    return {
      mode: currentMode,
      xType: 'date',
      xDomain: [minDate, maxDate],
      yMax: d3.max(series, (row) => d3.max(row.bins, (bin) => bin.y)) || 0,
      series,
    };
  }

  const contributors = contributorTotalsByPosition(store);
  if (!contributors.length) return null;

  const positions = CONTRIBUTOR_HISTOGRAM_POSITIONS.filter((position) =>
    contributors.some((row) => row.position === position),
  );
  const amountMax = roundedAmountDomainMax(d3.max(contributors, (row) => row.total) || 0);
  const thresholds = d3.range(0, amountMax + CONTRIBUTOR_HISTOGRAM_BIN_STEP, CONTRIBUTOR_HISTOGRAM_BIN_STEP);

  const series = positions.map((position) => {
    const values = contributors.filter((row) => row.position === position);
    const bins = d3
      .bin()
      .domain([0, amountMax])
      .thresholds(thresholds)
      .value((row) => Math.max(0, Math.min(amountMax, row.total)))(values)
      .map((bin) => ({
        x0: bin.x0,
        x1: bin.x1,
        count: bin.length,
        sum: sum(bin, (row) => row.total),
        y: currentMode === 'sum' ? sum(bin, (row) => row.total) : bin.length,
      }));
    return { key: position, label: position, bins };
  });

  return {
    mode: currentMode,
    xType: 'amount',
    xDomain: [0, amountMax],
    tickStep: 20000,
    yMax: d3.max(series, (row) => d3.max(row.bins, (bin) => bin.y)) || 0,
    series,
  };
}

function renderContributorHistogramChart(store, mode = 'count') {
  const model = contributorHistogramModel(store, mode);
  return model ? contributorHistogram(model, chartOpts) : null;
}

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const SUMMARY_ICONS = {
  candidates:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.5"></circle><path d="M6 20v-1.5A4.5 4.5 0 0 1 10.5 14h3A4.5 4.5 0 0 1 18 18.5V20"></path></svg>',
  income:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"></path><path d="M17.5 6.5H10a3.5 3.5 0 0 0 0 7h4a3.5 3.5 0 0 1 0 7H6.5"></path></svg>',
  expense:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"></path><path d="M17.5 6.5H10a3.5 3.5 0 0 0 0 7h4a3.5 3.5 0 0 1 0 7H6.5"></path></svg>',
  declarations:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"></path><path d="M14 2v5h5"></path></svg>',
};

function summaryItems(store) {
  return [
    { key: 'candidates', label: 'Candidatos', value: INT(store.candidates.length), icon: SUMMARY_ICONS.candidates },
    {
      key: 'income',
      label: 'Ingresos totales',
      value: MONEY(sum(store.ingresos, (d) => num(d.total))),
      icon: SUMMARY_ICONS.income,
    },
    {
      key: 'expense',
      label: 'Gastos totales',
      value: MONEY(sum(store.egresos, (d) => expenseAmount(d))),
      icon: SUMMARY_ICONS.expense,
    },
    {
      key: 'declarations',
      label: 'Declaraciones',
      value: INT(store.ingresos.length + store.egresos.length),
      icon: SUMMARY_ICONS.declarations,
    },
  ];
}

function summaryCardsMarkup(items) {
  return `<div class="mf-summary-grid">${items
    .map(
      (item) => `<article class="mf-summary-card">
        <div class="mf-summary-icon">${item.icon}</div>
        <div class="mf-summary-value">${esc(item.value)}</div>
        <div class="mf-summary-label">${esc(item.label)}</div>
      </article>`,
    )
    .join('')}</div>`;
}

const summaryCardsElementCss = `:host{display:block;min-width:0;color:#111827}${SUMMARY_CARDS_CSS}.loading,.error{padding:14px 0;color:#667085}`;
const bootstrapTabsCss = `.wc-tabs-wrap,.wc-tabs,.wc-tab-item,.wc-tab-link{box-sizing:border-box}.wc-tabs-wrap{margin:0 0 16px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans","Liberation Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";font-size:1rem;font-weight:400;line-height:1.5;color:#212529;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}.wc-tabs{display:flex;flex-wrap:wrap;margin-top:0;margin-bottom:0;padding-left:0;list-style:none;border-bottom:1px solid #dee2e6}.wc-tab-item{margin-bottom:-1px;flex:none;list-style:none}.wc-tab-link{display:block;padding:.5rem 1rem;background-color:transparent;color:inherit;font:inherit;line-height:1.5;text-decoration:none;white-space:nowrap}.wc-tabs .wc-tab-link{border:1px solid transparent;border-top-left-radius:.25rem;border-top-right-radius:.25rem}.wc-tabs .wc-tab-link:hover,.wc-tabs .wc-tab-link:focus{text-decoration:none;border-color:#e9ecef #e9ecef #dee2e6}.wc-tab-link:focus-visible{outline:2px solid rgba(0,123,255,.35);outline-offset:2px}.wc-tabs .wc-tab-link.active,.wc-tabs .wc-tab-item.show .wc-tab-link{color:#495057;background-color:#fff;border-color:#dee2e6 #dee2e6 #fff}@media (max-width:720px){.wc-tabs-wrap{margin-bottom:14px}.wc-tab-link{padding:.45rem .625rem;font-size:.84rem;line-height:1.35}}`;
const chartPanelCss = `:host{display:block;min-width:0;color:#111827;}.wc-panel{display:grid;gap:16px;padding:16px;background:#f8f8f8;border-radius:12px}.wc-title{margin:0;font:inherit;font-size:clamp(1.95rem,4vw,2.5rem);font-weight:500;line-height:1.05;letter-spacing:-.04em;overflow-wrap:anywhere}.wc-body,.wh-chart{min-width:0}.wc-body--bare{display:grid;gap:12px;min-width:0}.loading,.error,.empty{padding:14px 0;color:#667085}@media (max-width:720px){.wc-panel{gap:14px;padding:14px}.wc-title{font-size:clamp(1.5rem,8vw,2rem)}}`;
const chartElementCss = `${chartPanelCss}.wc-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:0 0 12px}.wc-field{display:grid;gap:4px;min-width:180px;color:#344054;}.wc-field select{padding:8px 12px;border:1px solid #e4e7ec;border-radius:999px;background:#fff;color:#344054;}${bootstrapTabsCss}.mf-map{overflow-x:auto;overflow-y:hidden}.mf-map svg{display:block;width:100%;height:auto;max-width:960px;margin:auto}.legend{display:flex;align-items:center;gap:10px;margin-top:10px;color:#667085;}.mf-grad{height:12px;flex:1;max-width:300px;border-radius:999px;background:linear-gradient(90deg,#eff6ff,#1d4ed8)}.mf-parity-layout{display:grid;gap:24px;align-items:start;grid-template-columns:minmax(0,1.7fr) minmax(210px,.65fr)}.mf-parity-layout__map,.mf-parity-layout__breakdown{min-width:0}.mf-parity-layout__breakdown{display:grid;align-content:start}.wc-mobile-scroll{min-width:0}@media (max-width:1040px){.mf-parity-layout{grid-template-columns:1fr}}@media (max-width:720px){.wc-mobile-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;padding:8px 0 8px 8px;border:1px solid #e4e7ec;background:#f8fafc}.wc-mobile-scroll__inner{width:min(200vw,1000px);min-width:720px;background:linear-gradient(180deg,#fbfdff 0%,#f3f6fa 100%)}.wc-mobile-scroll--plot>.wc-mobile-scroll__inner>svg{display:block;width:100%!important;height:auto}.mf-map.wc-mobile-map-shell{display:grid;gap:8px;overflow:visible}.wc-mobile-scroll--map .wc-mobile-scroll__inner>div{width:88%!important;max-width:840px!important;margin:0!important}.wc-mobile-scroll--map svg{display:block;width:100%!important;max-width:none!important;height:auto;margin:0!important}.mf-map.wc-mobile-map-shell>.legend{font-size:11px;gap:8px;margin-top:0}.mf-map.wc-mobile-map-shell>.legend .mf-legend-scale{max-width:320px}.mf-map.wc-mobile-map-shell>.legend .mf-legend-bar{height:10px}.mf-map.wc-mobile-map-shell>.legend .mf-legend-note{gap:6px}.wc-mobile-scroll--beeswarm .beeswarm{width:100%!important;max-width:none!important}.wc-mobile-scroll--beeswarm .beeswarm svg{display:block;width:100%!important;max-width:none!important;height:auto}.wc-mobile-scroll--treemap .tm-root,.wc-mobile-scroll--treemap .tm-stage,.wc-mobile-scroll--treemap .tm-canvas{width:100%}.wc-mobile-scroll--treemap .tm-canvas svg{display:block;width:100%!important;height:100%!important;max-width:none!important}.mf-parity-breakdown-chart{justify-items:center;gap:12px}.mf-parity-breakdown-chart .mf-grouped-bars__legend{gap:14px}.mf-parity-breakdown-chart .mf-grouped-bars__legend-item{font-size:13px}.mf-parity-breakdown-chart .mf-grouped-bars__legend-dot{width:11px;height:11px}}${incomeBreakdownChartCss}${groupedBarsChartCss}`;
const contributorHistogramElementCss = `${chartPanelCss}${bootstrapTabsCss}`;

function attr(el, name, fallback) {
  return el.getAttribute(name) || fallback;
}

function resolveStoreForElement(el) {
  const hasWindowData =
    typeof window !== 'undefined' &&
    Array.isArray(window.documentosIngresos) &&
    Array.isArray(window.documentosEgresos);
  if (hasWindowData && !el.hasAttribute('ingresos-url') && !el.hasAttribute('egresos-url')) {
    const key = 'window';
    if (!STORE_CACHE.has(key)) STORE_CACHE.set(key, Promise.resolve(buildStore(resolveDatasets())));
    return STORE_CACHE.get(key);
  }
  const ingresosUrl = attr(el, 'ingresos-url', DEFAULT_INGRESOS_URL);
  const egresosUrl = attr(el, 'egresos-url', DEFAULT_EGRESOS_URL);
  const key = `${ingresosUrl}|${egresosUrl}`;
  if (!STORE_CACHE.has(key)) {
    STORE_CACHE.set(
      key,
      loadCsvDatasets({ ingresosUrl, egresosUrl, assignToWindow: false }).then((datasets) => buildStore(datasets)),
    );
  }
  return STORE_CACHE.get(key);
}

function createTabsControl(control, onSelect, wrapClassName = 'wc-tabs-wrap') {
  const wrap = document.createElement('div');
  wrap.className = wrapClassName;

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

  wrap.append(list);
  return wrap;
}

function createChartPanel(title) {
  const panel = document.createElement('section');
  panel.className = 'wc-panel';

  const heading = document.createElement('h2');
  heading.className = 'wc-title';
  heading.textContent = title;

  const body = document.createElement('div');
  body.className = 'wc-body';

  panel.append(heading, body);
  return { panel, body };
}

function createBareChartBody() {
  const body = document.createElement('div');
  body.className = 'wc-body wc-body--bare';
  return body;
}

function isNarrowMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

function wrapMobileScrollableChart(node, variant) {
  if (!node || !isNarrowMobileViewport()) return node;
  if (variant === 'map' && node.classList?.contains('mf-map')) {
    const [stage, legend] = Array.from(node.children);
    if (!stage) return node;
    const scroll = document.createElement('div');
    scroll.className = 'wc-mobile-scroll wc-mobile-scroll--map';
    const inner = document.createElement('div');
    inner.className = 'wc-mobile-scroll__inner';
    inner.append(stage);
    scroll.append(inner);
    node.classList.add('wc-mobile-map-shell');
    node.prepend(scroll);
    if (legend) node.append(legend);
    return node;
  }
  const wrap = document.createElement('div');
  wrap.className = `wc-mobile-scroll wc-mobile-scroll--${variant}`;
  const inner = document.createElement('div');
  inner.className = 'wc-mobile-scroll__inner';
  inner.append(node);
  wrap.append(inner);
  return wrap;
}

function defineSummaryCardsElement() {
  if (typeof window === 'undefined' || customElements.get('panama-resumen-cards')) return;
  class PanamaSummaryCardsElement extends HTMLElement {
    static get observedAttributes() {
      return ['ingresos-url', 'egresos-url'];
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    async render() {
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const token = (this._token || 0) + 1;
      this._token = token;
      root.innerHTML = `<style>${summaryCardsElementCss}</style><div class="loading">Cargando…</div>`;
      try {
        const store = await resolveStoreForElement(this);
        if (token !== this._token) return;
        root.innerHTML = `<style>${summaryCardsElementCss}</style>${summaryCardsMarkup(summaryItems(store))}`;
      } catch (error) {
        if (token !== this._token) return;
        root.innerHTML = `<style>${summaryCardsElementCss}</style><div class="error">${esc(String(error?.message || error))}</div>`;
      }
    }
  }

  customElements.define('panama-resumen-cards', PanamaSummaryCardsElement);
}

function defineChartElement(name, title, observedAttributes, renderChart, getControls = () => []) {
  if (typeof window === 'undefined' || customElements.get(name)) return;
  class PanamaChartElement extends HTMLElement {
    static get observedAttributes() {
      return observedAttributes;
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    async render() {
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const token = (this._token || 0) + 1;
      this._token = token;
      const bare = this.hasAttribute('bare');
      const previousMapScroll = root.querySelector('.wc-mobile-scroll--map');
      if (previousMapScroll) this._mapScrollLeft = previousMapScroll.scrollLeft;
      root.innerHTML = `<style>${chartElementCss}</style>`;
      if (bare) {
        root.append(Object.assign(document.createElement('div'), { className: 'loading', textContent: 'Cargando…' }));
      } else {
        const loadingPanel = createChartPanel(title);
        loadingPanel.body.append(
          Object.assign(document.createElement('div'), { className: 'loading', textContent: 'Cargando…' }),
        );
        root.append(loadingPanel.panel);
      }
      try {
        const store = await resolveStoreForElement(this);
        if (token !== this._token) return;
        const controls = getControls(this, store);
        const node = renderChart(this, store);
        root.innerHTML = `<style>${chartElementCss}</style>`;
        const panel = bare ? null : createChartPanel(title);
        const body = bare ? createBareChartBody() : panel.body;
        if (controls.length === 1) {
          body.append(createTabsControl(controls[0], (value) => this.setAttribute(controls[0].attr, value)));
        } else if (controls.length) {
          const wrap = document.createElement('div');
          wrap.className = 'wc-controls';
          controls.forEach((control) => {
            const label = document.createElement('label');
            label.className = 'wc-field';
            label.textContent = control.label;
            const select = document.createElement('select');
            control.options.forEach((option) => {
              const opt = document.createElement('option');
              opt.value = option.value;
              opt.textContent = option.label;
              if (option.value === control.value) opt.selected = true;
              select.append(opt);
            });
            select.addEventListener('input', () => this.setAttribute(control.attr, select.value));
            label.append(select);
            wrap.append(label);
          });
          body.append(wrap);
        }
        body.append(
          node || Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Sin datos.' }),
        );
        if (bare) {
          root.append(body);
        } else {
          root.append(panel.panel);
        }
        const nextMapScroll = root.querySelector('.wc-mobile-scroll--map');
        if (nextMapScroll && Number.isFinite(this._mapScrollLeft)) {
          requestAnimationFrame(() => {
            nextMapScroll.scrollLeft = this._mapScrollLeft;
          });
        }
      } catch (error) {
        if (token !== this._token) return;
        root.innerHTML = `<style>${chartElementCss}</style>`;
        const errorNode = Object.assign(document.createElement('div'), {
          className: 'error',
          textContent: String(error?.message || error),
        });
        if (bare) {
          root.append(errorNode);
        } else {
          const errorPanel = createChartPanel(title);
          errorPanel.body.append(errorNode);
          root.append(errorPanel.panel);
        }
      }
    }
  }

  customElements.define(name, PanamaChartElement);
}

function defineContributorHistogramElement() {
  if (typeof window === 'undefined' || customElements.get('panama-histograma-aportantes-chart')) return;

  class PanamaContributorHistogramElement extends HTMLElement {
    static get observedAttributes() {
      return ['mode', 'ingresos-url', 'egresos-url'];
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    async render() {
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const token = (this._token || 0) + 1;
      this._token = token;
      const mode = contributorHistogramMode(attr(this, 'mode', 'count'));
      const bare = this.hasAttribute('bare');
      root.innerHTML = `<style>${contributorHistogramElementCss}</style>`;
      if (bare) {
        root.append(Object.assign(document.createElement('div'), { className: 'loading', textContent: 'Cargando…' }));
      } else {
        const loadingPanel = createChartPanel('Histograma de aportantes');
        loadingPanel.body.append(
          Object.assign(document.createElement('div'), { className: 'loading', textContent: 'Cargando…' }),
        );
        root.append(loadingPanel.panel);
      }
      try {
        const store = await resolveStoreForElement(this);
        if (token !== this._token) return;
        const node = renderContributorHistogramChart(store, mode);
        root.innerHTML = `<style>${contributorHistogramElementCss}</style>`;
        const panel = bare ? null : createChartPanel('Histograma de aportantes');
        const body = bare ? createBareChartBody() : panel.body;
        const chart = document.createElement('div');
        chart.className = 'wh-chart';
        body.append(
          createTabsControl({ label: 'Modo', value: mode, options: CONTRIBUTOR_HISTOGRAM_TABS }, (value) =>
            this.setAttribute('mode', value),
          ),
        );
        body.append(chart);
        chart.append(
          node || Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Sin datos.' }),
        );
        if (bare) {
          root.append(body);
        } else {
          root.append(panel.panel);
        }
      } catch (error) {
        if (token !== this._token) return;
        root.innerHTML = `<style>${contributorHistogramElementCss}</style>`;
        const errorNode = Object.assign(document.createElement('div'), {
          className: 'error',
          textContent: String(error?.message || error),
        });
        if (bare) {
          root.append(errorNode);
        } else {
          const errorPanel = createChartPanel('Histograma de aportantes');
          errorPanel.body.append(errorNode);
          root.append(errorPanel.panel);
        }
      }
    }
  }

  customElements.define('panama-histograma-aportantes-chart', PanamaContributorHistogramElement);
}

function defineReactElement(name, observedAttributes, renderApp, options = {}) {
  const { shadow = true } = options;
  if (typeof window === 'undefined' || customElements.get(name)) return;
  class PanamaReactElement extends HTMLElement {
    static get observedAttributes() {
      return observedAttributes;
    }

    applyAttrs(patch = {}) {
      this._suppressRender = true;
      Object.entries(patch).forEach(([key, value]) => {
        if (value == null || value === '') this.removeAttribute(key);
        else this.setAttribute(key, String(value));
      });
      this._suppressRender = false;
      if (this.isConnected) this.render();
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback(name) {
      if (name === 'ingresos-url' || name === 'egresos-url') this._store = null;
      if (!this._suppressRender && this.isConnected) this.render();
    }

    disconnectedCallback() {
      this._root?.unmount();
      this._root = null;
      this._token = 0;
    }

    async render() {
      const token = (this._token || 0) + 1;
      this._token = token;
      const target = shadow ? this.shadowRoot || this.attachShadow({ mode: 'open' }) : this;
      if (!shadow) this.style.display = 'block';
      this._root ||= createRoot(target);
      if (this._store) {
        this._root.render(renderApp({ element: this, store: this._store, loading: false, error: null }));
        return;
      }
      this._root.render(renderApp({ element: this, store: null, loading: true, error: null }));
      try {
        const store = await resolveStoreForElement(this);
        if (token !== this._token) return;
        this._store = store;
        this._root.render(renderApp({ element: this, store, loading: false, error: null }));
      } catch (error) {
        if (token !== this._token) return;
        this._root.render(
          renderApp({ element: this, store: null, loading: false, error: String(error?.message || error) }),
        );
      }
    }
  }

  customElements.define(name, PanamaReactElement);
}

function defineRouterElement() {
  if (typeof window === 'undefined' || customElements.get('panama-fichas-router')) return;
  class PanamaFichasRouterElement extends HTMLElement {
    static get observedAttributes() {
      return ['ingresos-url', 'egresos-url', 'empty-hash'];
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    disconnectedCallback() {
      this._root?.unmount();
      this._root = null;
      this._token = 0;
    }

    async render() {
      const token = (this._token || 0) + 1;
      this._token = token;
      try {
        const store = await resolveStoreForElement(this);
        if (token !== this._token) return;
        this._root ||= createRoot(this);
        this._root.render(<ModalRouter store={store} emptyHash={attr(this, 'empty-hash', '#/')} />);
      } catch (error) {
        if (token !== this._token) return;
        this.textContent = String(error?.message || error);
      }
    }
  }

  customElements.define('panama-fichas-router', PanamaFichasRouterElement);
}

let autoRouterEnabled = false;

function ensureAutoRouterElement() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('panama-fichas-router') || !document.body) return;
  document.body.appendChild(document.createElement('panama-fichas-router'));
}

function enableAutoRouter() {
  if (typeof window === 'undefined' || autoRouterEnabled) return;
  autoRouterEnabled = true;

  const maybeMountRouter = () => {
    if (parseHashRoute(window.location.hash).kind === 'none') return;
    ensureAutoRouterElement();
  };

  const init = () => {
    maybeMountRouter();
    window.addEventListener('hashchange', maybeMountRouter);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
    return;
  }

  init();
}

function defineChartElements() {
  inject();
  defineSummaryCardsElement();
  defineChartElement(
    'panama-candidaturas-chart',
    'Candidaturas por volumen de fondos',
    ['position', 'ingresos-url', 'egresos-url'],
    (el, store) => renderCandidateChart(store, attr(el, 'position', POS[0])),
    (el) => [
      {
        attr: 'position',
        label: 'Cargo',
        value: attr(el, 'position', POS[0]),
        options: POS.map((value) => ({ value, label: value })),
      },
    ],
  );
  defineChartElement(
    'panama-financiacion-chart',
    'Financiación por tipo',
    ['position', 'ingresos-url', 'egresos-url'],
    (el, store) => renderIncomeChart(store, attr(el, 'position', ALL)),
    (el, store) => [
      {
        attr: 'position',
        label: 'Cobertura',
        value: attr(el, 'position', ALL),
        options: [ALL, ...uniq(store.ingresos.map((d) => d.candidatePosition)).sort(sortPos)].map((value) => ({
          value,
          label: value,
        })),
      },
    ],
  );
  defineChartElement(
    'panama-gastos-tiempo-chart',
    'Línea de tiempo de gastos',
    ['position', 'grain', 'ingresos-url', 'egresos-url'],
    (el, store) => renderExpenseTimelineChart(store, attr(el, 'position', ALL), 'semana'),
    (el, store) => [
      {
        attr: 'position',
        label: 'Cobertura',
        value: attr(el, 'position', ALL),
        options: [ALL, ...uniq(store.egresos.map((d) => d.candidatePosition)).sort(sortPos)].map((value) => ({
          value,
          label: value,
        })),
      },
    ],
  );
  defineChartElement(
    'panama-paridad-chart',
    'Paridad de género por provincia',
    ['position', 'ingresos-url', 'egresos-url'],
    (el, store) => renderParityChart(store, attr(el, 'position', POS[0])),
    (el) => [
      {
        attr: 'position',
        label: 'Cargo',
        value: attr(el, 'position', POS[0]),
        options: POS.map((value) => ({ value, label: value })),
      },
    ],
  );
  defineChartElement(
    'panama-mapa-financiero-chart',
    'Mapa financiero',
    ['position', 'metric', 'filter', 'ingresos-url', 'egresos-url'],
    (el, store) =>
      renderFinancialMapChart(
        store,
        attr(el, 'position', POS[0]),
        attr(el, 'metric', 'ingresoTotal'),
        attr(el, 'filter', 'all'),
      ),
    (el, store) => {
      const position = attr(el, 'position', POS[0]);
      const rows = store.overview.candidates.filter((d) => d.position === position);
      return [
        { attr: 'position', label: 'Cargo', value: position, options: POS.map((value) => ({ value, label: value })) },
        {
          attr: 'metric',
          label: 'Indicador',
          value: attr(el, 'metric', 'ingresoTotal'),
          options: [
            { value: 'ingresoTotal', label: 'Ingresos' },
            { value: 'egresoTotal', label: 'Gastos' },
          ],
        },
        {
          attr: 'filter',
          label: 'Filtro',
          value: attr(el, 'filter', 'all'),
          options: [
            { value: 'all', label: 'Todas las candidaturas' },
            ...uniq(rows.map((d) => d.party))
              .sort(d3.ascending)
              .map((value) => ({ value: `party:${value}`, label: `Partido: ${value}` })),
            ...rows
              .slice()
              .sort((a, b) => d3.ascending(candidateLabel(a), candidateLabel(b)))
              .map((candidate) => ({
                value: `candidate:${candidate.id}`,
                label: `Candidatura: ${candidateLabel(candidate)}`,
              })),
          ],
        },
      ];
    },
  );
  defineChartElement(
    'panama-aportantes-chart',
    'Aportantes',
    ['position', 'ingresos-url', 'egresos-url'],
    (el, store) => renderDonorsChart(store, attr(el, 'position', POS[0])),
    (el) => [
      {
        attr: 'position',
        label: 'Cargo',
        value: attr(el, 'position', POS[0]),
        options: POS.map((value) => ({ value, label: value })),
      },
    ],
  );
  defineContributorHistogramElement();
  defineChartElement(
    'panama-gastos-treemap-chart',
    'Tipo de gastos de campaña',
    ['ingresos-url', 'egresos-url'],
    (_, store) => renderExpenseTreemapChart(store),
  );
  defineChartElement(
    'panama-home-gastos-treemap-chart',
    'Tipo de gastos de campaña',
    ['ingresos-url', 'egresos-url'],
    (_, store) => renderHomeExpenseTreemapChart(store),
  );
  defineReactElement(
    'panama-buscador-general',
    ['search', 'ingresos-url', 'egresos-url'],
    ({ element, store, loading, error }) => (
      <GeneralSearchElementApp element={element} store={store} loading={loading} error={error} />
    ),
    { shadow: false },
  );
  defineReactElement(
    'panama-candidatos-table',
    ['search', 'party', 'province', 'position', 'ingresos-url', 'egresos-url'],
    ({ element, store, loading, error }) => (
      <CandidatesTableElementApp element={element} store={store} loading={loading} error={error} />
    ),
  );
  defineReactElement(
    'panama-transacciones-table',
    ['search', 'candidate', 'candidate-id', 'kind', 'position', 'ingresos-url', 'egresos-url'],
    ({ element, store, loading, error }) => (
      <TransactionsTableElementApp element={element} store={store} loading={loading} error={error} />
    ),
  );
  defineRouterElement();
  enableAutoRouter();
}

function App({ store, emptyHash }) {
  return <ModalRouter store={store} emptyHash={emptyHash} />;
}

function mount(options = {}) {
  inject();
  const target = targetNode(options.target);
  if (!target) throw new Error('No encontré el target para montar el embed.');
  const store = options.store || buildStore(resolveDatasets(options));
  const emptyHash = options.emptyHash || '#/';
  const root = ROOTS.get(target) || createRoot(target);
  ROOTS.set(target, root);
  const rerender = () => root.render(<App store={store} emptyHash={emptyHash} />);
  rerender();
  return {
    target,
    store,
    rerender,
    unmount() {
      root.unmount();
      ROOTS.delete(target);
    },
  };
}

defineChartElements();

const api = {
  mount,
  buildStore,
  loadCsvDatasets,
  parseCsvText,
  parseHashRoute,
  buildHashRoute,
  slugify,
  defineChartElements,
};

if (typeof window !== 'undefined') {
  window.MonitoreoFichas = api;
  window.MonitoreoPanama = api;
}

export {
  buildHashRoute,
  buildStore,
  defineChartElements,
  loadCsvDatasets,
  mount,
  parseCsvText,
  parseHashRoute,
  slugify,
};
