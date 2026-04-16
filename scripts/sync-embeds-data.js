import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const targetDir = path.join(repoRoot, 'embeds/data');
const baseUrl = 'https://shiny-lynx-407.convex.site';

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
await downloadCsv(baseUrl, 'documentos-ingresos.csv');
await downloadCsv(baseUrl, 'documentos-egresos.csv');
