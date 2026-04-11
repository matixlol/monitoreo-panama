import { h, render } from 'https://esm.sh/preact@10.26.6';
import { useEffect, useMemo, useRef, useState } from 'https://esm.sh/preact@10.26.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import * as d3 from 'https://esm.sh/d3@7.9.0?bundle';
import { bars } from './charts/bars.js';
import { beeswarm } from './charts/beeswarm.js';
import { line } from './charts/line.js';
import { mapChart } from './charts/map.js';
import { treemap } from './charts/treemap.js';
import { createModalRouter } from './modals.js';

const html = htm.bind(h);
const COLORS = ['#2f80ed', '#7db3f3', '#9ac7ff', '#b9d5fa', '#dceafd', '#9bc493', '#c8b0a3', '#e29196'];
const POS = ['Presidente', 'Diputado(a)', 'Alcalde'];
const ALL = 'Todas';
const MONEY = (v) =>
  `B/.${new Intl.NumberFormat('de-DE', { maximumFractionDigits: Math.abs((+v || 0) % 1) > 0.001 ? 2 : 0, minimumFractionDigits: Math.abs((+v || 0) % 1) > 0.001 ? 2 : 0 }).format(+v || 0)}`;
const INT = (v) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(+v || 0);
const SHORT = (v) => {
  const n = +v || 0;
  return `B/.${Math.abs(n) >= 1e6 ? d3.format('.2s')(n) : d3.format(',.0f')(n)}`;
};
const TEXT = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : `${v}`.trim());
const NORM = (v) =>
  TEXT(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ÃÂ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const slugify = (v) => NORM(v).replace(/ /g, '-').slice(0, 120);
const num = (v) => {
  const n = Number(TEXT(v).replace(/\s+/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const uniq = (xs) => [...new Map(xs.map((x) => [NORM(x), TEXT(x)]).filter(([k]) => k)).values()];
const byPos = (rows, pos) =>
  pos === 'total' || pos === ALL ? rows : rows.filter((d) => TEXT(d.candidatePosition) === pos);
const posOptions = (rows, first = 'total') => [first, ...uniq(rows.map((d) => d.candidatePosition)).sort(sortPos)];
const sortPos = (a, b) => (POS.indexOf(a) + 1 || 99) - (POS.indexOf(b) + 1 || 99) || d3.ascending(a, b);
const sum = (rows, f) => d3.sum(rows, f);
const plural = (n, a, b) => ((+n || 0) === 1 ? a : b);
const dateKey = (d) =>
  `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const shortDate = (d) => `${`${d.getDate()}`.padStart(2, '0')} ${monthNames[d.getMonth()]}`;
const parsePanamaDate = (v) => {
  const s = TEXT(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    return Number.isNaN(+d) ? null : d;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2}|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\/(\d{4})$/i);
  if (!m) return null;
  const mm = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
  const month = /^\d+$/.test(m[2]) ? +m[2] - 1 : mm[m[2].toLowerCase()];
  const d = new Date(+m[3], month, +m[1]);
  return Number.isNaN(+d) ? null : d;
};
const startOfWeek = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const bucketDate = (d, grain) =>
  grain === 'día'
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate())
    : grain === 'semana'
      ? startOfWeek(d)
      : new Date(d.getFullYear(), d.getMonth(), 1);
const bucketLabel = (d, grain) =>
  grain === 'día'
    ? shortDate(d)
    : grain === 'semana'
      ? `${shortDate(d)} → ${shortDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6))}`
      : `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
const parseCsvText = (text) => d3.csvParse(text);
const INCOME_TYPES = [
  ['donacionesPrivadasEfectivo', 'Donación privada · efectivo'],
  ['donacionesPrivadasChequeAch', 'Donación privada · cheque / ACH'],
  ['donacionesPrivadasEspecie', 'Donación privada · especie'],
  ['recursosPropiosEfectivoCheque', 'Recurso propio · efectivo / cheque'],
  ['recursosPropiosEspecie', 'Recurso propio · especie'],
].map(([key, label], i) => ({ key, label, color: COLORS[i] }));
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
const province = (v) => PROVINCE_ALIASES.get(NORM(v)) ?? TEXT(v);
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
const inject = () => {
  if (cssDone || typeof document === 'undefined') return;
  document.head.append(
    Object.assign(document.createElement('style'), {
      textContent: `
  :root{--bg:#f3f5f7;--card:#fff;--ink:#111827;--muted:#667085;--line:#e4e7ec;--blue:#2f80ed}
  *{box-sizing:border-box} body{margin:0;background:radial-gradient(circle at top,rgba(47,128,237,.1),transparent 32%),var(--bg);color:var(--ink);font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  a{color:inherit}.mf-root{max-width:1200px;margin:0 auto;padding:24px}.mf-hero,.mf-card,.mf-modal-body,.mf-stat{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:20px;box-shadow:0 12px 32px rgba(15,23,42,.05)}
  .mf-hero{padding:20px 22px;display:grid;gap:10px}.mf-kicker{margin:0;color:var(--blue);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mf-title{margin:0;font-size:clamp(2rem,4vw,3rem);line-height:.95}.mf-sub{margin:0;color:var(--muted);max-width:72ch}.mf-links{display:flex;flex-wrap:wrap;gap:10px}.mf-pill,.mf-btn,.mf-select{border:1px solid var(--line);background:#fff;border-radius:999px}.mf-pill,.mf-btn{padding:8px 12px;text-decoration:none;cursor:pointer}.mf-grid{display:grid;gap:16px;margin-top:16px}.mf-card{padding:18px}.mf-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:end;margin-bottom:12px}.mf-card h2,.mf-modal-body h2{margin:0;font-size:1.25rem}.mf-note{margin:0;color:var(--muted)}.mf-controls{display:flex;flex-wrap:wrap;gap:8px}.mf-toggle{display:flex;flex-wrap:wrap;gap:6px}.mf-toggle button{padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;color:#344054;cursor:pointer}.mf-toggle button.on{background:var(--blue);border-color:var(--blue);color:#fff}.mf-select{padding:8px 12px;color:#344054}.mf-section-body{display:grid;gap:16px}.mf-section-body.has-code{grid-template-columns:minmax(0,1fr) minmax(280px,360px);align-items:start}.mf-section-main{min-width:0}.mf-code{padding:14px 16px;border:1px solid #1e293b;border-radius:16px;background:#0f172a;color:#e2e8f0;overflow:auto}.mf-code-label{margin:0 0 10px;color:#93c5fd;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mf-code pre{margin:0;white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.mf-figure,.mf-map{overflow:auto}.mf-empty{color:var(--muted);padding:14px 0}.mf-stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin:12px 0 16px}.mf-stat{padding:16px;text-align:center}.mf-stat b{display:block;font-size:1.6rem;line-height:1}.mf-meta{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-bottom:16px}.mf-meta div{min-width:0}.mf-meta p{margin:.1rem 0 0;color:var(--muted)}.mf-table-wrap{overflow:auto;max-height:55vh;border:1px solid var(--line);border-radius:14px}.mf-table{width:100%;border-collapse:collapse;min-width:720px;background:#fff}.mf-table th,.mf-table td{padding:12px 14px;border-bottom:1px solid #eef1f4;text-align:left;vertical-align:top}.mf-table th{position:sticky;top:0;background:#fff;color:#667085;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.mf-strong{font-weight:700}.mf-overlay{position:fixed;inset:0;padding:16px;background:rgba(15,23,42,.42);backdrop-filter:blur(6px);display:flex;justify-content:center;align-items:flex-start;z-index:9999}.mf-modal{width:min(1180px,100%);max-height:calc(100vh - 32px);overflow:auto}.mf-modal-body{padding:20px}.mf-close-row{display:flex;justify-content:flex-end;position:sticky;top:0;z-index:2}.mf-close{width:40px;height:40px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.92);font-size:24px;cursor:pointer}.mf-map svg{display:block;width:100%;height:auto;max-width:960px;margin:auto}.mf-map .legend{display:flex;align-items:center;gap:10px;margin-top:10px;color:var(--muted);font-size:12px}.mf-grad{height:12px;flex:1;max-width:300px;border-radius:999px;background:linear-gradient(90deg,#eff6ff,#1d4ed8)}
  ${SUMMARY_CARDS_CSS}
  @media (max-width:900px){.mf-section-body.has-code{grid-template-columns:1fr}}
  @media (max-width:720px){.mf-root{padding:14px}.mf-card,.mf-modal-body,.mf-hero{border-radius:16px;padding:16px}}
  `,
    }),
  );
  cssDone = true;
};

async function loadCsvDatasets({ ingresosUrl, egresosUrl, assignToWindow = true }) {
  const [i, e] = await Promise.all([fetch(ingresosUrl), fetch(egresosUrl)]);
  if (!i.ok || !e.ok) throw new Error('No se pudieron cargar los CSVs');
  const [ingresos, egresos] = await Promise.all([i.text().then(parseCsvText), e.text().then(parseCsvText)]);
  if (assignToWindow && typeof window !== 'undefined') {
    window.documentosIngresos = ingresos;
    window.documentosEgresos = egresos;
  }
  return { ingresos, egresos };
}

const resolveDatasets = (o = {}) => {
  if (o.datasets) return o.datasets;
  if (
    typeof window === 'undefined' ||
    !Array.isArray(window.documentosIngresos) ||
    !Array.isArray(window.documentosEgresos)
  ) {
    throw new Error('Faltan window.documentosIngresos o window.documentosEgresos.');
  }
  return { ingresos: window.documentosIngresos, egresos: window.documentosEgresos };
};

const incomeBreakdown = (rows) =>
  INCOME_TYPES.map((d, i) => ({ ...d, value: sum(rows, (r) => num(r[d.key])), color: COLORS[i] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => d3.descending(a.value, b.value));
const expenseBreakdown = (rows) =>
  d3
    .rollups(
      rows,
      (v) => sum(v, (r) => num(r.totalDeGastosDePropagandaYCampania)),
      (r) => TEXT(r.GastoCategoria) || TEXT(r.detalleGastoResumido) || 'Sin categoría',
    )
    .map(([label, value], i) => ({ id: slugify(label) || `c-${i}`, label, value, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => d3.descending(a.value, b.value));
const partyBreakdown = (rows) =>
  d3
    .rollups(
      rows,
      (v) => sum(v, (r) => num(r.total)),
      (r) => TEXT(r.candidateParty) || 'Sin partido',
    )
    .map(([label, value], i) => ({ id: slugify(label) || `p-${i}`, label, value, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => d3.descending(a.value, b.value));
const contributionLabel = (row) =>
  INCOME_TYPES.filter((d) => num(row[d.key]) > 0)
    .map((d) => d.label)
    .join(' · ') || 'Sin clasificar';
const expenseTimeline = (rows, grain = 'día') =>
  d3
    .rollups(
      rows.flatMap((r) => {
        const d = parsePanamaDate(r.fecha),
          value = num(r.totalDeGastosDePropagandaYCampania);
        return d && value ? [{ date: bucketDate(d, grain), value }] : [];
      }),
      (v) => ({ value: sum(v, (d) => d.value), count: v.length }),
      (d) => +d.date,
    )
    .map(([t, s]) => ({ date: new Date(t), value: s.value, count: s.count, label: bucketLabel(new Date(t), grain) }))
    .sort((a, b) => d3.ascending(a.date, b.date));
const topPartyRows = (rows, n = 4) => {
  const top = new Set(
    d3
      .rollups(
        rows,
        (v) => v.length,
        (d) => d.party,
      )
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, n)
      .map(([k]) => k),
  );
  return rows
    .map((d) => ({ ...d, group: top.has(d.party) ? d.party : 'Otros' }))
    .sort((a, b) => (a.group === 'Otros') - (b.group === 'Otros') || d3.ascending(a.group, b.group));
};

function buildStore({ ingresos = [], egresos = [] }) {
  const cb = new Map(),
    db = new Map(),
    pb = new Map();
  const put = (m, k, f) => m.get(k) || (m.set(k, f()), m.get(k));
  for (const r of ingresos) {
    const c = slugify(r.candidateName),
      d = slugify(r.contribuyenteNombre);
    if (c) put(cb, c, () => ({ ingresos: [], egresos: [] })).ingresos.push(r);
    if (d) put(db, d, () => ({ ingresos: [] })).ingresos.push(r);
  }
  for (const r of egresos) {
    const c = slugify(r.candidateName),
      p = slugify(r.proveedorNombre);
    if (c) put(cb, c, () => ({ ingresos: [], egresos: [] })).egresos.push(r);
    if (p) put(pb, p, () => ({ egresos: [] })).egresos.push(r);
  }
  const candidates = [...cb]
    .map(([id, b]) => {
      const rows = [...b.ingresos, ...b.egresos];
      return {
        kind: 'candidato',
        id,
        name: d3.mode(rows.map((r) => TEXT(r.candidateName)).filter(Boolean)) || id,
        parties: uniq(rows.map((r) => r.candidateParty)),
        positions: uniq(rows.map((r) => r.candidatePosition)).sort(sortPos),
        provinces: uniq(rows.map((r) => province(r.candidateProvince))),
        districts: uniq(rows.map((r) => r.candidateDistrict)),
        ingresos: b.ingresos.sort((a, b) => d3.descending(parsePanamaDate(a.fecha), parsePanamaDate(b.fecha))),
        egresos: b.egresos.sort((a, b) => d3.descending(parsePanamaDate(a.fecha), parsePanamaDate(b.fecha))),
        ingresoTotal: sum(b.ingresos, (r) => num(r.total)),
        egresoTotal: sum(b.egresos, (r) => num(r.totalDeGastosDePropagandaYCampania)),
        contributorCount: new Set(b.ingresos.map((r) => NORM(r.contribuyenteNombre)).filter(Boolean)).size,
        providerCount: new Set(b.egresos.map((r) => NORM(r.proveedorNombre)).filter(Boolean)).size,
      };
    })
    .sort((a, b) => d3.descending(a.ingresoTotal + a.egresoTotal, b.ingresoTotal + b.egresoTotal));
  const donors = [...db]
    .map(([id, b]) => ({
      kind: 'aportante',
      id,
      name: d3.mode(b.ingresos.map((r) => TEXT(r.contribuyenteNombre)).filter(Boolean)) || id,
      parties: uniq(b.ingresos.map((r) => r.candidateParty)),
      positions: uniq(b.ingresos.map((r) => r.candidatePosition)).sort(sortPos),
      ingresos: b.ingresos.sort((a, b) => d3.descending(parsePanamaDate(a.fecha), parsePanamaDate(b.fecha))),
      total: sum(b.ingresos, (r) => num(r.total)),
      candidateCount: new Set(b.ingresos.map((r) => NORM(r.candidateName)).filter(Boolean)).size,
    }))
    .sort((a, b) => d3.descending(a.total, b.total));
  const providers = [...pb]
    .map(([id, b]) => ({
      kind: 'proveedor',
      id,
      name: d3.mode(b.egresos.map((r) => TEXT(r.proveedorNombre)).filter(Boolean)) || id,
      parties: uniq(b.egresos.map((r) => r.candidateParty)),
      positions: uniq(b.egresos.map((r) => r.candidatePosition)).sort(sortPos),
      egresos: b.egresos.sort((a, b) => d3.descending(parsePanamaDate(a.fecha), parsePanamaDate(b.fecha))),
      total: sum(b.egresos, (r) => num(r.totalDeGastosDePropagandaYCampania)),
      candidateCount: new Set(b.egresos.map((r) => NORM(r.candidateName)).filter(Boolean)).size,
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

const parseHashRoute = (hash) => {
  const p = TEXT(hash).replace(/^#/, '').split('/').filter(Boolean);
  if (!p.length || p[0] === '') return { kind: 'none' };
  if (p[0] === 'ficha' && ['candidato', 'aportante', 'proveedor'].includes(p[1]) && p[2])
    return { kind: p[1], id: decodeURIComponent(p.slice(2).join('/')) };
  if (['candidato', 'aportante', 'proveedor'].includes(p[0]) && p[1])
    return { kind: p[0], id: decodeURIComponent(p.slice(1).join('/')) };
  return { kind: 'unknown', raw: hash };
};
const buildHashRoute = (kind, id) => `#/ficha/${kind}/${encodeURIComponent(id)}`;
const entityFor = (store, route) =>
  route.kind === 'candidato'
    ? store.candidateById.get(route.id)
    : route.kind === 'aportante'
      ? store.donorById.get(route.id)
      : route.kind === 'proveedor'
        ? store.providerById.get(route.id)
        : null;
const targetNode = (target) =>
  typeof target === 'string'
    ? document.querySelector(target)
    : target instanceof Element
      ? target
      : document.body.appendChild(document.createElement('div'));
const chartOpts = { buildHashRoute, colors: COLORS, int: INT, money: MONEY, short: SHORT };

function PlotFigure({ make, deps = [] }) {
  const ref = useRef(null);
  const node = useMemo(() => make(), deps);
  useEffect(() => {
    ref.current?.replaceChildren(node);
    return () => node?.remove?.();
  }, [node]);
  return html`<div class="mf-figure" ref=${ref}></div>`;
}

const Toggle = ({ value, options, onChange, format = (d) => d }) =>
  html`<div class="mf-toggle">
    ${options.map(
      (o) =>
        html`<button class=${o === value ? 'on' : ''} type="button" onClick=${() => onChange(o)}>${format(o)}</button>`,
    )}
  </div>`;
const Select = ({ value, options, onChange }) =>
  html`<select class="mf-select" value=${value} onInput=${(e) => onChange(e.currentTarget.value)}>
    ${options.map((o) => html`<option value=${o.value}>${o.label}</option>`)}
  </select>`;
const Code = ({ code }) =>
  html`<aside class="mf-code">
    <div class="mf-code-label">Embed</div>
    <pre>${code}</pre>
  </aside>`;
const Section = ({ title, note, controls, embedCode, children }) =>
  html`<section class="mf-card">
    <div class="mf-head">
      <div>
        <h2>${title}</h2>
        ${note ? html`<p class="mf-note">${note}</p>` : null}
      </div>
      ${controls ? html`<div class="mf-controls">${controls}</div>` : null}
    </div>
    <div class="mf-section-body">
      ${embedCode ? html`<${Code} code=${embedCode} />` : null}
      <div class="mf-section-main">${children}</div>
    </div>
  </section>`;
const Stats = ({ items }) =>
  html`<div class="mf-stats">
    ${items.map((d) => html`<div class="mf-stat"><b>${d.value}</b><span>${d.label}</span></div>`)}
  </div>`;
const Meta = ({ items }) =>
  html`<div class="mf-meta">
    ${items.map(
      (d) =>
        html`<div>
          <strong>${d.label}</strong>
          <p>${d.values?.filter(Boolean).join(' · ') || '—'}</p>
        </div>`,
    )}
  </div>`;
const Empty = ({ text }) => html`<div class="mf-empty">${text}</div>`;
const Table = ({ columns, rows, emptyText }) =>
  !rows.length
    ? html`<${Empty} text=${emptyText} />`
    : html`<div class="mf-table-wrap">
        <table class="mf-table">
          <thead>
            <tr>
              ${columns.map((c) => html`<th>${c.header}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${rows.map(
              (r) =>
                html`<tr>
                  ${columns.map((c) => html`<td class=${c.strong ? 'mf-strong' : ''}>${r[c.key] ?? '—'}</td>`)}
                </tr>`,
            )}
          </tbody>
        </table>
      </div>`;

const DEFAULT_INGRESOS_URL = new URL('./data/documentos-ingresos.csv', import.meta.url).href;
const DEFAULT_EGRESOS_URL = new URL('./data/documentos-egresos.csv', import.meta.url).href;
const STORE_CACHE = new Map();
const attr = (el, name, fallback) => el.getAttribute(name) || fallback;
const getCandidatesRows = (store, position) =>
  topPartyRows(store.overview.candidates.filter((d) => d.position === position));
const getIncomeRows = (store, position = ALL) => byPos(store.ingresos, position);
const getExpenseRows = (store, position = ALL) => byPos(store.egresos, position);
const getParityRows = (store, position) =>
  d3
    .rollups(
      store.overview.candidates.filter((d) => d.position === position && d.gender),
      (v) => ({
        provincia: v[0].province,
        mujeres: sum(v, (d) => (d.gender === 'female' ? 1 : 0)),
        totalCandidaturas: v.length,
        paridad: v.length ? sum(v, (d) => (d.gender === 'female' ? 1 : 0)) / v.length : 0,
      }),
      (d) => d.province,
    )
    .map(([, d]) => d);
const getFinancialRows = (store, position, filter = 'all') => {
  const rows = store.overview.candidates.filter(
    (d) =>
      d.position === position &&
      (filter === 'all' || (filter.startsWith('party:') ? d.party === filter.slice(6) : d.name === filter.slice(10))),
  );
  return d3
    .rollups(
      rows,
      (v) => ({
        provincia: v[0].province,
        cantidadCandidaturas: v.length,
        ingresoTotal: sum(v, (d) => d.ingresoTotal),
        egresoTotal: sum(v, (d) => d.egresoTotal),
      }),
      (d) => d.province,
    )
    .map(([, d]) => d);
};
const renderCandidateChart = (store, position = POS[0]) =>
  beeswarm(getCandidatesRows(store, position), 'candidato', chartOpts);
const renderIncomeChart = (store, position = ALL) => bars(incomeBreakdown(getIncomeRows(store, position)), chartOpts);
const renderExpenseTimelineChart = (store, position = ALL, grain = 'mes') =>
  line(expenseTimeline(getExpenseRows(store, position), grain), chartOpts);
const renderParityChart = (store, position = POS[0]) =>
  mapChart({
    rows: getParityRows(store, position),
    valueKey: 'paridad',
    domain: [0, 1],
    valueFormat: (v) => d3.format('.0%')(v),
    colorScale: d3
      .scaleLinear()
      .domain([0, 0.5, 1])
      .range(['#1d4ed8', '#f8fafc', '#b91c1c'])
      .interpolate(d3.interpolateRgb),
    tooltip: (r, v) =>
      `${r.provincia}\n${d3.format('.0%')(v)} mujeres\n${r.mujeres} de ${r.totalCandidaturas} candidaturas`,
    mapMarkup: MAP,
    provinces: PROVINCES,
  });
const renderFinancialMapChart = (store, position = POS[0], metric = 'ingresoTotal', filter = 'all') =>
  mapChart({
    rows: getFinancialRows(store, position, filter),
    valueKey: metric,
    valueFormat: SHORT,
    tooltip: (r, v) =>
      `${r.provincia}\n${metric === 'ingresoTotal' ? 'Ingresos' : 'Gastos'}: ${MONEY(v)}\n${r.cantidadCandidaturas} candidaturas`,
    mapMarkup: MAP,
    provinces: PROVINCES,
  });
const renderDonorsChart = (store) => beeswarm(store.overview.donors, 'aportante', chartOpts);
const renderExpenseTreemapChart = (store) => treemap(expenseBreakdown(store.egresos), chartOpts);
const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
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
const summaryItems = (store) => [
  { key: 'candidates', label: 'Candidatos', value: INT(store.candidates.length), icon: SUMMARY_ICONS.candidates },
  { key: 'income', label: 'Ingresos totales', value: MONEY(sum(store.ingresos, (d) => num(d.total))), icon: SUMMARY_ICONS.income },
  {
    key: 'expense',
    label: 'Gastos totales',
    value: MONEY(sum(store.egresos, (d) => num(d.totalDeGastosDePropagandaYCampania))),
    icon: SUMMARY_ICONS.expense,
  },
  {
    key: 'declarations',
    label: 'Declaraciones',
    value: INT(store.ingresos.length + store.egresos.length),
    icon: SUMMARY_ICONS.declarations,
  },
];
const summaryCardsMarkup = (items) =>
  `<div class="mf-summary-grid">${items
    .map(
      (item) => `<article class="mf-summary-card">
        <div class="mf-summary-icon">${item.icon}</div>
        <div class="mf-summary-value">${esc(item.value)}</div>
        <div class="mf-summary-label">${esc(item.label)}</div>
      </article>`,
    )
    .join('')}</div>`;
const SummaryCards = ({ store }) =>
  html`<div dangerouslySetInnerHTML=${{ __html: summaryCardsMarkup(summaryItems(store)) }}></div>`;
const embedSnippet = (tag) =>
  [
    `<script type="module" src="https://fichas.panama.datos.party/visualizaciones-panama.js"></script>`,
    `<${tag}></${tag}>`,
  ].join('\n');
const chartElementCss = `:host{display:block}.wc-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:0 0 12px}.wc-field{display:grid;gap:4px;min-width:180px;color:#344054;font:12px/1.4 Inter,ui-sans-serif,system-ui,sans-serif}.wc-field select{padding:8px 12px;border:1px solid #e4e7ec;border-radius:999px;background:#fff;color:#344054;font:14px/1.4 Inter,ui-sans-serif,system-ui,sans-serif}.mf-map{overflow:auto}.mf-map svg{display:block;width:100%;height:auto;max-width:960px;margin:auto}.legend{display:flex;align-items:center;gap:10px;margin-top:10px;color:#667085;font:12px/1.4 Inter,ui-sans-serif,system-ui,sans-serif}.mf-grad{height:12px;flex:1;max-width:300px;border-radius:999px;background:linear-gradient(90deg,#eff6ff,#1d4ed8)}.empty,.error,.loading{padding:14px 0;color:#667085;font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}`;
const summaryCardsElementCss = `:host{display:block;font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827}${SUMMARY_CARDS_CSS}.loading,.error{padding:14px 0;color:#667085}`;
const resolveStoreForElement = (el) => {
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
};
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
function defineChartElements() {
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
    (el, store) => renderExpenseTimelineChart(store, attr(el, 'position', ALL), attr(el, 'grain', 'mes')),
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
      {
        attr: 'grain',
        label: 'Agrupar por',
        value: attr(el, 'grain', 'mes'),
        options: ['mes', 'semana', 'día'].map((value) => ({ value, label: value })),
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
      const filterOptions = [
        { value: 'all', label: 'Todas las candidaturas' },
        ...uniq(rows.map((d) => d.party))
          .sort(d3.ascending)
          .map((value) => ({ value: `party:${value}`, label: `Partido: ${value}` })),
        ...uniq(rows.map((d) => d.name))
          .sort(d3.ascending)
          .map((value) => ({ value: `candidate:${value}`, label: `Candidatura: ${value}` })),
      ];
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
        { attr: 'filter', label: 'Filtro', value: attr(el, 'filter', 'all'), options: filterOptions },
      ];
    },
  );
  defineChartElement('panama-aportantes-chart', ['ingresos-url', 'egresos-url'], (_, store) =>
    renderDonorsChart(store),
  );
  defineChartElement('panama-gastos-treemap-chart', ['ingresos-url', 'egresos-url'], (_, store) =>
    renderExpenseTreemapChart(store),
  );
}

function Hero({ store }) {
  const c = store.candidates[0],
    d = store.donors[0],
    p = store.providers[0];
  return html`<section class="mf-hero">
    <p class="mf-kicker">embeds / demo</p>
    <h1 class="mf-title">Visualizaciones y fichas</h1>
    <p class="mf-sub">
      Un solo módulo buildless para el demo tipo Observable y las fichas hash-routed. Click en las burbujas para abrir
      fichas.
    </p>
    <p class="mf-note">
      ${store.candidates.length} candidatos · ${store.donors.length} aportantes · ${store.providers.length} proveedores
    </p>
    <div class="mf-links">
      ${c ? html`<a class="mf-pill" href=${buildHashRoute('candidato', c.id)}>${c.name}</a>` : null}${d
        ? html`<a class="mf-pill" href=${buildHashRoute('aportante', d.id)}>${d.name}</a>`
        : null}${p ? html`<a class="mf-pill" href=${buildHashRoute('proveedor', p.id)}>${p.name}</a>` : null}
    </div>
  </section>`;
}

function Demo({ store }) {
  const [candidatePos, setCandidatePos] = useState(POS[0]);
  const [incomePos, setIncomePos] = useState(ALL);
  const [expensePos, setExpensePos] = useState(ALL);
  const [grain, setGrain] = useState('mes');
  const [genderPos, setGenderPos] = useState(POS[0]);
  const [mapPos, setMapPos] = useState(POS[0]);
  const [mapMetric, setMapMetric] = useState('ingresoTotal');
  const [mapFilter, setMapFilter] = useState('all');

  const candidates = useMemo(
    () => topPartyRows(store.overview.candidates.filter((d) => d.position === candidatePos)),
    [store, candidatePos],
  );
  const incomeRows = useMemo(() => byPos(store.ingresos, incomePos), [store, incomePos]);
  const expenseRows = useMemo(() => byPos(store.egresos, expensePos), [store, expensePos]);
  const parityRows = useMemo(
    () =>
      d3
        .rollups(
          store.overview.candidates.filter((d) => d.position === genderPos && d.gender),
          (v) => ({
            provincia: v[0].province,
            mujeres: sum(v, (d) => (d.gender === 'female' ? 1 : 0)),
            totalCandidaturas: v.length,
            paridad: v.length ? sum(v, (d) => (d.gender === 'female' ? 1 : 0)) / v.length : 0,
          }),
          (d) => d.province,
        )
        .map(([, d]) => d),
    [store, genderPos],
  );
  const mapOptions = useMemo(() => {
    const rows = store.overview.candidates.filter((d) => d.position === mapPos);
    return [
      { value: 'all', label: 'Todas las candidaturas' },
      ...uniq(rows.map((d) => d.party))
        .sort(d3.ascending)
        .map((v) => ({ value: `party:${v}`, label: `Partido: ${v}` })),
      ...uniq(rows.map((d) => d.name))
        .sort(d3.ascending)
        .map((v) => ({ value: `candidate:${v}`, label: `Candidatura: ${v}` })),
    ];
  }, [store, mapPos]);
  useEffect(() => {
    setMapFilter('all');
  }, [mapPos]);
  const financialRows = useMemo(() => {
    const rows = store.overview.candidates.filter(
      (d) =>
        d.position === mapPos &&
        (mapFilter === 'all' ||
          (mapFilter.startsWith('party:') ? d.party === mapFilter.slice(6) : d.name === mapFilter.slice(10))),
    );
    return d3
      .rollups(
        rows,
        (v) => ({
          provincia: v[0].province,
          cantidadCandidaturas: v.length,
          ingresoTotal: sum(v, (d) => d.ingresoTotal),
          egresoTotal: sum(v, (d) => d.egresoTotal),
        }),
        (d) => d.province,
      )
      .map(([, d]) => d);
  }, [store, mapPos, mapFilter]);

  return html`<div class="mf-grid">
    <${Hero} store=${store} />
    <${Section}
      title="Resumen general"
      note="Cuatro tarjetas con los acumulados principales del dataset cargado."
      embedCode=${embedSnippet('panama-resumen-cards')}
      ><${SummaryCards} store=${store} /><//
    >
    <${Section}
      title="Candidaturas por volumen de fondos"
      note="Mismo primer bloque del notebook: candidaturas agrupadas por partido, con apertura directa de ficha."
      controls=${html`<${Toggle} value=${candidatePos} options=${POS} onChange=${setCandidatePos} />`}
      embedCode=${embedSnippet('panama-candidaturas-chart')}
      >${candidates.length
        ? html`<${PlotFigure} make=${() => renderCandidateChart(store, candidatePos)} deps=${[candidatePos, store]} />`
        : html`<${Empty} text="Sin datos para esta categoría." />`}<//
    >
    <${Section}
      title="Financiación por tipo"
      note=${`${MONEY(sum(incomeRows, (d) => num(d.total)))} acumulados en ${INT(incomeRows.length)} registros de ingresos.`}
      controls=${html`<${Toggle}
        value=${incomePos}
        options=${[ALL, ...uniq(store.ingresos.map((d) => d.candidatePosition)).sort(sortPos)]}
        onChange=${setIncomePos}
      />`}
      embedCode=${embedSnippet('panama-financiacion-chart')}
      >${incomeBreakdown(incomeRows).length
        ? html`<${PlotFigure} make=${() => renderIncomeChart(store, incomePos)} deps=${[incomePos, store]} />`
        : html`<${Empty} text="Sin datos para esta selección." />`}<//
    >
    <${Section}
      title="Línea de tiempo de gastos"
      note=${`${MONEY(sum(expenseRows, (d) => num(d.totalDeGastosDePropagandaYCampania)))} acumulados en ${INT(expenseRows.length)} registros, agrupados por ${grain}.`}
      controls=${html`<${Toggle}
          value=${expensePos}
          options=${[ALL, ...uniq(store.egresos.map((d) => d.candidatePosition)).sort(sortPos)]}
          onChange=${setExpensePos}
        /><${Toggle} value=${grain} options=${['mes', 'semana', 'día']} onChange=${setGrain} />`}
      embedCode=${embedSnippet('panama-gastos-tiempo-chart')}
      >${expenseTimeline(expenseRows, grain).length
        ? html`<${PlotFigure}
            make=${() => renderExpenseTimelineChart(store, expensePos, grain)}
            deps=${[expensePos, grain, store]}
          />`
        : html`<${Empty} text="No hay fechas válidas suficientes para esta selección." />`}<//
    >
    <${Section}
      title="Paridad de género por provincia"
      note="Participación de mujeres sobre candidaturas únicas, usando el mismo mapa y la misma clasificación del notebook."
      controls=${html`<${Toggle} value=${genderPos} options=${POS} onChange=${setGenderPos} />`}
      embedCode=${embedSnippet('panama-paridad-chart')}
      >${parityRows.length
        ? html`<${PlotFigure} make=${() => renderParityChart(store, genderPos)} deps=${[genderPos, store]} />`
        : html`<${Empty} text="No hay datos de género para esta categoría." />`}<//
    >
    <${Section}
      title=${mapMetric === 'ingresoTotal' ? 'Ingresos por provincia' : 'Gastos por provincia'}
      note="Mapa financiero con el mismo flujo del notebook: categoría, métrica y filtro por partido o candidatura."
      controls=${html`<${Toggle} value=${mapPos} options=${POS} onChange=${setMapPos} /><${Toggle}
          value=${mapMetric}
          options=${['ingresoTotal', 'egresoTotal']}
          onChange=${setMapMetric}
          format=${(d) => (d === 'ingresoTotal' ? 'Ingresos' : 'Gastos')}
        /><${Select} value=${mapFilter} options=${mapOptions} onChange=${setMapFilter} />`}
      embedCode=${embedSnippet('panama-mapa-financiero-chart')}
      >${financialRows.length
        ? html`<${PlotFigure}
            make=${() => renderFinancialMapChart(store, mapPos, mapMetric, mapFilter)}
            deps=${[mapMetric, mapPos, mapFilter, store]}
          />`
        : html`<${Empty} text="No hay datos para este filtro." />`}<//
    >
    <${Section}
      title="Aportantes"
      note="Bubble chart de aportantes en el mismo lugar del notebook; cada burbuja abre la ficha del aportante."
      embedCode=${embedSnippet('panama-aportantes-chart')}
      >${store.overview.donors.length
        ? html`<${PlotFigure} make=${() => renderDonorsChart(store)} deps=${[store]} />`
        : html`<${Empty} text="Sin aportantes para mostrar." />`}<//
    >
    <${Section}
      title="Tipo de gastos de campaña"
      note="Treemap global de gastos, reutilizado también dentro de las fichas."
      embedCode=${embedSnippet('panama-gastos-treemap-chart')}
      >${expenseBreakdown(store.egresos).length
        ? html`<${PlotFigure} make=${() => renderExpenseTreemapChart(store)} deps=${[store]} />`
        : html`<${Empty} text="Sin gastos clasificados." />`}<//
    >
  </div>`;
}

const ModalRouter = createModalRouter({
  Empty,
  Meta,
  PlotFigure,
  Section,
  Stats,
  Table,
  Toggle,
  MONEY,
  INT,
  TEXT,
  byPos,
  buildHashRoute,
  chartOpts,
  contributionLabel,
  entityFor,
  expenseBreakdown,
  expenseTimeline,
  bars,
  line,
  parseHashRoute,
  partyBreakdown,
  plural,
  posOptions,
  incomeBreakdown,
  num,
  treemap,
});

function App({ store, showDemo, emptyHash }) {
  return html`<div class="mf-root">
    ${showDemo ? html`<${Demo} store=${store} />` : null}<${ModalRouter} store=${store} emptyHash=${emptyHash} />
  </div>`;
}

function mount(options = {}) {
  inject();
  const target = targetNode(options.target);
  const store = options.store || buildStore(resolveDatasets(options));
  const showDemo = !!options.showDemo;
  const emptyHash = options.emptyHash || '#/';
  const redraw = () => render(html`<${App} store=${store} showDemo=${showDemo} emptyHash=${emptyHash} />`, target);
  redraw();
  return { target, store, rerender: redraw, unmount: () => render(null, target) };
}
const mountDemo = (options = {}) => mount({ ...options, showDemo: true });

defineChartElements();

const api = {
  mount,
  mountDemo,
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
  mountDemo,
  parseCsvText,
  parseHashRoute,
  slugify,
};
