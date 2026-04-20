import { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { bars } from './charts/bars.js';
import { line } from './charts/line.js';
import { treemap } from './charts/treemap.js';
import { FinanciacionChartStyles, IncomeBreakdownChart } from './financiacion-chart-element.jsx';
import {
  Empty,
  INT,
  MONEY,
  Meta,
  PlotFigure,
  Section,
  Stats,
  TEXT,
  Table,
  TIMELINE_X_DOMAIN,
  Toggle,
  byPos,
  candidateDisplayName,
  candidateFullName,
  chartOpts,
  contributionLabel,
  entityFor,
  expenseAmount,
  expenseTimeline,
  expenseTreemapBreakdown,
  incomeBreakdown,
  num,
  parsePanamaDate,
  parseHashRoute,
  partyBreakdown,
  plural,
  posOptions,
  slugify,
} from './embed-shared.jsx';

function candidateBalanceStat(entity) {
  const difference = entity.ingresoTotal - entity.egresoTotal;
  const sign = difference > 0 ? '+' : difference < 0 ? '-' : '';
  const label = difference > 0 ? 'Saldo a favor' : difference < 0 ? 'Saldo en contra' : 'Sin diferencia';
  return {
    value: `${sign}${MONEY(Math.abs(difference))}`,
    label,
  };
}

function PdfLinkCell({ url }) {
  const href = TEXT(url);
  if (!href) return '—';
  return (
    <a href={href} target="_blank" rel="noreferrer">
      Ver PDF
    </a>
  );
}

function modalKindLabel(kind) {
  if (kind === 'candidato') return 'Candidato';
  if (kind === 'aportante') return 'Aportante';
  if (kind === 'proveedor') return 'Proveedor';
  return 'Ficha';
}

function modalHeading(route, entity) {
  const type = modalKindLabel(route.kind);
  if (!entity) return type;
  if (route.kind === 'candidato') return `${type}: ${candidateFullName(entity)}`;
  return entity?.name ? `${type}: ${entity.name}` : type;
}

function csvCellValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  return TEXT(value);
}

function sortRowsByDate(rows) {
  return [...rows]
    .map((row, index) => ({
      row,
      index,
      time: parsePanamaDate(row.fecha)?.getTime() ?? Number.NEGATIVE_INFINITY,
    }))
    .sort((a, b) => d3.descending(a.time, b.time) || d3.ascending(a.index, b.index))
    .map(({ row }) => row);
}

function downloadTableCsv({ filename, columns, rows }) {
  const csvText = d3.csvFormatRows([
    columns.map((column) => TEXT(column.header)),
    ...rows.map((row) => columns.map((column) => csvCellValue(row[column.key]))),
  ]);
  const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function CsvDownloadButton({ columns, rows, filename, label }) {
  return (
    <button
      className="mf-icon-button"
      type="button"
      aria-label={label}
      title={label}
      onClick={() => downloadTableCsv({ filename, columns, rows })}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M10 3.75v8.5m0 0 3-3m-3 3-3-3M4.75 13.75v1.5c0 .55.45 1 1 1h8.5c.55 0 1-.45 1-1v-1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="mf-icon-button__label">{label}</span>
    </button>
  );
}

function CandidateModal({ entity }) {
  const [pos, setPos] = useState('total');
  const displayName = candidateDisplayName(entity);
  const fullName = candidateFullName(entity);
  const incomeRows = sortRowsByDate(entity.ingresos);
  const expenseRows = sortRowsByDate(byPos(entity.egresos, pos));
  const expenseTree = expenseTreemapBreakdown(expenseRows);
  const balanceStat = candidateBalanceStat(entity);
  const ingresoColumns = [
    { header: 'Fecha', key: 'fecha' },
    { header: 'Aportante', key: 'aportante', strong: true },
    { header: 'Cédula / RUC', key: 'cedula' },
    { header: 'Tipo', key: 'tipo' },
    { header: 'Monto', key: 'monto' },
    { header: 'PDF original', key: 'pdf' },
  ];
  const ingresoTableRows = incomeRows.map((row) => ({
    fecha: TEXT(row.fecha) || '—',
    aportante: TEXT(row.contribuyenteNombre) || 'Sin nombre',
    cedula: TEXT(row.cedulaRuc) || '—',
    tipo: contributionLabel(row),
    monto: MONEY(num(row.total)),
    pdf: TEXT(row.pdfUrl),
  }));
  const gastoColumns = [
    { header: 'Fecha', key: 'fecha' },
    { header: 'Proveedor', key: 'proveedor', strong: true },
    { header: 'Detalle', key: 'detalle' },
    { header: 'Categoría', key: 'categoria' },
    { header: 'Monto', key: 'monto' },
    { header: 'PDF original', key: 'pdf' },
  ];
  const gastoTableRows = expenseRows.map((row) => ({
    fecha: TEXT(row.fecha) || '—',
    proveedor: TEXT(row.proveedorNombre) || 'Sin nombre',
    detalle: TEXT(row.detalleGastoResumido) || TEXT(row.detalleGasto) || '—',
    categoria: TEXT(row.GastoCategoria) || 'Sin categoría',
    monto: MONEY(expenseAmount(row)),
    pdf: TEXT(row.pdfUrl),
  }));
  const entitySlug = slugify(entity.name) || 'candidato';
  return (
    <div className="mf-modal-stack">
      <Meta
        items={[
          { label: 'Nombre', values: [displayName] },
          ...(fullName !== displayName ? [{ label: 'Nombre completo', values: [fullName] }] : []),
          { label: plural(entity.parties.length, 'Partido', 'Partidos'), values: entity.parties },
          { label: plural(entity.positions.length, 'Cargo', 'Cargos'), values: entity.positions },
          { label: 'Ubicación', values: [entity.provinces[0], entity.districts[0]].filter(Boolean) },
        ]}
      />
      <Stats
        items={[
          { value: INT(entity.contributorCount), label: plural(entity.contributorCount, 'Aportante', 'Aportantes') },
          { value: MONEY(entity.ingresoTotal), label: 'Ingresos totales' },
          { value: MONEY(entity.egresoTotal), label: 'Gastos totales' },
          balanceStat,
        ]}
      />
      <Section title="Financiación por tipo" titleAs="h4">
        {incomeBreakdown(entity.ingresos).length ? (
          <>
            <FinanciacionChartStyles />
            <IncomeBreakdownChart items={incomeBreakdown(entity.ingresos)} />
          </>
        ) : (
          <Empty text="No hay ingresos clasificados." />
        )}
      </Section>
      <Section
        title="Tabla de aportantes"
        controls={
          ingresoTableRows.length ? (
            <CsvDownloadButton
              columns={ingresoColumns}
              rows={ingresoTableRows}
              filename={`${entitySlug}-ingresos.csv`}
              label="Descargar esta tabla"
            />
          ) : null
        }
      >
        <Table
          emptyText="Esta candidatura no tiene aportes cargados."
          columns={ingresoColumns}
          rows={ingresoTableRows.map((row) => ({
            ...row,
            pdf: <PdfLinkCell url={row.pdf} />,
          }))}
        />
      </Section>
      <Section
        title="Tipo de gastos de campaña"
        titleAs="h4"
        controls={
          entity.positions.length > 1 ? (
            <Toggle
              value={pos}
              options={posOptions(entity.egresos)}
              onChange={setPos}
              format={(d) => (d === 'total' ? 'Total' : d)}
            />
          ) : null
        }
      >
        {expenseTree.children.length ? (
          <PlotFigure renderNode={() => treemap(expenseTree, chartOpts)} deps={[expenseRows]} />
        ) : (
          <Empty text="No hay gastos clasificados para esta selección." />
        )}
      </Section>
      <Section
        title="Línea de tiempo de gastos"
        titleAs="h4"
        controls={
          entity.positions.length > 1 ? (
            <Toggle
              value={pos}
              options={posOptions(entity.egresos)}
              onChange={setPos}
              format={(d) => (d === 'total' ? 'Total' : d)}
            />
          ) : null
        }
      >
        {expenseTimeline(expenseRows, 'día').length ? (
          <PlotFigure
            renderNode={() => line(expenseTimeline(expenseRows, 'día'), { ...chartOpts, xDomain: TIMELINE_X_DOMAIN })}
            deps={[expenseRows]}
          />
        ) : (
          <Empty text="No hay fechas válidas suficientes." />
        )}
      </Section>
      <Section
        title="Tabla de gastos"
        controls={
          gastoTableRows.length ? (
            <CsvDownloadButton
              columns={gastoColumns}
              rows={gastoTableRows}
              filename={`${entitySlug}-egresos.csv`}
              label="Descargar esta tabla"
            />
          ) : null
        }
      >
        <Table
          emptyText="Esta candidatura no tiene gastos cargados."
          columns={gastoColumns}
          rows={gastoTableRows.map((row) => ({
            ...row,
            pdf: <PdfLinkCell url={row.pdf} />,
          }))}
        />
      </Section>
    </div>
  );
}

function DonorModal({ entity }) {
  const incomeRows = sortRowsByDate(entity.ingresos);
  const columns = [
    { header: 'Fecha', key: 'fecha' },
    { header: 'Candidatura', key: 'candidato', strong: true },
    { header: 'Partido', key: 'partido' },
    { header: 'Tipo', key: 'tipo' },
    { header: 'Monto', key: 'monto' },
    { header: 'PDF original', key: 'pdf' },
  ];
  const tableRows = incomeRows.map((row) => ({
    fecha: TEXT(row.fecha) || '—',
    candidato: [TEXT(row.candidateName), TEXT(row.candidatePosition)].filter(Boolean).join(' · ') || 'Sin nombre',
    partido: TEXT(row.candidateParty) || 'Sin partido',
    tipo: contributionLabel(row),
    monto: MONEY(num(row.total)),
    pdf: TEXT(row.pdfUrl),
  }));
  const entitySlug = slugify(entity.name) || 'aportante';
  return (
    <div className="mf-modal-stack">
      <Meta
        items={[
          { label: 'Aportante', values: [entity.name] },
          { label: plural(entity.parties.length, 'Partido', 'Partidos'), values: entity.parties },
          { label: plural(entity.positions.length, 'Candidatura', 'Candidaturas'), values: entity.positions },
        ]}
      />
      <Stats
        items={[
          { value: INT(entity.candidateCount), label: plural(entity.candidateCount, 'Candidatura', 'Candidaturas') },
          { value: MONEY(entity.total), label: 'Aportes totales' },
        ]}
      />
      <Section title="Aportes por tipo" titleAs="h4">
        {incomeBreakdown(entity.ingresos).length ? (
          <PlotFigure renderNode={() => bars(incomeBreakdown(entity.ingresos), chartOpts)} deps={[entity.ingresos]} />
        ) : (
          <Empty text="Este aportante no tiene aportes clasificados." />
        )}
      </Section>
      <Section
        title="Tabla de aportes"
        controls={
          tableRows.length ? (
            <CsvDownloadButton
              columns={columns}
              rows={tableRows}
              filename={`${entitySlug}-ingresos.csv`}
              label="Descargar esta tabla"
            />
          ) : null
        }
      >
        <Table
          emptyText="Este aportante no tiene registros cargados."
          columns={columns}
          rows={tableRows.map((row) => ({
            ...row,
            pdf: <PdfLinkCell url={row.pdf} />,
          }))}
        />
      </Section>
      <Section title="Aportes por partido" titleAs="h4">
        {partyBreakdown(entity.ingresos).length ? (
          <PlotFigure renderNode={() => bars(partyBreakdown(entity.ingresos), chartOpts)} deps={[entity.ingresos]} />
        ) : (
          <Empty text="No hay partidos suficientes para desglosar los aportes." />
        )}
      </Section>
    </div>
  );
}

function ProviderModal({ entity }) {
  const [pos, setPos] = useState('total');
  const rows = sortRowsByDate(byPos(entity.egresos, pos));
  const expenseTree = expenseTreemapBreakdown(rows);
  const columns = [
    { header: 'Fecha', key: 'fecha' },
    { header: 'Candidatura', key: 'candidato', strong: true },
    { header: 'Partido', key: 'partido' },
    { header: 'Categoría', key: 'categoria' },
    { header: 'Monto', key: 'monto' },
    { header: 'PDF original', key: 'pdf' },
  ];
  const tableRows = rows.map((row) => ({
    fecha: TEXT(row.fecha) || '—',
    candidato: [TEXT(row.candidateName), TEXT(row.candidatePosition)].filter(Boolean).join(' · ') || 'Sin nombre',
    partido: TEXT(row.candidateParty) || 'Sin partido',
    categoria: TEXT(row.GastoCategoria) || TEXT(row.detalleGastoResumido) || 'Sin categoría',
    monto: MONEY(expenseAmount(row)),
    pdf: TEXT(row.pdfUrl),
  }));
  const entitySlug = slugify(entity.name) || 'proveedor';
  return (
    <div className="mf-modal-stack">
      <Meta
        items={[
          { label: 'Proveedor', values: [entity.name] },
          { label: plural(entity.parties.length, 'Partido', 'Partidos'), values: entity.parties },
          { label: plural(entity.positions.length, 'Candidatura', 'Candidaturas'), values: entity.positions },
        ]}
      />
      <Stats
        items={[
          { value: INT(entity.candidateCount), label: plural(entity.candidateCount, 'Candidatura', 'Candidaturas') },
          { value: MONEY(entity.total), label: 'Gastos totales' },
        ]}
      />
      <Section
        title="Tipo de gastos de campaña"
        titleAs="h4"
        controls={
          entity.positions.length > 1 ? (
            <Toggle
              value={pos}
              options={posOptions(entity.egresos)}
              onChange={setPos}
              format={(d) => (d === 'total' ? 'Total' : d)}
            />
          ) : null
        }
      >
        {expenseTree.children.length ? (
          <PlotFigure renderNode={() => treemap(expenseTree, chartOpts)} deps={[rows]} />
        ) : (
          <Empty text="No hay gastos clasificados para esta selección." />
        )}
      </Section>
      <Section
        title="Tabla de gastos"
        controls={
          tableRows.length ? (
            <CsvDownloadButton
              columns={columns}
              rows={tableRows}
              filename={`${entitySlug}-egresos.csv`}
              label="Descargar esta tabla"
            />
          ) : null
        }
      >
        <Table
          emptyText="Este proveedor no tiene gastos cargados."
          columns={columns}
          rows={tableRows.map((row) => ({
            ...row,
            pdf: <PdfLinkCell url={row.pdf} />,
          }))}
        />
      </Section>
    </div>
  );
}

export function ModalRouter({ store, emptyHash }) {
  const [route, setRoute] = useState(() =>
    typeof window === 'undefined' ? { kind: 'none' } : parseHashRoute(window.location.hash),
  );

  useEffect(() => {
    const onHash = () => setRoute(parseHashRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (route.kind === 'none') return;
    const previous = document.body.style.overflow;
    const onKey = (event) => {
      if (event.key === 'Escape') window.location.hash = emptyHash;
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [route, emptyHash]);

  if (route.kind === 'none') return null;
  const entity = entityFor(store, route);
  const title = modalHeading(route, entity);
  const titleId = 'mf-modal-title';
  const close = () => {
    window.location.hash = emptyHash;
  };

  let body = <Empty text="Ruta no soportada." />;
  if (route.kind !== 'unknown') {
    if (!entity) body = <Empty text="No encontré esa ficha." />;
    else if (entity.kind === 'candidato') body = <CandidateModal entity={entity} />;
    else if (entity.kind === 'aportante') body = <DonorModal entity={entity} />;
    else body = <ProviderModal entity={entity} />;
  }

  return (
    <div
      className="modal fade show d-block mf-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => event.target === event.currentTarget && close()}
    >
      <div className="modal-dialog modal-xl mf-modal" role="document">
        <div className="modal-content mf-modal-content" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header mf-modal-header">
            <h1 className="modal-title mf-modal-title" id={titleId}>
              {title}
            </h1>
            <button className="close mf-modal-close" type="button" aria-label="Cerrar" onClick={close}>
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div className="modal-body mf-modal-body">{body}</div>
        </div>
      </div>
    </div>
  );
}
