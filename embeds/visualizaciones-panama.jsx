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

const SUMMARY_CARDS_CSS = `.mf-summary-grid{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.mf-summary-card{min-height:200px;padding:34px 24px 28px;display:grid;justify-items:center;align-content:center;text-align:center;background:#fff;border:1px solid #d0d5dd;border-radius:18px;box-shadow:0 1px 3px rgba(16,24,40,.08)}.mf-summary-icon{width:64px;height:64px;display:grid;place-items:center;color:#1f1f24}.mf-summary-icon svg{width:64px;height:64px;display:block;stroke:currentColor;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}.mf-summary-value{margin-top:16px;font-size:clamp(1.15rem,1.7vw,1.55rem);font-weight:700;line-height:1.1;letter-spacing:-.015em;overflow-wrap:anywhere}.mf-summary-label{margin-top:10px;font-size:clamp(.72rem,1vw,.9rem);line-height:1.15;color:#202531}@media (max-width:720px){.mf-summary-grid{gap:16px}.mf-summary-card{min-height:176px;padding:28px 20px 24px}.mf-summary-value{font-size:clamp(1.05rem,5vw,1.35rem)}.mf-summary-label{font-size:clamp(.7rem,3.2vw,.82rem)}}`;

let cssDone = false;

function province(v) {
  return PROVINCE_ALIASES.get(NORM(v)) ?? TEXT(v);
}

function inject() {
  if (cssDone || typeof document === 'undefined') return;
  document.head.append(
    Object.assign(document.createElement('style'), {
      textContent: `
  :root{--bg:#f3f5f7;--card:#fff;--ink:#111827;--muted:#667085;--line:#e4e7ec;--blue:#2f80ed}body{margin:0;background:radial-gradient(circle at top,rgba(47,128,237,.1),transparent 32%),var(--bg);color:var(--ink);}
  a{color:inherit}.mf-root{max-width:1200px;margin:0 auto;padding:24px}.mf-hero,.mf-card,.mf-modal-body,.mf-stat{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:20px;box-shadow:0 12px 32px rgba(15,23,42,.05)}
  .mf-hero{padding:20px 22px;display:grid;gap:10px}.mf-kicker{margin:0;color:var(--blue);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mf-title{margin:0;font-size:clamp(2rem,4vw,3rem);line-height:.95}.mf-sub{margin:0;color:var(--muted);max-width:72ch}.mf-grid{display:grid;gap:16px;margin-top:16px}.mf-card{padding:18px}.mf-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:end;margin-bottom:12px}.mf-card h2,.mf-modal-body h2{margin:0;font-size:1.25rem}.mf-note{margin:0;color:var(--muted)}.mf-controls{display:flex;flex-wrap:wrap;gap:8px}.mf-toggle{display:flex;flex-wrap:wrap;gap:6px}.mf-toggle button{padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;color:#344054;cursor:pointer}.mf-toggle button.on{background:var(--blue);border-color:var(--blue);color:#fff}.mf-section-body{display:grid;gap:16px}.mf-section-main{min-width:0}.mf-figure,.mf-map{overflow:auto}.mf-empty{color:var(--muted);padding:14px 0}.mf-stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin:12px 0 16px}.mf-stat{padding:16px;text-align:center}.mf-stat b{display:block;font-size:1.6rem;line-height:1}.mf-meta{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-bottom:16px}.mf-meta div{min-width:0}.mf-meta p{margin:.1rem 0 0;color:var(--muted)}.mf-table-wrap{overflow:auto;max-height:55vh;border:1px solid var(--line);border-radius:14px}.mf-table{width:100%;border-collapse:collapse;min-width:720px;background:#fff}.mf-table th,.mf-table td{padding:12px 14px;border-bottom:1px solid #eef1f4;text-align:left;vertical-align:top}.mf-table th{position:sticky;top:0;background:#fff;color:#667085;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.mf-strong{font-weight:700}.mf-overlay{position:fixed;inset:0;padding:16px;background:rgba(15,23,42,.42);backdrop-filter:blur(6px);display:flex;justify-content:center;align-items:flex-start;z-index:9999}.mf-modal{width:min(1180px,100%);max-height:calc(100vh - 32px);overflow:auto}.mf-modal-body{padding:20px}.mf-close-row{display:flex;justify-content:flex-end;position:sticky;top:0;z-index:2}.mf-close{width:40px;height:40px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.92);font-size:24px;cursor:pointer}.mf-map svg{display:block;width:100%;height:auto;max-width:960px;margin:auto}.mf-map .legend{display:grid;gap:8px;margin-top:12px;color:var(--muted);font-size:12px}.mf-legend-scale{display:grid;gap:6px}.mf-legend-bar{height:12px;border:1px solid var(--line);border-radius:999px}.mf-legend-ticks{position:relative;height:16px}.mf-legend-ticks.is-single{height:auto}.mf-legend-tick{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}.mf-legend-tick:first-child{transform:none}.mf-legend-tick:last-child{transform:translateX(-100%)}.mf-legend-ticks.is-single .mf-legend-tick{position:static;transform:none}.mf-legend-note{display:flex;align-items:center;gap:8px}.mf-legend-swatch{width:12px;height:12px;border:1px solid #a6a6a6;border-radius:999px;background:#f2f2f2;flex:none}
  ${incomeBreakdownChartCss}
  ${SUMMARY_CARDS_CSS}
  @media (max-width:720px){.mf-root{padding:14px}.mf-card,.mf-modal-body,.mf-hero{border-radius:16px;padding:16px}}
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
  return line(expenseTimeline(getExpenseRows(store, position), grain), chartOpts);
}

function renderParityChart(store, position = POS[0]) {
  const root = document.createElement('div');
  root.className = 'mf-parity-layout';

  const mapWrap = document.createElement('div');
  mapWrap.className = 'mf-parity-layout__map';
  mapWrap.append(
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
  );

  const breakdownWrap = document.createElement('div');
  breakdownWrap.className = 'mf-parity-layout__breakdown';
  breakdownWrap.append(
    groupedBarsChart(getParitySummaryRows(store), chartOpts) ||
      Object.assign(document.createElement('div'), {
        className: 'empty',
        textContent: 'Sin datos.',
      }),
  );

  root.append(mapWrap, breakdownWrap);
  return root;
}

function renderFinancialMapChart(store, position = POS[0], metric = 'ingresoTotal', filter = 'all') {
  return mapChart({
    rows: getFinancialRows(store, position, filter),
    valueKey: metric,
    valueFormat: SHORT,
    tooltip: (row, value) =>
      `${row.provincia}\n${metric === 'ingresoTotal' ? 'Ingresos' : 'Gastos'}: ${MONEY(value)}\n${row.cantidadCandidaturas} candidaturas`,
  });
}

function renderDonorsChart(store) {
  const rows = store.overview.donors;
  const precomputedPositions =
    donorBeeswarmLayout.signature === createDonorBeeswarmSignature(rows) ? donorBeeswarmLayout.positionsById : null;
  return beeswarm(rows, 'aportante', { ...chartOpts, precomputedPositions });
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

const chartElementCss = `:host{display:block;}.wc-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:0 0 12px}.wc-field{display:grid;gap:4px;min-width:180px;color:#344054;}.wc-field select{padding:8px 12px;border:1px solid #e4e7ec;border-radius:999px;background:#fff;color:#344054;}.mf-map{overflow:auto}.mf-map svg{display:block;width:100%;height:auto;max-width:960px;margin:auto}.legend{display:flex;align-items:center;gap:10px;margin-top:10px;color:#667085;}.mf-grad{height:12px;flex:1;max-width:300px;border-radius:999px;background:linear-gradient(90deg,#eff6ff,#1d4ed8)}.mf-parity-layout{display:grid;gap:24px;align-items:start;grid-template-columns:minmax(0,1.7fr) minmax(210px,.65fr)}.mf-parity-layout__map,.mf-parity-layout__breakdown{min-width:0}.mf-parity-layout__breakdown{display:grid;align-content:start}@media (max-width:1040px){.mf-parity-layout{grid-template-columns:1fr}}${incomeBreakdownChartCss}${groupedBarsChartCss}.empty,.error,.loading{padding:14px 0;color:#667085;}`;
const summaryCardsElementCss = `:host{display:block;;color:#111827}${SUMMARY_CARDS_CSS}.loading,.error{padding:14px 0;color:#667085}`;
const contributorHistogramElementCss = `:host{display:block;color:#111827;}.wh-root{display:grid;gap:18px}.wh-title{margin:0;font-size:clamp(1.95rem,4vw,2.5rem);font-weight:500;line-height:1.05;letter-spacing:-.04em}.wh-tabs{display:flex;gap:28px;overflow:auto;border-bottom:1px solid #d0d7de}.wh-tab{appearance:none;border:0;border-bottom:4px solid transparent;background:none;color:#4b5563;cursor:pointer;font-weight:600;font-size:16px;line-height:1.2;font-family:inherit;margin:0;padding:0 4px 14px;white-space:nowrap}.wh-tab[aria-selected='true']{color:#3b82f6;border-bottom-color:#3b82f6}.wh-chart{min-width:0}.loading,.error,.empty{padding:14px 0;color:#667085}@media (max-width:720px){.wh-root{gap:14px}.wh-title{font-size:clamp(1.5rem,8vw,2rem)}.wh-tabs{gap:18px}.wh-tab{font-size:15px;padding-bottom:12px}}`;

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

function defineChartElement(name, observedAttributes, renderChart, getControls = () => []) {
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
      root.innerHTML = `<style>${chartElementCss}</style><div class="loading">Cargando…</div>`;
      try {
        const store = await resolveStoreForElement(this);
        if (token !== this._token) return;
        const controls = getControls(this, store);
        const node = renderChart(this, store);
        root.innerHTML = `<style>${chartElementCss}</style>`;
        if (controls.length) {
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
          root.append(wrap);
        }
        root.append(
          node || Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Sin datos.' }),
        );
      } catch (error) {
        if (token !== this._token) return;
        root.innerHTML = `<style>${chartElementCss}</style><div class="error">${String(error?.message || error)}</div>`;
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
      root.innerHTML = `<style>${contributorHistogramElementCss}</style><div class="loading">Cargando…</div>`;
      try {
        const store = await resolveStoreForElement(this);
        if (token !== this._token) return;
        const node = renderContributorHistogramChart(store, mode);
        root.innerHTML = `<style>${contributorHistogramElementCss}</style><section class="wh-root"><h2 class="wh-title">Histograma de aportantes</h2><div class="wh-tabs" role="tablist">${CONTRIBUTOR_HISTOGRAM_TABS.map(
          (tab) =>
            `<button class="wh-tab" type="button" role="tab" data-mode="${tab.value}" aria-selected="${tab.value === mode}">${tab.label}</button>`,
        ).join('')}</div><div class="wh-chart"></div></section>`;
        const chart = root.querySelector('.wh-chart');
        chart.append(
          node || Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Sin datos.' }),
        );
        root.querySelectorAll('.wh-tab').forEach((button) => {
          button.addEventListener('click', () => {
            const nextMode = button.getAttribute('data-mode');
            if (nextMode && nextMode !== mode) this.setAttribute('mode', nextMode);
          });
        });
      } catch (error) {
        if (token !== this._token) return;
        root.innerHTML = `<style>${contributorHistogramElementCss}</style><div class="error">${esc(String(error?.message || error))}</div>`;
      }
    }
  }

  customElements.define('panama-histograma-aportantes-chart', PanamaContributorHistogramElement);
}

function defineReactElement(name, observedAttributes, renderApp) {
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
      const shadowRoot = this.shadowRoot || this.attachShadow({ mode: 'open' });
      this._root ||= createRoot(shadowRoot);
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
  defineChartElement('panama-aportantes-chart', ['ingresos-url', 'egresos-url'], (_, store) =>
    renderDonorsChart(store),
  );
  defineContributorHistogramElement();
  defineChartElement('panama-gastos-treemap-chart', ['ingresos-url', 'egresos-url'], (_, store) =>
    renderExpenseTreemapChart(store),
  );
  defineChartElement('panama-home-gastos-treemap-chart', ['ingresos-url', 'egresos-url'], (_, store) =>
    renderHomeExpenseTreemapChart(store),
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
