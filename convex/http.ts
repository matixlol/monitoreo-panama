import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { api } from './_generated/api.js';
import { auth } from './auth';
import { createEgressCsvStream, createIngressCsvStream, type CsvExportDocument } from '../src/lib/csvExport';

const http = httpRouter();

auth.addHttpRoutes(http);

const CSV_HEADERS = {
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=300',
  'content-type': 'text/csv; charset=utf-8',
};

http.route({
  path: '/csv/documentos-ingresos.csv',
  method: 'GET',
  handler: httpAction(async (ctx) => {
    const exportData = (await ctx.runQuery(
      (api as any).documents.getCsvExportPayloadPublic,
      {},
    )) as CsvExportDocument[];
    return new Response(createIngressCsvStream(exportData), { headers: CSV_HEADERS });
  }),
});

http.route({
  path: '/csv/documentos-egresos.csv',
  method: 'GET',
  handler: httpAction(async (ctx) => {
    const exportData = (await ctx.runQuery(
      (api as any).documents.getCsvExportPayloadPublic,
      {},
    )) as CsvExportDocument[];
    return new Response(createEgressCsvStream(exportData), { headers: CSV_HEADERS });
  }),
});

export default http;
