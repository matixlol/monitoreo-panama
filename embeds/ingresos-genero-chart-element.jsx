import { useMemo } from 'react';
import { ALL, formatEmbedCurrency, formatEmbedNumber, sortPos, uniq } from './embed-shared.jsx';
import { FinanciacionChartStyles, Tabs } from './financiacion-chart-element.jsx';

const MIN_BAR_WIDTH = 8;
const FEMALE_COLOR = '#d96b8f';
const MALE_COLOR = '#3089b8';

const INGRESOS_GENERO_CHART_CSS = `
  .mf-gender-income{
    display:grid;
    gap:18px;
    width:min(100%,760px);
    max-width:100%;
    margin:0 auto;
  }
  .mf-gender-income__summary{
    display:grid;
    gap:6px;
    padding:18px 20px;
    border:1px solid #e4e7ec;
    border-radius:14px;
    background:#fff;
  }
  .mf-gender-income__eyebrow{
    font-size:.8rem;
    font-weight:700;
    letter-spacing:.08em;
    text-transform:uppercase;
    color:#667085;
  }
  .mf-gender-income__headline{
    font-size:clamp(1.1rem,2vw,1.5rem);
    font-weight:700;
    line-height:1.1;
    letter-spacing:-.03em;
    color:#101828;
  }
  .mf-gender-income__note{
    color:#667085;
    font-size:.95rem;
    line-height:1.4;
  }
  .mf-gender-income__list{
    display:grid;
    gap:16px;
  }
  .mf-gender-income__item{
    display:grid;
    gap:8px;
  }
  .mf-gender-income__row{
    display:flex;
    align-items:flex-end;
    justify-content:space-between;
    gap:14px;
  }
  .mf-gender-income__label-wrap{
    display:grid;
    gap:2px;
    min-width:0;
  }
  .mf-gender-income__label{
    font-size:1.02rem;
    font-weight:650;
    line-height:1.2;
    color:#344054;
    letter-spacing:-.6px;
  }
  .mf-gender-income__meta{
    font-size:.92rem;
    line-height:1.3;
    color:#667085;
  }
  .mf-gender-income__value{
    font-size:1.02rem;
    font-weight:650;
    line-height:1.2;
    color:#111827;
    letter-spacing:-.6px;
    font-variant-numeric:tabular-nums;
    text-align:right;
    white-space:nowrap;
  }
  .mf-gender-income__track{
    height:14px;
    border-radius:999px;
    background:#edf2f8;
    overflow:hidden;
  }
  .mf-gender-income__fill{
    height:100%;
    border-radius:999px;
    transition:width .32s ease;
  }
  @media (max-width:720px){
    .mf-gender-income{
      gap:16px;
      width:100%;
    }
    .mf-gender-income__summary{
      padding:16px;
    }
    .mf-gender-income__row{
      align-items:baseline;
    }
    .mf-gender-income__value{
      font-size:.98rem;
    }
    .mf-gender-income__track{
      height:12px;
    }
  }
`;

function positionOptions(store) {
  return [ALL, ...uniq(store.overview.candidates.map((candidate) => candidate.position)).sort(sortPos)];
}

function genderIncomeRows(candidates) {
  const groups = {
    female: {
      key: 'female',
      label: 'Candidatas mujeres',
      shortLabel: 'Mujeres',
      color: FEMALE_COLOR,
      rows: [],
    },
    male: {
      key: 'male',
      label: 'Candidatos varones',
      shortLabel: 'Varones',
      color: MALE_COLOR,
      rows: [],
    },
  };

  candidates.forEach((candidate) => {
    if (candidate?.gender === 'female') groups.female.rows.push(candidate);
    if (candidate?.gender === 'male') groups.male.rows.push(candidate);
  });

  return Object.values(groups).map((group) => {
    const total = group.rows.reduce((acc, candidate) => acc + (+candidate.ingresoTotal || 0), 0);
    const count = group.rows.length;
    return {
      key: group.key,
      label: group.label,
      shortLabel: group.shortLabel,
      color: group.color,
      count,
      total,
      value: count ? total / count : 0,
    };
  });
}

function comparisonSummary(rows) {
  const female = rows.find((row) => row.key === 'female');
  const male = rows.find((row) => row.key === 'male');

  if (!female?.count && !male?.count) {
    return {
      eyebrow: 'Sin datos comparables',
      headline: 'No hay candidaturas con género registrado para este filtro.',
      note: 'Probá con otra cobertura para comparar promedios de ingresos.',
    };
  }

  if (!female?.count || !male?.count) {
    const available = female?.count ? female : male;
    return {
      eyebrow: 'Comparación incompleta',
      headline: `${available.label} promedian ${formatEmbedCurrency(available.value, 0)}.`,
      note: 'Faltan candidaturas del otro grupo para calcular la brecha entre mujeres y varones.',
    };
  }

  const delta = female.value - male.value;
  if (Math.abs(delta) < 0.5) {
    return {
      eyebrow: 'Brecha promedio',
      headline: 'Mujeres y varones muestran prácticamente el mismo promedio de ingresos.',
      note: `${female.count} mujeres comparadas con ${male.count} varones en esta cobertura.`,
    };
  }

  const leader = delta > 0 ? female : male;
  const trailer = delta > 0 ? male : female;
  return {
    eyebrow: 'Brecha promedio',
    headline: `${leader.shortLabel} promedian ${formatEmbedCurrency(Math.abs(delta), 0)} más que ${trailer.shortLabel.toLowerCase()}.`,
    note: `${female.count} mujeres comparadas con ${male.count} varones en esta cobertura.`,
  };
}

function GenderIncomeBars({ candidates }) {
  const rows = useMemo(() => genderIncomeRows(candidates), [candidates]);
  const summary = useMemo(() => comparisonSummary(rows), [rows]);
  const maxValue = useMemo(() => Math.max(...rows.map((row) => row.value), 0), [rows]);

  if (!rows.some((row) => row.count > 0)) return <div className="empty">Sin datos.</div>;

  return (
    <div className="mf-gender-income">
      <div className="mf-gender-income__summary">
        <div className="mf-gender-income__eyebrow">{summary.eyebrow}</div>
        <div className="mf-gender-income__headline">{summary.headline}</div>
        <div className="mf-gender-income__note">{summary.note}</div>
      </div>

      <div className="mf-gender-income__list" role="list" aria-label="Promedio de ingresos por género">
        {rows.map((row) => {
          if (!row.count) return null;
          const ratio = maxValue > 0 ? row.value / maxValue : 0;
          return (
            <div className="mf-gender-income__item" key={row.key} role="listitem">
              <div className="mf-gender-income__row">
                <div className="mf-gender-income__label-wrap">
                  <div className="mf-gender-income__label">{row.label}</div>
                  <div className="mf-gender-income__meta">
                    {formatEmbedNumber(row.count, 0)} candidaturas con género registrado
                  </div>
                </div>
                <div className="mf-gender-income__value">{formatEmbedCurrency(row.value, 0)}</div>
              </div>
              <div className="mf-gender-income__track" aria-hidden="true">
                <div
                  className="mf-gender-income__fill"
                  style={{
                    width: ratio > 0 ? `max(${ratio * 100}%, ${MIN_BAR_WIDTH}px)` : '0%',
                    background: row.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function IngresosGeneroChartElementApp({ element, store, loading = false, error = null }) {
  const position = element?.getAttribute('position') || ALL;
  const options = store ? positionOptions(store) : [ALL];
  const candidates = store
    ? store.overview.candidates.filter((candidate) => position === ALL || candidate.position === position)
    : [];

  return (
    <>
      <FinanciacionChartStyles />
      <style>{INGRESOS_GENERO_CHART_CSS}</style>
      <section className="wc-panel">
        <h4>Promedio de ingresos por género</h4>
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
              <GenderIncomeBars candidates={candidates} />
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}