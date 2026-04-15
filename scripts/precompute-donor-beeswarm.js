import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as d3 from 'd3';
import { getBeeswarmLayoutOptions } from '../embeds/charts/beeswarm-layout-config.js';
import { createDonorBeeswarmSignature, DONOR_BEESWARM_PRECOMPUTE_VERSION } from '../embeds/charts/beeswarm-precomputed.js';
import { computeBeeSwarmLayout } from '../embeds/charts/easy-beeswarm.observable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const ingresosPath = path.join(repoRoot, 'embeds/data/documentos-ingresos.csv');
const outputPath = path.join(repoRoot, 'embeds/data/donor-beeswarm.json');

const POS = ['Presidente', 'Diputado(a)', 'Alcalde'];

const TEXT = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : `${value}`.trim());
const NORM = (value) =>
  TEXT(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ÃÂ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const slugify = (value) => NORM(value).replace(/ /g, '-').slice(0, 120);
const uniq = (values) => [...new Map(values.map((value) => [NORM(value), TEXT(value)]).filter(([key]) => key)).values()];
const sortPos = (a, b) => (POS.indexOf(a) + 1 || 99) - (POS.indexOf(b) + 1 || 99) || d3.ascending(a, b);
const num = (value) => {
  const n = Number(TEXT(value).replace(/\s+/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function buildDonorRows(ingresos) {
  const donorBuckets = new Map();

  for (const row of ingresos) {
    const donorId = slugify(row.contribuyenteNombre);
    if (!donorId) continue;
    const bucket = donorBuckets.get(donorId) || { ingresos: [] };
    bucket.ingresos.push(row);
    donorBuckets.set(donorId, bucket);
  }

  const donors = [...donorBuckets]
    .map(([id, bucket]) => ({
      id,
      name: d3.mode(bucket.ingresos.map((row) => TEXT(row.contribuyenteNombre)).filter(Boolean)) || id,
      parties: uniq(bucket.ingresos.map((row) => row.candidateParty)),
      positions: uniq(bucket.ingresos.map((row) => row.candidatePosition)).sort(sortPos),
      total: d3.sum(bucket.ingresos, (row) => num(row.total)),
    }))
    .sort((a, b) => d3.descending(a.total, b.total));

  return donors.map((donor) => ({
    ...donor,
    ingresoTotal: donor.total,
    position: donor.positions[0] || 'Sin cargo',
    party: donor.parties[0] || 'Sin partido',
  }));
}

function roundPosition(value) {
  return Math.round(value * 1000) / 1000;
}

const ingresos = d3.csvParse(await readFile(ingresosPath, 'utf8'));
const donorRows = buildDonorRows(ingresos);
const layout = computeBeeSwarmLayout(donorRows, getBeeswarmLayoutOptions('aportante'));

const positionsById = Object.fromEntries(
  layout.nodes.map((node) => [
    node.id,
    {
      x: roundPosition(node.x),
      y: roundPosition(node.y),
    },
  ]),
);

const output = {
  version: DONOR_BEESWARM_PRECOMPUTE_VERSION,
  count: donorRows.length,
  signature: createDonorBeeswarmSignature(donorRows),
  positionsById,
};

await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${output.count} donor positions to ${path.relative(repoRoot, outputPath)}`);
