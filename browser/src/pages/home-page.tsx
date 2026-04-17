import * as React from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Search as SearchIcon,
} from 'lucide-react';
import {
  downloadPdf,
  getAffidavitDetail,
  getFilterCatalog,
  searchAffidavits,
  searchCandidateSuggestions,
  type AffidavitListItem,
} from '../lib/api';
import {
  eventLabel,
  fullName,
  locationLabel,
  monthLabel,
  pickPdfName,
  STATUS_LABELS,
} from '../lib/format';
import {
  hasActiveFilters,
  parseSearch,
  serializeSearch,
  type BrowserSearch,
} from '../lib/search';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';

function toFormState(search: BrowserSearch) {
  return { ...search };
}

function buildPageNumbers(page: number, totalPages: number) {
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function ResultsSkeleton() {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Candidato</th>
              <th>Cargo / partido</th>
              <th>Evento</th>
              <th>Ubicación</th>
              <th>Mes</th>
              <th>Estatus</th>
              <th>Archivos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, index) => (
              <tr key={index}>
                {Array.from({ length: 8 }, (_, cellIndex) => (
                  <td key={cellIndex}>
                    <div className="h-4 w-24 animate-pulse rounded bg-secondary/70" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HomePage() {
  const search = useSearch({
    strict: false,
    select: (value) => parseSearch(value as Record<string, unknown>),
  });
  const navigate = useNavigate();
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(() => hasActiveFilters(search));
  const [formState, setFormState] = React.useState(() => toFormState(search));
  const [downloadId, setDownloadId] = React.useState<string | null>(null);
  const deferredCandidateQuery = React.useDeferredValue(formState.q.trim());
  const searchStateKey = [
    search.page,
    search.limit,
    search.q,
    search.status,
    search.eventCategoryId,
    search.periodId,
    search.positionId,
    search.provinceId,
    search.districtId,
    search.townshipId,
    search.circuitId,
    search.partyId,
    search.month,
    search.isProclaimed,
  ].join('|');

  React.useEffect(() => {
    setFormState(toFormState(search));
    if (hasActiveFilters(search)) setIsFiltersOpen(true);
  }, [searchStateKey]);

  const searchQuery = useQuery({
    queryKey: ['affidavits', search],
    queryFn: () => searchAffidavits(search),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const candidateSuggestionsQuery = useQuery({
    queryKey: ['candidate-suggestions', deferredCandidateQuery],
    queryFn: () => searchCandidateSuggestions(deferredCandidateQuery),
    enabled: deferredCandidateQuery.length >= 2,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const detailQueries = useQueries({
    queries:
      searchQuery.data?.data.map((item) => ({
        queryKey: ['affidavit-detail-badge', item.id],
        queryFn: () => getAffidavitDetail(item.id),
        staleTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
      })) ?? [],
  });

  const detailMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    detailQueries.forEach((query, index) => {
      const item = searchQuery.data?.data[index];
      if (!item || !query.data) return;
      map.set(item.id, query.data.totalIngress > 0 || query.data.totalEgress > 0);
    });
    return map;
  }, [detailQueries, searchQuery.data?.data]);

  const catalogQuery = useQuery({
    queryKey: ['filter-catalog'],
    queryFn: getFilterCatalog,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const pageCount = searchQuery.data
    ? Math.max(1, Math.ceil(searchQuery.data.count / searchQuery.data.limit))
    : 1;

  const handleFieldChange = (key: keyof BrowserSearch, value: string | number) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void navigate({
      to: '/',
      search: serializeSearch({
        ...formState,
        q: formState.q.trim(),
        page: 1,
      }),
    });
  };

  const clearFilters = () => {
    setFormState((current) => ({
      ...current,
      status: '',
      eventCategoryId: '',
      periodId: '',
      positionId: '',
      provinceId: '',
      districtId: '',
      townshipId: '',
      circuitId: '',
      partyId: '',
      month: '',
      isProclaimed: '',
    }));
    void navigate({
      to: '/',
      search: serializeSearch({
        ...parseSearch({}),
        q: formState.q.trim(),
      }),
    });
  };

  const updatePage = (page: number) => {
    void navigate({
      to: '/',
      search: serializeSearch({
        ...search,
        page,
      }),
    });
  };

  const handleDownload = async (item: AffidavitListItem) => {
    const pdf = item.AffidavitDocument?.find((document) => document.mimeType === 'application/pdf');
    if (!pdf) return;

    setDownloadId(item.id);
    try {
      await downloadPdf(pdf.url, pickPdfName(pdf.url));
    } finally {
      setDownloadId(null);
    }
  };

  const total = searchQuery.data?.count ?? 0;
  const pageNumbers = buildPageNumbers(search.page, pageCount);
  const candidateSuggestions =
    deferredCandidateQuery.length >= 2 ? candidateSuggestionsQuery.data ?? [] : [];

  return (
    <div className="space-y-6 pb-6">
      <div className="page-shell space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Informes de ingresos y gastos
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            Consulta pública de informes, PDFs y registros JSON de ingresos y gastos de campaña.
          </p>
        </header>

        <section className="panel overflow-hidden">
          <form onSubmit={submitSearch}>
            <div className="flex flex-col gap-4 border-b p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="flex-1 space-y-2 text-sm">
                  <span className="text-muted-foreground">Candidato o cédula</span>
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={formState.q}
                      onChange={(event) => handleFieldChange('q', event.target.value)}
                      placeholder="Nombre o número de cédula"
                      className="pl-9"
                    />
                  </div>
                  {candidateSuggestions.length ? (
                    <div className="rounded-md border bg-card shadow-xs">
                      {candidateSuggestions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleFieldChange('q', option.value);
                          }}
                        >
                          <span className="font-medium">{option.label}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">usar</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFiltersOpen((current) => !current)}
                  >
                    <Filter className="size-4" />
                    {isFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
                  </Button>
                  <Button type="submit">Buscar</Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                La búsqueda consulta nombre y cédula. Las sugerencias se piden bajo demanda, sin
                precargar todo el padrón.
              </p>
            </div>

            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: isFiltersOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="grid gap-4 border-b p-4 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Estatus</span>
                    <Select
                      value={formState.status}
                      onChange={(event) => handleFieldChange('status', event.target.value)}
                      options={[
                        { label: 'Evaluado', value: 'audited' },
                        { label: 'En evaluación', value: 'inAudit' },
                        { label: 'Extemporáneo', value: 'extemporary' },
                        { label: 'Pendiente', value: 'pending' },
                        { label: 'Presentado', value: 'sent' },
                        { label: 'Presentado sin sustento', value: 'sentUnsubstantiated' },
                      ]}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Categoría del evento</span>
                    <Select
                      value={formState.eventCategoryId}
                      onChange={(event) => handleFieldChange('eventCategoryId', event.target.value)}
                      options={catalogQuery.data?.eventCategories ?? []}
                      placeholder={catalogQuery.isLoading ? 'Cargando...' : 'Todas'}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Periodo</span>
                    <Select
                      value={formState.periodId}
                      onChange={(event) => handleFieldChange('periodId', event.target.value)}
                      options={catalogQuery.data?.periods ?? []}
                      placeholder={catalogQuery.isLoading ? 'Cargando...' : 'Todos'}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Cargo</span>
                    <Select
                      value={formState.positionId}
                      onChange={(event) => handleFieldChange('positionId', event.target.value)}
                      options={catalogQuery.data?.positions ?? []}
                      placeholder={catalogQuery.isLoading ? 'Cargando...' : 'Todos'}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Partido / libre postulación</span>
                    <Select
                      value={formState.partyId}
                      onChange={(event) => handleFieldChange('partyId', event.target.value)}
                      options={catalogQuery.data?.parties ?? []}
                      placeholder={catalogQuery.isLoading ? 'Cargando...' : 'Todos'}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Mes</span>
                    <Select
                      value={formState.month}
                      onChange={(event) => handleFieldChange('month', event.target.value)}
                      options={catalogQuery.data?.months ?? []}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Provincia</span>
                    <Select
                      value={formState.provinceId}
                      onChange={(event) => handleFieldChange('provinceId', event.target.value)}
                      options={catalogQuery.data?.provinces ?? []}
                      placeholder={catalogQuery.isLoading ? 'Cargando...' : 'Todas'}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Distrito</span>
                    <Select
                      value={formState.districtId}
                      onChange={(event) => handleFieldChange('districtId', event.target.value)}
                      options={catalogQuery.data?.districts ?? []}
                      placeholder={catalogQuery.isLoading ? 'Cargando...' : 'Todos'}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Corregimiento</span>
                    <Select
                      value={formState.townshipId}
                      onChange={(event) => handleFieldChange('townshipId', event.target.value)}
                      options={catalogQuery.data?.townships ?? []}
                      placeholder={catalogQuery.isLoading ? 'Cargando...' : 'Todos'}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Circuito</span>
                    <Select
                      value={formState.circuitId}
                      onChange={(event) => handleFieldChange('circuitId', event.target.value)}
                      options={catalogQuery.data?.circuits ?? []}
                      placeholder={catalogQuery.isLoading ? 'Cargando...' : 'Todos'}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Proclamado</span>
                    <Select
                      value={formState.isProclaimed}
                      onChange={(event) => handleFieldChange('isProclaimed', event.target.value)}
                      options={[
                        { label: 'Sí', value: 'true' },
                        { label: 'No', value: 'false' },
                      ]}
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Los catálogos se cargan desde los endpoints públicos del sitio real. Categoría
                    del evento y periodo vuelven a estar separados, como en la página original.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit">Aplicar filtros</Button>
                    <Button type="button" variant="outline" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </section>
      </div>

      <section className="space-y-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Resultados</h2>
            <p className="text-sm text-muted-foreground">
              {searchQuery.isLoading
                ? 'Cargando resultados...'
                : `${total.toLocaleString('es-PA')} documentos`}
            </p>
          </div>
          {searchQuery.data ? (
            <p className="text-sm text-muted-foreground">
              Página {search.page} de {pageCount}
            </p>
          ) : null}
        </div>

        {searchQuery.isError ? (
          <div className="panel p-4 text-sm text-destructive">
            No se pudieron cargar los resultados.
          </div>
        ) : null}

        {searchQuery.isLoading ? (
          <ResultsSkeleton />
        ) : searchQuery.data?.data.length ? (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Candidato</th>
                    <th>Cargo / partido</th>
                    <th>Evento</th>
                    <th>Ubicación</th>
                    <th>Mes</th>
                    <th>Estatus</th>
                    <th>Archivos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {searchQuery.data.data.map((item) => {
                    const name = fullName(item.Candidate) || 'Sin nombre';
                    const event = eventLabel(item);
                    const pdf = item.AffidavitDocument?.find(
                      (document) => document.mimeType === 'application/pdf',
                    );
                    const hasJson = detailMap.get(item.id) ?? false;

                    return (
                      <tr key={item.id}>
                        <td className="min-w-56">
                          <div className="space-y-1">
                            <Link
                              to="/informe/$affidavitId"
                              params={{ affidavitId: item.id }}
                              search={serializeSearch(search)}
                              className="font-medium hover:underline"
                            >
                              {name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              Cédula: {item.Candidate?.documentId || 'Sin cédula'}
                            </p>
                          </div>
                        </td>
                        <td className="min-w-48">
                          <div className="space-y-1">
                            <p>{event.position}</p>
                            <p className="text-xs text-muted-foreground">{event.party}</p>
                          </div>
                        </td>
                        <td className="min-w-56">
                          <div className="space-y-1">
                            <p>{event.category}</p>
                            <p className="text-xs text-muted-foreground">
                              {event.period || 'Sin periodo'}
                            </p>
                          </div>
                        </td>
                        <td className="min-w-44 text-muted-foreground">
                          {locationLabel(item) || 'Sin ubicación'}
                        </td>
                        <td>{monthLabel(item.month, item.isSummary)}</td>
                        <td>
                          <div className="space-y-1">
                            <Badge variant="outline">
                              {STATUS_LABELS[item.status] ?? item.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {item.isProclaimed ? 'Proclamado' : 'No proclamado'}
                            </p>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {pdf ? <Badge variant="accent">PDF</Badge> : null}
                            {hasJson ? <Badge variant="secondary">JSON</Badge> : null}
                            {!pdf && !hasJson ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            {pdf ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(item)}
                                disabled={downloadId === item.id}
                              >
                                <Download className="size-4" />
                                {downloadId === item.id ? 'Bajando...' : 'PDF'}
                              </Button>
                            ) : null}
                            <Button asChild size="sm">
                              <Link
                                to="/informe/$affidavitId"
                                params={{ affidavitId: item.id }}
                                search={serializeSearch(search)}
                              >
                                Ver
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="panel p-6 text-sm text-muted-foreground">
            No hay documentos para los filtros actuales.
          </div>
        )}

        {searchQuery.data && pageCount > 1 ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updatePage(search.page - 1)}
              disabled={search.page === 1}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            {pageNumbers.map((page) => (
              <Button
                key={page}
                type="button"
                variant={page === search.page ? 'default' : 'outline'}
                size="sm"
                onClick={() => updatePage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updatePage(search.page + 1)}
              disabled={search.page === pageCount}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
