import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { ArrowLeft, Download, FileText, Landmark, Wallet } from 'lucide-react';
import { downloadPdf, getAffidavitDetail, getAffidavitRows } from '../lib/api';
import {
  currency,
  eventLabel,
  formatScalar,
  fullName,
  locationLabel,
  pickPdfName,
  STATUS_LABELS,
} from '../lib/format';
import { parseSearch, serializeSearch } from '../lib/search';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const COLUMN_PRIORITY = [
  'date',
  'registrationDate',
  'name',
  'fullName',
  'documentId',
  'description',
  'concept',
  'type',
  'amount',
  'total',
];

function getColumns(rows: Record<string, unknown>[]) {
  const keys = new Set<string>();

  for (const row of rows) {
    Object.entries(row).forEach(([key, value]) => {
      if (value !== null && typeof value !== 'object') keys.add(key);
    });
  }

  const rest = [...keys].filter((key) => !COLUMN_PRIORITY.includes(key)).sort((left, right) =>
    left.localeCompare(right, 'es'),
  );

  return [...COLUMN_PRIORITY.filter((key) => keys.has(key)), ...rest];
}

function RecordsTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <div className="panel p-6 text-sm text-muted-foreground">No hay registros.</div>;
  }

  const columns = getColumns(rows);

  return (
    <div className="panel overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{formatScalar(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DetailPage() {
  const { affidavitId } = useParams({ strict: false }) as { affidavitId: string };
  const search = useSearch({
    strict: false,
    select: (value) => parseSearch(value as Record<string, unknown>),
  });
  const [activeTab, setActiveTab] = React.useState('pdf');
  const [activePdf, setActivePdf] = React.useState('');
  const [isDownloading, setIsDownloading] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: ['affidavit-detail', affidavitId],
    queryFn: () => getAffidavitDetail(affidavitId),
  });

  const ingressQuery = useQuery({
    queryKey: ['affidavit-ingress', affidavitId],
    queryFn: () => getAffidavitRows(affidavitId, 'ingress'),
  });

  const egressQuery = useQuery({
    queryKey: ['affidavit-egress', affidavitId],
    queryFn: () => getAffidavitRows(affidavitId, 'egress'),
  });

  React.useEffect(() => {
    const firstPdf = detailQuery.data?.AffidavitDocument?.find(
      (document) => document.mimeType === 'application/pdf',
    );
    if (firstPdf && !activePdf) {
      setActivePdf(firstPdf.url);
    }
  }, [activePdf, detailQuery.data?.AffidavitDocument]);

  const handleDownload = async () => {
    if (!activePdf) return;
    setIsDownloading(true);
    try {
      await downloadPdf(activePdf, pickPdfName(activePdf));
    } finally {
      setIsDownloading(false);
    }
  };

  if (detailQuery.isLoading) {
    return (
      <div className="page-shell">
        <div className="panel h-80 animate-pulse bg-secondary/50" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="page-shell">
        <div className="panel p-6 text-sm text-destructive">No se pudo cargar el detalle.</div>
      </div>
    );
  }

  const detail = detailQuery.data;
  const event = eventLabel(detail);
  const pdfDocuments =
    detail.AffidavitDocument?.filter((document) => document.mimeType === 'application/pdf') ?? [];

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/" search={serializeSearch(search)}>
              <ArrowLeft className="size-4" />
              Volver a resultados
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{fullName(detail.Candidate) || 'Sin nombre'}</h1>
            <p className="text-sm text-muted-foreground">
              Cédula: {detail.Candidate?.documentId || 'Sin cédula'}
            </p>
          </div>
        </div>
        {pdfDocuments.length ? (
          <Button type="button" onClick={handleDownload} disabled={isDownloading}>
            <Download className="size-4" />
            {isDownloading ? 'Descargando...' : 'Descargar PDF'}
          </Button>
        ) : null}
      </div>

      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{STATUS_LABELS[detail.status] ?? detail.status}</Badge>
          {pdfDocuments.length ? <Badge variant="accent">PDF</Badge> : null}
          {detail.totalIngress > 0 || detail.totalEgress > 0 ? (
            <Badge variant="secondary">JSON</Badge>
          ) : null}
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Categoría del evento</dt>
            <dd className="mt-1">{event.category}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Periodo</dt>
            <dd className="mt-1">{event.period || 'Sin periodo'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cargo</dt>
            <dd className="mt-1">{event.position}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Partido</dt>
            <dd className="mt-1">{event.party}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ubicación</dt>
            <dd className="mt-1">{locationLabel(detail) || 'Sin ubicación'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Proclamado</dt>
            <dd className="mt-1">{detail.isProclaimed ? 'Sí' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total ingresos</dt>
            <dd className="mt-1">{currency(detail.totalIngress)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total gastos</dt>
            <dd className="mt-1">{currency(detail.totalEgress)}</dd>
          </div>
        </dl>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pdf">
            <FileText className="mr-1 inline size-4" />
            PDF
          </TabsTrigger>
          <TabsTrigger value="ingresos">
            <Landmark className="mr-1 inline size-4" />
            Ingresos
          </TabsTrigger>
          <TabsTrigger value="gastos">
            <Wallet className="mr-1 inline size-4" />
            Gastos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pdf">
          {pdfDocuments.length ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {pdfDocuments.map((document) => (
                  <Button
                    key={document.id}
                    type="button"
                    variant={activePdf === document.url ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActivePdf(document.url)}
                  >
                    {pickPdfName(document.url)}
                  </Button>
                ))}
              </div>
              <div className="panel overflow-hidden">
                <iframe src={activePdf} title="PDF del informe" className="h-[70vh] w-full" />
              </div>
            </div>
          ) : (
            <div className="panel p-6 text-sm text-muted-foreground">No hay PDF disponible.</div>
          )}
        </TabsContent>

        <TabsContent value="ingresos">
          {ingressQuery.isLoading ? (
            <div className="panel h-64 animate-pulse bg-secondary/50" />
          ) : ingressQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              No se pudieron cargar los ingresos.
            </div>
          ) : (
            <RecordsTable rows={ingressQuery.data ?? []} />
          )}
        </TabsContent>

        <TabsContent value="gastos">
          {egressQuery.isLoading ? (
            <div className="panel h-64 animate-pulse bg-secondary/50" />
          ) : egressQuery.isError ? (
            <div className="panel p-6 text-sm text-destructive">
              No se pudieron cargar los gastos.
            </div>
          ) : (
            <RecordsTable rows={egressQuery.data ?? []} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
