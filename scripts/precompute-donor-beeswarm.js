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

function normalizeContributorDocument(value) {
  const text = TEXT(value);
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ÃÂ]/g, '')
    .toUpperCase();
  const compact = normalized.replace(/\bDV\b/g, '').replace(/[^A-Z0-9]+/g, '');
  const digitsOnly = compact.replace(/[^0-9]+/g, '');
  const isValid =
    compact &&
    !/^0+$/.test(compact) &&
    /\d/.test(compact) &&
    digitsOnly.length >= 3 &&
    compact.length >= 5 &&
    !['ANULADO', 'NULL', 'NULO', 'NONE', 'NA', 'N A', 'SN', 'S N'].includes(compact);

  return isValid ? compact : '';
}

function contributorKeyFromRow(row) {
  const documentId = normalizeContributorDocument(row?.cedulaRuc);
  if (documentId) return `doc:${documentId}`;
  const contributorName = NORM(row?.contribuyenteNombre);
  return contributorName ? `name:${contributorName}` : '';
}

function contributorIdFromRow(row) {
  const key = contributorKeyFromRow(row);
  return key ? slugify(key) : '';
}

function incrementCount(map, key) {
  const value = TEXT(key);
  if (!value) return;
  map.set(value, (map.get(value) || 0) + 1);
}

function modeFromCounts(map, fallback = '') {
  let bestValue = fallback;
  let bestCount = -1;

  for (const [value, count] of map) {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  }

  return bestValue;
}

function buildDonorRows(ingresos) {
  const donorBuckets = new Map();

  for (const row of ingresos) {
    const donorId = contributorIdFromRow(row);
    if (!donorId) continue;
    const bucket = donorBuckets.get(donorId) || { ingresos: [], nameCounts: new Map() };
    bucket.ingresos.push(row);
    incrementCount(bucket.nameCounts, TEXT(row.contribuyenteNombre) || TEXT(row.cedulaRuc));
    donorBuckets.set(donorId, bucket);
  }

  return [...donorBuckets]
    .flatMap(([id, bucket]) => {
      const name = modeFromCounts(bucket.nameCounts, id) || id;

      return d3
        .rollups(
          bucket.ingresos,
          (values) => {
            const position = TEXT(values[0]?.candidatePosition) || 'Sin cargo';
            const partyCounts = new Map();

            for (const row of values) {
              incrementCount(partyCounts, row.candidateParty);
            }

            const total = d3.sum(values, (row) => num(row.total));

            return {
              id,
              name,
              parties: uniq(values.map((row) => row.candidateParty)),
              positions: position ? [position] : [],
              total,
              ingresoTotal: total,
              position,
              party: modeFromCounts(partyCounts, null) || 'Sin partido',
            };
          },
          (row) => TEXT(row.candidatePosition) || 'Sin cargo',
        )
        .map(([, value]) => value);
    })
    .sort((a, b) => d3.descending(a.ingresoTotal, b.ingresoTotal) || d3.ascending(a.name, b.name));
}

function roundPosition(value) {
  return Math.round(value * 1000) / 1000;
}

const ingresos = d3.csvParse(await readFile(ingresosPath, 'utf8'));
const donorRows = buildDonorRows(ingresos);
const layoutsByPosition = Object.fromEntries(
  POS.map((position) => {
    const rows = donorRows.filter((row) => row.position === position);
    const positionsById = rows.length
      ? Object.fromEntries(
          computeBeeSwarmLayout(rows, getBeeswarmLayoutOptions('aportante')).nodes.map((node) => [
            node.id,
            {
              x: roundPosition(node.x),
              y: roundPosition(node.y),
            },
          ]),
        )
      : {};

    return [
      position,
      {
        count: rows.length,
        signature: createDonorBeeswarmSignature(rows),
        positionsById,
      },
    ];
  }),
);

const output = {
  version: DONOR_BEESWARM_PRECOMPUTE_VERSION,
  count: donorRows.length,
  layoutsByPosition,
};

await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${output.count} donor positions to ${path.relative(repoRoot, outputPath)}`);
