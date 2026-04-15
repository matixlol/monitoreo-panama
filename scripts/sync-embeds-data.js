import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const targetDir = path.join(repoRoot, 'embeds/data');

function getBaseUrl() {
  const arg = process.argv.find((value) => value.startsWith('--base-url='));
  const raw =
    (arg ? arg.slice('--base-url='.length) : null) ??
    process.env.CSV_EXPORT_BASE_URL ??
    process.env.VITE_CONVEX_URL ??
    process.env.CONVEX_SITE_URL;

  if (!raw) {
    throw new Error('Missing base URL. Set CSV_EXPORT_BASE_URL, VITE_CONVEX_URL, CONVEX_SITE_URL, or pass --base-url=');
  }

  return raw.replace(/\/+$/, '');
}

async function downloadCsv(baseUrl, fileName) {
  const url = `${baseUrl}/csv/${fileName}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const outputPath = path.join(targetDir, fileName);
  await writeFile(outputPath, bytes);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}

await mkdir(targetDir, { recursive: true });

const baseUrl = getBaseUrl();
await downloadCsv(baseUrl, 'documentos-ingresos.csv');
await downloadCsv(baseUrl, 'documentos-egresos.csv');
