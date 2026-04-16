import { useEffect, useState } from 'react';
import { bars } from './charts/bars.js';
import { incomeBreakdownChart } from './charts/income-breakdown.js';
import { line } from './charts/line.js';
import { treemap } from './charts/treemap.js';
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
  Toggle,
  byPos,
  chartOpts,
  contributionLabel,
  entityFor,
  expenseAmount,
  expenseTimeline,
  expenseTreemapBreakdown,
  incomeBreakdown,
  num,
  parseHashRoute,
  partyBreakdown,
  plural,
  posOptions,
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

function CandidateModal({ entity }) {
  const [pos, setPos] = useState('total');
  const expenseRows = byPos(entity.egresos, pos);
  const expenseTree = expenseTreemapBreakdown(expenseRows);
  const balanceStat = candidateBalanceStat(entity);
  return (
    <div>
      <Meta
        items={[
          { label: 'Nombre', values: [entity.name] },
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
      <Section title="Financiación por tipo">
        {incomeBreakdown(entity.ingresos).length ? (
          <PlotFigure
            renderNode={() => incomeBreakdownChart(incomeBreakdown(entity.ingresos), chartOpts)}
            deps={[entity.ingresos]}
          />
        ) : (
          <Empty text="No hay ingresos clasificados." />
        )}
      </Section>
      <Section title="Tabla de aportantes">
        <Table
          emptyText="Esta candidatura no tiene aportes cargados."
          columns={[
            { header: 'Fecha', key: 'fecha' },
            { header: 'Aportante', key: 'aportante', strong: true },
            { header: 'Cédula / RUC', key: 'cedula' },
            { header: 'Tipo', key: 'tipo' },
            { header: 'Monto', key: 'monto' },
          ]}
          rows={entity.ingresos.map((row) => ({
            fecha: TEXT(row.fecha) || '—',
            aportante: TEXT(row.contribuyenteNombre) || 'Sin nombre',
            cedula: TEXT(row.cedulaRuc) || '—',
            tipo: contributionLabel(row),
            monto: MONEY(num(row.total)),
          }))}
        />
      </Section>
      <Section
        title="Tipo de gastos de campaña"
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
          <PlotFigure renderNode={() => line(expenseTimeline(expenseRows, 'día'), chartOpts)} deps={[expenseRows]} />
        ) : (
          <Empty text="No hay fechas válidas suficientes." />
        )}
      </Section>
      <Section title="Tabla de gastos">
        <Table
          emptyText="Esta candidatura no tiene gastos cargados."
          columns={[
            { header: 'Fecha', key: 'fecha' },
            { header: 'Proveedor', key: 'proveedor', strong: true },
            { header: 'Detalle', key: 'detalle' },
            { header: 'Categoría', key: 'categoria' },
            { header: 'Monto', key: 'monto' },
          ]}
          rows={expenseRows.map((row) => ({
            fecha: TEXT(row.fecha) || '—',
            proveedor: TEXT(row.proveedorNombre) || 'Sin nombre',
            detalle: TEXT(row.detalleGastoResumido) || TEXT(row.detalleGasto) || '—',
            categoria: TEXT(row.GastoCategoria) || 'Sin categoría',
            monto: MONEY(expenseAmount(row)),
          }))}
        />
      </Section>
    </div>
  );
}

function DonorModal({ entity }) {
  return (
    <div>
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
      <Section title="Aportes por tipo">
        {incomeBreakdown(entity.ingresos).length ? (
          <PlotFigure renderNode={() => bars(incomeBreakdown(entity.ingresos), chartOpts)} deps={[entity.ingresos]} />
        ) : (
          <Empty text="Este aportante no tiene aportes clasificados." />
        )}
      </Section>
      <Section title="Tabla de aportes">
        <Table
          emptyText="Este aportante no tiene registros cargados."
          columns={[
            { header: 'Fecha', key: 'fecha' },
            { header: 'Candidatura', key: 'candidato', strong: true },
            { header: 'Partido', key: 'partido' },
            { header: 'Tipo', key: 'tipo' },
            { header: 'Monto', key: 'monto' },
          ]}
          rows={entity.ingresos.map((row) => ({
            fecha: TEXT(row.fecha) || '—',
            candidato: [TEXT(row.candidateName), TEXT(row.candidatePosition)].filter(Boolean).join(' · ') || 'Sin nombre',
            partido: TEXT(row.candidateParty) || 'Sin partido',
            tipo: contributionLabel(row),
            monto: MONEY(num(row.total)),
          }))}
        />
      </Section>
      <Section title="Aportes por partido">
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
  const rows = byPos(entity.egresos, pos);
  const expenseTree = expenseTreemapBreakdown(rows);
  return (
    <div>
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
      <Section title="Tabla de gastos">
        <Table
          emptyText="Este proveedor no tiene gastos cargados."
          columns={[
            { header: 'Fecha', key: 'fecha' },
            { header: 'Candidatura', key: 'candidato', strong: true },
            { header: 'Partido', key: 'partido' },
            { header: 'Categoría', key: 'categoria' },
            { header: 'Monto', key: 'monto' },
          ]}
          rows={rows.map((row) => ({
            fecha: TEXT(row.fecha) || '—',
            candidato: [TEXT(row.candidateName), TEXT(row.candidatePosition)].filter(Boolean).join(' · ') || 'Sin nombre',
            partido: TEXT(row.candidateParty) || 'Sin partido',
            categoria: TEXT(row.GastoCategoria) || TEXT(row.detalleGastoResumido) || 'Sin categoría',
            monto: MONEY(expenseAmount(row)),
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
    <div className="mf-overlay" onClick={(event) => event.target === event.currentTarget && close()}>
      <div className="mf-modal">
        <div className="mf-modal-body">
          <div className="mf-close-row">
            <button className="mf-close" type="button" onClick={close}>
              ×
            </button>
          </div>
          {body}
        </div>
      </div>
    </div>
  );
}
