import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';
import ingresosDatasetUrl from './data/documentos-ingresos.csv?url';
import egresosDatasetUrl from './data/documentos-egresos.csv?url';
import { bars } from './charts/bars.js';
import { beeswarm } from './charts/beeswarm.js';
import { contributorHistogram } from './charts/contributor-histogram.js';
import { line } from './charts/line.js';
import { mapChart } from './charts/map.js';
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

const PROVINCE_ALIASES = new Map(
  Object.entries({
    'bocas del toro': 'Bocas del Toro',
    'chiriqui': 'Chiriquí',
    'cocle': 'Coclé',
    'colon': 'Colón',
    'darien': 'Darién',
    'herrera': 'Herrera',
    'los santos': 'Los Santos',
    'panama': 'Panamá',
    'panama oeste': 'Panamá Oeste',
    'veraguas': 'Veraguas',
    'comarca embera wounaan': 'Emberá-Wounaan',
    'comarca guna yala': 'Guna Yala',
    'comarca ngabe bugle': 'Ngäbe-Buglé',
    'embera wounaan': 'Emberá-Wounaan',
    'guna yala': 'Guna Yala',
    'ngabe bugle': 'Ngäbe-Buglé',
  }),
);

const PROVINCES = new Map([
  ['g18', 'Bocas del Toro'],
  ['cocle', 'Coclé'],
  ['colon', 'Colón'],
  ['chiriqui', 'Chiriquí'],
  ['darien', 'Darién'],
  ['herrera', 'Herrera'],
  ['los_santos', 'Los Santos'],
  ['panama', 'Panamá'],
  ['veraguas', 'Veraguas'],
  ['panama_oeste', 'Panamá Oeste'],
  ['embera_wounaan', 'Emberá-Wounaan'],
  ['guna_yala', 'Guna Yala'],
  ['naso_tjer_di', 'Naso Tjër Di'],
  ['ngabe_bugle', 'Ngäbe-Buglé'],
]);

const MAP = `<polygon points="455.3,617.2 496.1,617.2 555.6,676.7 608,676.7 632.1,700.8 702.3,700.8 735.2,668 783.8,668 783.8,722.5 755.3,751.2 755.3,798.3 706.6,846.9 600.5,740.8 483.2,740.8 459.9,764.1 431.7,735.8 349.7,735.8 290.3,676.5 136.3,676.5 100.1,712.7 100.1,825 67.1,792.9 67.1,715.2 33.5,681.6 126.7,588.4 126.7,518.8 79.8,470.8 168,382.6 230.5,382.6 285.3,437.5 365.7,437.5 384.6,455.7 455.3,455.7" id="chiriqui"/><polygon points="2664.2,385.6 2720.9,442.1 2847.5,568.8 2907.5,508.7 2907.5,485.8 2837.8,485.8 2552.5,200.5 2512.5,200.5 2485.8,173.8 2448.2,173.8 2409,134.7 2346.8,134.7 2316.4,104.3 2052.5,104.3 2033.7,85.5 2072.4,46.7 2016.6,46.7 2016.6,93.9 1930.5,180.2 2100.2,180.2 2143.2,137.3 2189,137.3 2210.1,158.5 2289.6,158.5 2325.2,194 2394.5,194 2435.9,235.4 2491.2,235.4 2538.5,282.8 2641.4,385.6" id="guna_yala"/><polygon points="1326.8,877.2 1304,877.2 1239.3,941.9 1286.6,989.2 1194.2,1081.5 1173.1,1060.5 1144.8,1060.5 1074.6,990.2 1074.6,893.5 1127.8,840.3 1127.8,813.4 1182.1,758.9 1209.7,786.3 1290.1,786.3 1308.2,803.9 1354.2,849.8" id="herrera"/><polygon points="1396.5,872.2 1396.5,902.6 1561.1,1067.2 1561.1,1134.7 1408.9,1134.7 1367.3,1176.3 1383.5,1192.4 1339.2,1236.6 1243.3,1236.6 1243.3,1209.5 1194.2,1160.3 1194.2,1081.5 1286.6,989.2 1239.3,941.9 1304,877.2 1326.8,877.2 1354.2,849.8 1374,849.8" id="los_santos"/><polygon points="154.7,111.8 178.1,88.4 250.1,160.3 226.7,183.8 226.7,266.1 194.8,297.9 178.5,297.9 145.1,331.3 99.9,286.1 66.6,286.1 66.6,92.6 120.8,92.3 120.8,111.8" id="naso_tjer_di"/><polygon points="321.6,337.1 390.6,268 390.6,338.8 464.5,412.7 508.7,368.5 669.7,368.5 589.8,288.6 589.8,239.8 794.7,444.7 946.7,444.7 946.7,557.2 963,573.5 963,622 842.9,622 815.7,649.1 783.8,649.1 783.8,668 735.2,668 702.3,700.8 632.1,700.8 608,676.7 555.6,676.7 496.1,617.2 455.3,617.2 455.3,455.7 384.6,455.7 365.7,437.5 365.7,381.2" id="ngabe_bugle"/><polygon points="1589.6,242 1563.7,267.9 1563.7,290.9 1579.9,307.1 1579.9,340.1 1564.2,355.8 1525.7,355.8 1506.5,336.7 1477.4,365.8 1477.4,478.8 1510.6,512 1510.6,605.9 1539.1,634.4 1608.1,565.3 1646.4,565.3 1677.7,533.9 1654.6,510.8 1682.3,483.2 1682.3,414.1 1711.6,384.8 1774.4,384.8 1774.4,356.6 1705.7,287.6 1705.9,275.8 1662.7,275.8 1628.9,242" id="panama_oeste"/><g id="veraguas"><polygon points="755.3,973.9 799,1017.6 889.9,1017.6 925.8,1053.5 953.6,1025.7 953.6,921.5 1015.3,921.5 1015.3,1029.2 1080.7,1094.6 1080.7,1207.2 1110.1,1236.6 1243.3,1236.6 1243.3,1209.5 1194.2,1160.3 1194.2,1081.5 1173.1,1060.5 1144.8,1060.5 1074.6,990.2 1074.6,893.5 1127.8,840.3 1127.8,813.4 1182.1,758.9 1182.3,621.5 1133.5,572.7 1171.2,534.9 1171.2,465.2 1106.4,400.4 1057.9,400.4 1013.4,444.8 946.7,444.8 946.7,557.2 963,573.5 963,622 842.9,622 815.7,649.1 783.8,649.1 783.8,668 783.8,722.5 755.1,751.1 755.1,798.3 706.6,846.9 755.3,895.6" id="polygon8"/><polygon points="595.6,1125.3 653.1,1182.8 740.4,1182.8 714.7,1157.1 692.3,1157.1 692.3,1103.6 714.5,1081.4 661.4,1027.3 595.6,1093" id="polygon9"/></g><g id="panama"><polygon points="1828.1,326.7 2021.3,326.7 2130.7,436.1 2184.6,436.1 2250.6,502.1 2293.5,502.1 2293.5,593.5 2360.9,660.8 2360.9,606.8 2327.5,573.4 2327.5,459.2 2378.8,407.9 2417.1,407.9 2460.2,364.9 2503.5,364.9 2503.5,317.8 2538.5,282.8 2491.2,235.4 2435.9,235.4 2394.5,194 2325.2,194 2289.6,158.5 2210.1,158.5 2189,137.3 2143.2,137.3 2100.2,180.2 1930.5,180.2 1930.5,133.7 1902.3,105.5 1883.7,124.1 1859.8,124.1 1859.8,85.7 1786.9,85.7 1786.9,144.5 1759.1,172.2 1759.1,222.5 1705.9,275.8 1705.7,287.6 1774.4,356.6 1798.2,356.6" id="polygon10"/><polygon points="2109.7,731.2 2109.7,694.7 2136.3,694.7 2153.6,677.4 2153.6,640.4 2124.5,611.4 2072,611.7 2072,693.5" id="polygon11"/></g><path d="m 2965,817.1 v -54.6 l -20.3,-20.3 -16.5,-16.5 -84.4,84.4 H 2787 l -29.4,-29.4 V 745.8 L 2666,654.2 v -47.4 l -74.2,-74.2 90.4,-90.4 h 38.7 l -56.6,-56.5 h -22.8 L 2538.6,282.9 2503.5,318 v 47 h -43.3 l -43,43 h -38.3 l -51.4,51.4 v 114.1 l 33.4,33.4 V 661 l 17.4,17.4 v -36.9 l 30,-30 h 38.1 l 24.3,24.3 v 43 l -49.1,49.1 35.5,35.5 -54.7,54.7 -34.7,-34.7 -18.6,18.6 v 82.4 l 77.1,77.1 v 63.8 l 204.6,204.6 v -119.3 h 85.6 V 995.1 l 85.6,85.6 131.3,-131.3 -32.8,-32.8 37.5,-37.5 h 60.6 v -28.5 z m -364.7,233.2 H 2526 v -39.9 h -47.3 l -27.5,-27.5 v -43.3 l -50.8,-50.8 34.7,-38 h 22.6 v -35.6 l 15.3,-15.3 78.4,78.4 18.4,-18.4 v 68 l 30.7,30.7 v 91.7 z" id="darien"/><polygon points="1367.6,408.7 1332.1,373.2 1283.5,373.2 1283.5,442.7 1226,442.7 1199.5,469.1 1199.5,506.6 1171.2,534.9 1171.2,465.2 1106.4,400.4 1242,264.8 1421.3,264.8 1550,136 1634.3,136 1745.6,24.7 1897.1,24.7 1918.8,46.5 2016.6,46.5 2016.6,93.9 1930.5,180.2 1930.5,133.7 1902.3,105.5 1883.7,124.1 1859.8,124.1 1859.8,85.7 1786.9,85.7 1786.9,144.5 1759.1,172.2 1759.1,222.5 1705.9,275.8 1662.7,275.8 1628.9,242 1589.6,242 1563.7,267.9 1563.7,290.9 1579.9,307.1 1579.9,340.1 1564.2,355.8 1525.7,355.8 1506.5,336.7 1477.4,365.8 1459.9,348.3 1459.9,316.4" id="colon"/><g id="g18"><polygon points="321.6,337.1 390.6,268 390.6,338.8 464.5,412.7 508.7,368.5 477,336.8 420.6,336.8 420.6,252.2 456.9,252.2 483.5,278.7 508.9,253.3 472.7,217.1 454,235.8 398.6,180.5 383,196.1 383,225.5 360.1,225.5 331.6,197.1 356.9,171.8 337.5,152.3 368.5,121.2 348.8,121.2 268.3,40.7 226.8,82.2 210.1,82.2 155.3,27.3 104,27.3 88.7,42.7 120.8,74.8 120.8,92.3 120.8,111.8 154.7,111.8 178.1,88.4 250.1,160.3 226.7,183.8 226.7,266.1 194.8,297.9 178.5,297.9 145.1,331.3 168,354.2 168,382.6 230.5,382.6 285.3,437.5 365.7,437.5 365.7,381.2" id="polygon16"/><polygon points="410.7,112.9 410.7,127.7 421.6,138.7 421.6,176.2 374.3,127.7 389.2,112.9" id="polygon17"/><polygon points="464.4,206.5 491,179.9 473,161.9 454.9,161.9 442.8,149.8 434.5,156.4 434.5,176.6" id="polygon18"/></g><g id="etiquetas"><g id="t_bocas_del_toro"><text transform="translate(317.1958,176.2173)" id="text18">Bocas</text><text transform="translate(283.7974,232.2346)" id="text19">del Toro</text></g><text transform="translate(204.7927,567.3508)" id="t_chiriqui">Chiriquí</text><text transform="translate(884.2051,783.0707)" id="t_veraguas">Veraguas</text><text transform="translate(1268.2111,586.649)" id="t_cocle">Coclé</text><text transform="translate(1253.1539,1082.5509)" id="t_los_santos">Los Santos</text><text transform="translate(1083.5479,936.0339)" id="t_herrera">Herrera</text><text transform="translate(1856.8473,265.6409)" id="t_panama">Panamá</text><text transform="translate(2623.676,879.104)" id="text26">Darién</text><text transform="translate(2330.8186,164.4968)" id="t_guna_yala">Guna Yala</text><text transform="translate(1598.8124,200.1)" id="t_colon">Colón</text><g id="t_panama_oeste"><text transform="translate(1499.1893,408.6331)" id="text29">Panamá</text><text transform="translate(1523.8444,455.2997)" id="text30">Oeste</text></g><g id="t_embera_wounaan"><text transform="translate(2707.0615,642.0316)" id="text34">Emberá</text><text transform="translate(2688.8779,688.6982)" id="text35">Wounaan</text></g><text transform="translate(553.6038,530.7012)" id="t_ngabe_bugle">Ngäbe-Buglé</text><g id="t_naso_tjer_di"><text transform="translate(88.854,191.6354)" id="text38">Naso</text><text transform="translate(74.6239,249.9687)" id="text39">Tjër Di</text></g></g>`;

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
  :root{--bg:#f3f5f7;--card:#fff;--ink:#111827;--muted:#667085;--line:#e4e7ec;--blue:#2f80ed}
  *{box-sizing:border-box} body{margin:0;background:radial-gradient(circle at top,rgba(47,128,237,.1),transparent 32%),var(--bg);color:var(--ink);}
  a{color:inherit}.mf-root{max-width:1200px;margin:0 auto;padding:24px}.mf-hero,.mf-card,.mf-modal-body,.mf-stat{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:20px;box-shadow:0 12px 32px rgba(15,23,42,.05)}
  .mf-hero{padding:20px 22px;display:grid;gap:10px}.mf-kicker{margin:0;color:var(--blue);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mf-title{margin:0;font-size:clamp(2rem,4vw,3rem);line-height:.95}.mf-sub{margin:0;color:var(--muted);max-width:72ch}.mf-grid{display:grid;gap:16px;margin-top:16px}.mf-card{padding:18px}.mf-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:end;margin-bottom:12px}.mf-card h2,.mf-modal-body h2{margin:0;font-size:1.25rem}.mf-note{margin:0;color:var(--muted)}.mf-controls{display:flex;flex-wrap:wrap;gap:8px}.mf-toggle{display:flex;flex-wrap:wrap;gap:6px}.mf-toggle button{padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;color:#344054;cursor:pointer}.mf-toggle button.on{background:var(--blue);border-color:var(--blue);color:#fff}.mf-section-body{display:grid;gap:16px}.mf-section-main{min-width:0}.mf-code{padding:14px 16px;border:1px solid #1e293b;border-radius:16px;background:#0f172a;color:#e2e8f0;overflow:auto}.mf-code-label{margin:0 0 10px;color:#93c5fd;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mf-code pre{margin:0;white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.mf-figure,.mf-map{overflow:auto}.mf-empty{color:var(--muted);padding:14px 0}.mf-stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin:12px 0 16px}.mf-stat{padding:16px;text-align:center}.mf-stat b{display:block;font-size:1.6rem;line-height:1}.mf-meta{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-bottom:16px}.mf-meta div{min-width:0}.mf-meta p{margin:.1rem 0 0;color:var(--muted)}.mf-table-wrap{overflow:auto;max-height:55vh;border:1px solid var(--line);border-radius:14px}.mf-table{width:100%;border-collapse:collapse;min-width:720px;background:#fff}.mf-table th,.mf-table td{padding:12px 14px;border-bottom:1px solid #eef1f4;text-align:left;vertical-align:top}.mf-table th{position:sticky;top:0;background:#fff;color:#667085;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.mf-strong{font-weight:700}.mf-overlay{position:fixed;inset:0;padding:16px;background:rgba(15,23,42,.42);backdrop-filter:blur(6px);display:flex;justify-content:center;align-items:flex-start;z-index:9999}.mf-modal{width:min(1180px,100%);max-height:calc(100vh - 32px);overflow:auto}.mf-modal-body{padding:20px}.mf-close-row{display:flex;justify-content:flex-end;position:sticky;top:0;z-index:2}.mf-close{width:40px;height:40px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.92);font-size:24px;cursor:pointer}.mf-map svg{display:block;width:100%;height:auto;max-width:960px;margin:auto}.mf-map .legend{display:flex;align-items:center;gap:10px;margin-top:10px;color:var(--muted);font-size:12px}.mf-grad{height:12px;flex:1;max-width:300px;border-radius:999px;background:linear-gradient(90deg,#eff6ff,#1d4ed8)}
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
      (values) => ({
        provincia: values[0].province,
        mujeres: sum(values, (d) => (d.gender === 'female' ? 1 : 0)),
        totalCandidaturas: values.length,
        paridad: values.length ? sum(values, (d) => (d.gender === 'female' ? 1 : 0)) / values.length : 0,
      }),
      (d) => d.province,
    )
    .map(([, value]) => value);
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
  return bars(incomeBreakdown(getIncomeRows(store, position)), chartOpts);
}

function renderExpenseTimelineChart(store, position = ALL, grain = 'mes') {
  return line(expenseTimeline(getExpenseRows(store, position), grain), chartOpts);
}

function renderParityChart(store, position = POS[0]) {
  return mapChart({
    rows: getParityRows(store, position),
    valueKey: 'paridad',
    domain: [0, 1],
    valueFormat: (v) => d3.format('.0%')(v),
    colorScale: d3
      .scaleLinear()
      .domain([0, 0.5, 1])
      .range(['#1d4ed8', '#f8fafc', '#b91c1c'])
      .interpolate(d3.interpolateRgb),
    tooltip: (row, value) =>
      `${row.provincia}\n${d3.format('.0%')(value)} mujeres\n${row.mujeres} de ${row.totalCandidaturas} candidaturas`,
    mapMarkup: MAP,
    provinces: PROVINCES,
  });
}

function renderFinancialMapChart(store, position = POS[0], metric = 'ingresoTotal', filter = 'all') {
  return mapChart({
    rows: getFinancialRows(store, position, filter),
    valueKey: metric,
    valueFormat: SHORT,
    tooltip: (row, value) =>
      `${row.provincia}\n${metric === 'ingresoTotal' ? 'Ingresos' : 'Gastos'}: ${MONEY(value)}\n${row.cantidadCandidaturas} candidaturas`,
    mapMarkup: MAP,
    provinces: PROVINCES,
  });
}

function renderDonorsChart(store) {
  return beeswarm(store.overview.donors, 'aportante', chartOpts);
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

const chartElementCss = `:host{display:block}.wc-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:0 0 12px}.wc-field{display:grid;gap:4px;min-width:180px;color:#344054;font:12px/1.4 Inter,ui-sans-serif,system-ui,sans-serif}.wc-field select{padding:8px 12px;border:1px solid #e4e7ec;border-radius:999px;background:#fff;color:#344054;font:14px/1.4 Inter,ui-sans-serif,system-ui,sans-serif}.mf-map{overflow:auto}.mf-map svg{display:block;width:100%;height:auto;max-width:960px;margin:auto}.legend{display:flex;align-items:center;gap:10px;margin-top:10px;color:#667085;font:12px/1.4 Inter,ui-sans-serif,system-ui,sans-serif}.mf-grad{height:12px;flex:1;max-width:300px;border-radius:999px;background:linear-gradient(90deg,#eff6ff,#1d4ed8)}.empty,.error,.loading{padding:14px 0;color:#667085;font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}`;
const summaryCardsElementCss = `:host{display:block;font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827}${SUMMARY_CARDS_CSS}.loading,.error{padding:14px 0;color:#667085}`;
const contributorHistogramElementCss = `:host{display:block;color:#111827;font:14px/1.45 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wh-root{display:grid;gap:18px}.wh-title{margin:0;font-size:clamp(1.95rem,4vw,2.5rem);font-weight:500;line-height:1.05;letter-spacing:-.04em}.wh-tabs{display:flex;gap:28px;overflow:auto;border-bottom:1px solid #d0d7de}.wh-tab{appearance:none;border:0;border-bottom:4px solid transparent;background:none;color:#4b5563;cursor:pointer;font-weight:600;font-size:16px;line-height:1.2;font-family:inherit;margin:0;padding:0 4px 14px;white-space:nowrap}.wh-tab[aria-selected='true']{color:#3b82f6;border-bottom-color:#3b82f6}.wh-chart{min-width:0}.loading,.error,.empty{padding:14px 0;color:#667085}@media (max-width:720px){.wh-root{gap:14px}.wh-title{font-size:clamp(1.5rem,8vw,2rem)}.wh-tabs{gap:18px}.wh-tab{font-size:15px;padding-bottom:12px}}`;

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
