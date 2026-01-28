import { readFile } from 'fs/promises';
import {
  extractSinglePage,
  callGeminiDirect,
  EXTRACTION_PROMPT,
  ResponseSchema,
  RESPONSE_JSON_SCHEMA,
  MODEL,
} from '../pdf-extraction';

const [pdfPath, pageNumberStr] = Bun.argv.slice(2);

if (!pdfPath || !pageNumberStr) {
  console.error('Usage: bun scripts/test-extraction.ts <pdf-path> <page-number>');
  process.exit(1);
}

const pageNumber = parseInt(pageNumberStr, 10);
const pdfBytes = await readFile(pdfPath);
const pageBytes = await extractSinglePage(pdfBytes.buffer, pageNumber);
const pdfBase64 = Buffer.from(pageBytes).toString('base64');

console.log(`[${MODEL.id}] Extracting page ${pageNumber} from ${pdfPath}...`);

const { parsed } = await callGeminiDirect(pdfBase64, process.env.GEMINI_API_KEY!, {
  prompt: EXTRACTION_PROMPT,
  schema: ResponseSchema,
  jsonSchema: RESPONSE_JSON_SCHEMA,
  mediaResolution: 'MEDIA_RESOLUTION_HIGH',
});

console.log(`[${MODEL.id}] Result: ${parsed.ingress.length} ingress, ${parsed.egress.length} egress`);
console.log(JSON.stringify(parsed, null, 2));
