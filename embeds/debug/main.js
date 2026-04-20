import ingresosUrl from '../data/documentos-ingresos.csv?url';
import egresosUrl from '../data/documentos-egresos.csv?url';
import { line } from '../charts/line.js';
import { TIMELINE_X_DOMAIN, candidateLabel, chartOpts, expenseTimeline, incomeTimeline, MONEY } from '../embed-shared.jsx';
import { buildStore, loadCsvDatasets } from '../visualizaciones-panama.jsx';

const app = document.querySelector('#debug-app');

const pageCss = `
  :root{
    color-scheme: light;
    --debug-bg:#f4f1ea;
    --debug-card:#fffdf9;
    --debug-ink:#1a1a1a;
    --debug-muted:#6b655e;
    --debug-line:#ddd6cd;
    --debug-accent:#8e2f20;
  }
  body{
    margin:0;
    background:
      radial-gradient(circle at top left, rgba(142,47,32,.12), transparent 28%),
      linear-gradient(180deg, #f8f5ef 0%, var(--debug-bg) 100%);
    color:var(--debug-ink);
    font-family:"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
  }
  .debug-root{
    max-width:1180px;
    margin:0 auto;
    padding:28px 18px 48px;
  }
  .debug-hero,
  .debug-card{
    background:rgba(255,253,249,.92);
    border:1px solid var(--debug-line);
    border-radius:24px;
    box-shadow:0 20px 40px rgba(49,34,20,.06);
  }
  .debug-hero{
    padding:26px 24px;
    display:grid;
    gap:10px;
  }
  .debug-kicker{
    margin:0;
    color:var(--debug-accent);
    font:700 12px/1.1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
    letter-spacing:.12em;
    text-transform:uppercase;
  }
  .debug-title{
    margin:0;
    font-size:clamp(2rem,4.8vw,3.5rem);
    line-height:.95;
    letter-spacing:-.04em;
  }
  .debug-sub{
    margin:0;
    max-width:70ch;
    color:var(--debug-muted);
    font-size:1rem;
    line-height:1.5;
  }
  .debug-back{
    width:max-content;
    color:var(--debug-accent);
    text-decoration:none;
    border-bottom:1px solid currentColor;
    padding-bottom:2px;
  }
  .debug-stack{
    display:grid;
    gap:16px;
    margin-top:16px;
  }
  .debug-card{
    padding:18px;
    display:grid;
    gap:16px;
  }
  .debug-head{
    display:grid;
    gap:8px;
  }
  .debug-heading{
    margin:0;
    font-size:clamp(1.35rem,2.5vw,1.9rem);
    line-height:1.05;
    letter-spacing:-.02em;
  }
  .debug-meta{
    margin:0;
    color:var(--debug-muted);
    font-size:.96rem;
  }
  .debug-grid{
    display:grid;
    gap:16px;
    grid-template-columns:repeat(2, minmax(0, 1fr));
  }
  .debug-chart{
    display:grid;
    gap:10px;
    min-width:0;
    padding-top:10px;
    border-top:1px solid var(--debug-line);
  }
  .debug-chart h3{
    margin:0;
    font-size:1rem;
    line-height:1.2;
    letter-spacing:.02em;
    text-transform:uppercase;
  }
  .debug-chart-note{
    margin:0;
    color:var(--debug-muted);
    font-size:.9rem;
  }
  .debug-empty,
  .debug-loading,
  .debug-error{
    margin:0;
    color:var(--debug-muted);
  }
  .debug-error{
    color:#8a1c1c;
  }
  @media (max-width:900px){
    .debug-grid{
      grid-template-columns:1fr;
    }
  }
`;

document.head.append(Object.assign(document.createElement('style'), { textContent: pageCss }));

function chartSection(title, note, node) {
  const section = document.createElement('section');
  section.className = 'debug-chart';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const description = document.createElement('p');
  description.className = 'debug-chart-note';
  description.textContent = note;

  section.append(heading, description);
  section.append(
    node ||
      Object.assign(document.createElement('p'), {
        className: 'debug-empty',
        textContent: 'Sin datos para esta candidatura.',
      }),
  );
  return section;
}

function candidateCard(candidate) {
  const card = document.createElement('article');
  card.className = 'debug-card';

  const header = document.createElement('header');
  header.className = 'debug-head';

  const title = document.createElement('h2');
  title.className = 'debug-heading';
  title.textContent = candidateLabel(candidate);

  const meta = document.createElement('p');
  meta.className = 'debug-meta';
  meta.textContent = `Ingresos: ${MONEY(candidate.ingresoTotal)} · Egresos: ${MONEY(candidate.egresoTotal)} · ${candidate.ingresos.length} aportes · ${candidate.egresos.length} egresos`;

  const grid = document.createElement('div');
  grid.className = 'debug-grid';
  grid.append(
    chartSection(
      'Línea de tiempo de aportes',
      'Suma semanal de aportes reportados.',
      line(incomeTimeline(candidate.ingresos, 'semana'), { ...chartOpts, xDomain: TIMELINE_X_DOMAIN }),
    ),
    chartSection(
      'Línea de tiempo de egresos',
      'Suma semanal de egresos reportados.',
      line(expenseTimeline(candidate.egresos, 'semana'), { ...chartOpts, xDomain: TIMELINE_X_DOMAIN }),
    ),
  );

  header.append(title, meta);
  card.append(header, grid);
  return card;
}

async function init() {
  try {
    const datasets = await loadCsvDatasets({ ingresosUrl, egresosUrl });
    const store = buildStore(datasets);
    const candidates = store.candidates
      .filter((candidate) => candidate.positions.includes('Presidente'))
      .slice()
      .sort((a, b) => candidateLabel(a).localeCompare(candidateLabel(b), 'es'));

    const fragment = document.createDocumentFragment();
    if (!candidates.length) {
      fragment.append(
        Object.assign(document.createElement('section'), {
          className: 'debug-card',
          innerHTML: '<p class="debug-empty">No encontré candidaturas presidenciales.</p>',
        }),
      );
    } else {
      candidates.forEach((candidate) => fragment.append(candidateCard(candidate)));
    }

    app.replaceChildren(fragment);
  } catch (error) {
    app.replaceChildren(
      Object.assign(document.createElement('section'), {
        className: 'debug-card',
        innerHTML: `<p class="debug-error">${String(error?.message || error)}</p>`,
      }),
    );
  }
}

init();
