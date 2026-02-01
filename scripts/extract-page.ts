import { readFile, writeFile } from 'fs/promises';
import { extractSinglePage } from '../pdf-extraction';

const [pdfPath, pageStr, outPath] = Bun.argv.slice(2);
if (!pdfPath || !pageStr || !outPath) {
  console.error('Usage: bun scripts/extract-page.ts <pdf-path> <page-number> <out-path>');
  process.exit(1);
}

const pageNumber = parseInt(pageStr, 10);
const pdfBytes = await readFile(pdfPath);
const pageBytes = await extractSinglePage(pdfBytes.buffer, pageNumber);
await writeFile(outPath, pageBytes);
console.log(`Saved page ${pageNumber} to ${outPath}`);
