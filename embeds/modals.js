import { h } from 'https://esm.sh/preact@10.26.6';
import { useEffect, useMemo, useState } from 'https://esm.sh/preact@10.26.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

export function createModalRouter(deps) {
  const {
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
  } = deps;

  function CandidateModal({ entity }) {
    const [pos, setPos] = useState('total');
    const erows = useMemo(() => byPos(entity.egresos, pos), [entity, pos]);
    return html`<div>
      <${Meta}
        items=${[
          { label: 'Candidato', values: [entity.name] },
          { label: plural(entity.parties.length, 'Partido', 'Partidos'), values: entity.parties },
          { label: plural(entity.positions.length, 'Candidatura', 'Candidaturas'), values: entity.positions },
          { label: 'Ubicación', values: [entity.provinces[0], entity.districts[0]].filter(Boolean) },
        ]}
      />
      <${Stats}
        items=${[
          { value: INT(entity.contributorCount), label: plural(entity.contributorCount, 'Aportante', 'Aportantes') },
          { value: MONEY(entity.ingresoTotal), label: 'Ingresos totales' },
          { value: MONEY(entity.egresoTotal), label: 'Gastos totales' },
        ]}
      />
      <${Section} title="Financiación por tipo"
        >${incomeBreakdown(entity.ingresos).length
          ? html`<${PlotFigure}
              make=${() => bars(incomeBreakdown(entity.ingresos), chartOpts)}
              deps=${[entity.ingresos]}
            />`
          : html`<${Empty} text="No hay ingresos clasificados." />`}<//
      >
      <${Section} title="Tabla de aportantes"
        ><${Table}
          emptyText="Este candidato no tiene aportes cargados."
          columns=${[
            { header: 'Fecha', key: 'fecha' },
            { header: 'Aportante', key: 'aportante', strong: true },
            { header: 'Cédula / RUC', key: 'cedula' },
            { header: 'Tipo', key: 'tipo' },
            { header: 'Monto', key: 'monto' },
          ]}
          rows=${entity.ingresos.map((r) => ({
            fecha: TEXT(r.fecha) || '—',
            aportante: TEXT(r.contribuyenteNombre) || 'Sin nombre',
            cedula: TEXT(r.cedulaRuc) || '—',
            tipo: contributionLabel(r),
            monto: MONEY(num(r.total)),
          }))}
      /><//>
      <${Section}
        title="Tipo de gastos de campaña"
        controls=${entity.positions.length
          ? html`<${Toggle}
              value=${pos}
              options=${posOptions(entity.egresos)}
              onChange=${setPos}
              format=${(d) => (d === 'total' ? 'Total' : d)}
            />`
          : null}
        >${expenseBreakdown(erows).length
          ? html`<${PlotFigure} make=${() => treemap(expenseBreakdown(erows), chartOpts)} deps=${[erows]} />`
          : html`<${Empty} text="No hay gastos clasificados para esta selección." />`}<//
      >
      <${Section}
        title="Línea de tiempo de gastos"
        controls=${entity.positions.length
          ? html`<${Toggle}
              value=${pos}
              options=${posOptions(entity.egresos)}
              onChange=${setPos}
              format=${(d) => (d === 'total' ? 'Total' : d)}
            />`
          : null}
        >${expenseTimeline(erows, 'día').length
          ? html`<${PlotFigure} make=${() => line(expenseTimeline(erows, 'día'), chartOpts)} deps=${[erows]} />`
          : html`<${Empty} text="No hay fechas válidas suficientes." />`}<//
      >
      <${Section} title="Tabla de gastos"
        ><${Table}
          emptyText="Este candidato no tiene gastos cargados."
          columns=${[
            { header: 'Fecha', key: 'fecha' },
            { header: 'Proveedor', key: 'proveedor', strong: true },
            { header: 'Detalle', key: 'detalle' },
            { header: 'Categoría', key: 'categoria' },
            { header: 'Monto', key: 'monto' },
          ]}
          rows=${erows.map((r) => ({
            fecha: TEXT(r.fecha) || '—',
            proveedor: TEXT(r.proveedorNombre) || 'Sin nombre',
            detalle: TEXT(r.detalleGastoResumido) || TEXT(r.detalleGasto) || '—',
            categoria: TEXT(r.GastoCategoria) || 'Sin categoría',
            monto: MONEY(num(r.totalDeGastosDePropagandaYCampania)),
          }))}
      /><//>
    </div>`;
  }

  function DonorModal({ entity }) {
    return html`<div>
      <${Meta}
        items=${[
          { label: 'Aportante', values: [entity.name] },
          { label: plural(entity.parties.length, 'Partido', 'Partidos'), values: entity.parties },
          { label: plural(entity.positions.length, 'Candidatura', 'Candidaturas'), values: entity.positions },
        ]}
      />
      <${Stats}
        items=${[
          { value: INT(entity.candidateCount), label: plural(entity.candidateCount, 'Candidato', 'Candidatos') },
          { value: MONEY(entity.total), label: 'Aportes totales' },
        ]}
      />
      <${Section} title="Aportes por tipo"
        >${incomeBreakdown(entity.ingresos).length
          ? html`<${PlotFigure}
              make=${() => bars(incomeBreakdown(entity.ingresos), chartOpts)}
              deps=${[entity.ingresos]}
            />`
          : html`<${Empty} text="Este aportante no tiene aportes clasificados." />`}<//
      >
      <${Section} title="Tabla de aportes"
        ><${Table}
          emptyText="Este aportante no tiene registros cargados."
          columns=${[
            { header: 'Fecha', key: 'fecha' },
            { header: 'Candidato', key: 'candidato', strong: true },
            { header: 'Partido', key: 'partido' },
            { header: 'Tipo', key: 'tipo' },
            { header: 'Monto', key: 'monto' },
          ]}
          rows=${entity.ingresos.map((r) => ({
            fecha: TEXT(r.fecha) || '—',
            candidato: TEXT(r.candidateName) || 'Sin nombre',
            partido: TEXT(r.candidateParty) || 'Sin partido',
            tipo: contributionLabel(r),
            monto: MONEY(num(r.total)),
          }))}
      /><//>
      <${Section} title="Aportes por partido"
        >${partyBreakdown(entity.ingresos).length
          ? html`<${PlotFigure}
              make=${() => bars(partyBreakdown(entity.ingresos), chartOpts)}
              deps=${[entity.ingresos]}
            />`
          : html`<${Empty} text="No hay partidos suficientes para desglosar los aportes." />`}<//
      >
    </div>`;
  }

  function ProviderModal({ entity }) {
    const [pos, setPos] = useState('total');
    const rows = useMemo(() => byPos(entity.egresos, pos), [entity, pos]);
    return html`<div>
      <${Meta}
        items=${[
          { label: 'Proveedor', values: [entity.name] },
          { label: plural(entity.parties.length, 'Partido', 'Partidos'), values: entity.parties },
          { label: plural(entity.positions.length, 'Candidatura', 'Candidaturas'), values: entity.positions },
        ]}
      />
      <${Stats}
        items=${[
          { value: INT(entity.candidateCount), label: plural(entity.candidateCount, 'Candidato', 'Candidatos') },
          { value: MONEY(entity.total), label: 'Gastos totales' },
        ]}
      />
      <${Section}
        title="Tipo de gastos de campaña"
        controls=${entity.positions.length
          ? html`<${Toggle}
              value=${pos}
              options=${posOptions(entity.egresos)}
              onChange=${setPos}
              format=${(d) => (d === 'total' ? 'Total' : d)}
            />`
          : null}
        >${expenseBreakdown(rows).length
          ? html`<${PlotFigure} make=${() => treemap(expenseBreakdown(rows), chartOpts)} deps=${[rows]} />`
          : html`<${Empty} text="No hay gastos clasificados para esta selección." />`}<//
      >
      <${Section} title="Tabla de gastos"
        ><${Table}
          emptyText="Este proveedor no tiene gastos cargados."
          columns=${[
            { header: 'Fecha', key: 'fecha' },
            { header: 'Candidato', key: 'candidato', strong: true },
            { header: 'Partido', key: 'partido' },
            { header: 'Categoría', key: 'categoria' },
            { header: 'Monto', key: 'monto' },
          ]}
          rows=${rows.map((r) => ({
            fecha: TEXT(r.fecha) || '—',
            candidato: TEXT(r.candidateName) || 'Sin nombre',
            partido: TEXT(r.candidateParty) || 'Sin partido',
            categoria: TEXT(r.GastoCategoria) || TEXT(r.detalleGastoResumido) || 'Sin categoría',
            monto: MONEY(num(r.totalDeGastosDePropagandaYCampania)),
          }))}
      /><//>
    </div>`;
  }

  return function ModalRouter({ store, emptyHash }) {
    const [route, setRoute] = useState(
      typeof window === 'undefined' ? { kind: 'none' } : parseHashRoute(window.location.hash),
    );
    useEffect(() => {
      const onHash = () => setRoute(parseHashRoute(window.location.hash));
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);
    useEffect(() => {
      const onKey = (e) => e.key === 'Escape' && route.kind !== 'none' && (window.location.hash = emptyHash);
      if (route.kind !== 'none') {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
          document.body.style.overflow = prev;
          window.removeEventListener('keydown', onKey);
        };
      }
    }, [route, emptyHash]);
    if (route.kind === 'none') return null;
    const entity = entityFor(store, route);
    const close = () => (window.location.hash = emptyHash);
    const body =
      route.kind === 'unknown'
        ? html`<${Empty} text="Ruta no soportada." />`
        : !entity
          ? html`<${Empty} text="No encontré esa ficha." />`
          : entity.kind === 'candidato'
            ? html`<${CandidateModal} entity=${entity} />`
            : entity.kind === 'aportante'
              ? html`<${DonorModal} entity=${entity} />`
              : html`<${ProviderModal} entity=${entity} />`;
    return html`<div class="mf-overlay" onClick=${(e) => e.target === e.currentTarget && close()}>
      <div class="mf-modal">
        <div class="mf-modal-body">
          <div class="mf-close-row"><button class="mf-close" type="button" onClick=${close}>×</button></div>
          ${body}
        </div>
      </div>
    </div>`;
  };
}
