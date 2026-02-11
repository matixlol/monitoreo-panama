import { readFile, writeFile } from 'fs/promises';
import {
  callGeminiCsvExtraction,
  getModel,
  renderPageAsPng,
} from '../pdf-extraction';

const [pdfPath, pageNumberStr] = Bun.argv.slice(2);

if (!pdfPath || !pageNumberStr) {
  console.error('Usage: bun scripts/test-extraction.ts <pdf-path> <page-number>');
  process.exit(1);
}

const model = getModel();
const pageNumber = parseInt(pageNumberStr, 10);
const pdfBytes = await readFile(pdfPath);
const pngBytes = renderPageAsPng(pdfBytes, pageNumber);
await writeFile(`tmp/test-extraction-page-${pageNumber}-${process.pid}.png`, pngBytes);
const pngBase64 = Buffer.from(pngBytes).toString('base64');

console.log(`[${model.id}] Extracting page ${pageNumber} from ${pdfPath}...`);

const { parsed } = await callGeminiCsvExtraction(pngBase64, process.env.GEMINI_API_KEY!, {
  mimeType: 'image/png',
  mediaResolution: 'MEDIA_RESOLUTION_ULTRA_HIGH',
});

console.log(`[${model.id}] Result: ${parsed.ingress.length} ingress, ${parsed.egress.length} egress`);
console.log(JSON.stringify(parsed, null, 2));
