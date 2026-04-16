import { PDFDocument } from 'pdf-lib';
import pLimit from 'p-limit';

import {
  callGeminiCsvExtraction,
  getModel,
  renderPageAsPng,
  type EgresoRow,
  type IngresoRow,
  type ModelKey,
} from '../pdf-extraction';
import { MODELS } from '../models';

type StoredIngressRow = IngresoRow & { pageNumber: number };
type StoredEgressRow = EgresoRow & { pageNumber: number };

type DocumentRecord = {
  _id: string;
  name: string;
  pageCount: number;
  fileUrl?: string | null;
  pageRotations?: Record<string, number>;
};

const PAGE_CONCURRENCY = 20;
const PAGE_RETRIES = 2;
const RETRY_DELAY_MS = 2_000;
const PAGE_TIMEOUT_MS = 5 * 60_000;
const CONVEX_BIN = './node_modules/.bin/convex';
const CONVEX_TARGET_ARGS = ['--prod'];

const LOCAL_IDENTITY = JSON.stringify({
  tokenIdentifier: 'local-extraction-script',
  subject: 'local-extraction-script',
  name: 'Local Extraction Script',
});

type CliOptions = {
  documentIds: string[];
  model?: ModelKey;
  processing: boolean;
  help: boolean;
};

function getUsage(): string {
  return [
    'Usage: bun run scripts/run-local-extraction.ts [documentId ...] [--model <model>]',
    '       bun run scripts/run-local-extraction.ts --processing [--model <model>]',
    '',
    'Options:',
    '  --processing   Process every document currently in Convex with status "processing".',
    `  --model        Override the extraction model. One of: ${Object.keys(MODELS).join(', ')}`,
    '  --help         Show this help message.',
  ].join('\n');
}

function parseCli(argv: string[]): CliOptions {
  const documentIds: string[] = [];
  let model: ModelKey | undefined;
  let processing = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help') {
      help = true;
      continue;
    }

    if (arg === '--processing') {
      processing = true;
      continue;
    }

    if (arg === '--model') {
      const value = argv[++i] as ModelKey | undefined;
      if (!value || !(value in MODELS)) {
        throw new Error(`--model must be one of: ${Object.keys(MODELS).join(', ')}`);
      }
      model = value;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    documentIds.push(arg);
  }

  if (processing && documentIds.length > 0) {
    throw new Error('Pass document IDs or --processing, not both.');
  }

  return { documentIds, model, processing, help };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCommand(cmd: string[]): Promise<string> {
  const proc = Bun.spawn({
    cmd,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'ignore',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${cmd.join(' ')}\n${stderr || stdout}`.trim());
  }

  return stdout.trim();
}

function parseJsonFromCommandOutput<T>(stdout: string): T {
  const trimmed = stdout.trim();

  if (!trimmed) {
    return null as T;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const candidateStarts = new Set<number>([0]);
    const marker = /(^|\n)(\{|\[|"|null|-?\d)/g;

    for (const match of trimmed.matchAll(marker)) {
      candidateStarts.add(match.index! + match[1].length);
    }

    for (const start of [...candidateStarts].sort((a, b) => b - a)) {
      try {
        return JSON.parse(trimmed.slice(start)) as T;
      } catch {
        // Try the next candidate.
      }
    }
  }

  throw new Error(`Could not parse JSON from command output:\n${trimmed}`);
}

async function runConvexJson<T>(
  functionName: string,
  args: Record<string, unknown>,
  options?: { identity?: boolean },
): Promise<T> {
  const cmd = [CONVEX_BIN, 'run', ...CONVEX_TARGET_ARGS, '--typecheck', 'disable', '--codegen', 'disable'];

  if (options?.identity) {
    cmd.push('--identity', LOCAL_IDENTITY);
  }

  cmd.push(functionName, JSON.stringify(args));

  const stdout = await runCommand(cmd);
  return parseJsonFromCommandOutput<T>(stdout);
}

async function runConvexVoid(
  functionName: string,
  args: Record<string, unknown>,
  options?: { identity?: boolean },
): Promise<void> {
  await runConvexJson<null>(functionName, args, options);
}

async function listProcessingDocumentIds(): Promise<string[]> {
  const stdout = await runCommand([
    CONVEX_BIN,
    'data',
    ...CONVEX_TARGET_ARGS,
    '--format',
    'jsonArray',
    '--limit',
    '10000',
    'documents',
  ]);

  const documents = JSON.parse(stdout) as Array<{
    _id: string;
    name: string;
    status?: string;
    structuredNotes?: {
      flags?: {
        archived?: boolean;
      };
    };
  }>;
  const processing = documents.filter(
    (doc) => doc.status === 'processing' && !doc.structuredNotes?.flags?.archived,
  );
  const archivedProcessing = documents.filter(
    (doc) => doc.status === 'processing' && doc.structuredNotes?.flags?.archived,
  );

  if (processing.length > 0) {
    console.log('Documents currently in processing:');
    for (const doc of processing) {
      console.log(`- ${doc._id}  ${doc.name}`);
    }
  }

  if (archivedProcessing.length > 0) {
    console.log('Skipping archived documents currently in processing:');
    for (const doc of archivedProcessing) {
      console.log(`- ${doc._id}  ${doc.name}`);
    }
  }

  return processing.map((doc) => doc._id);
}

async function getDocument(documentId: string): Promise<DocumentRecord | null> {
  return await runConvexJson<DocumentRecord | null>('documents:getDocument', { documentId }, { identity: true });
}

async function getConfiguredModelKey(cliModel?: ModelKey): Promise<ModelKey> {
  if (cliModel) {
    return cliModel;
  }

  const modelKey = await runConvexJson<string>('featureFlags:getExtractionModelInternal', {});
  if (!(modelKey in MODELS)) {
    throw new Error(`Convex feature flag returned unsupported model: ${modelKey}`);
  }

  return modelKey as ModelKey;
}

async function updateDocumentStatus(
  documentId: string,
  status: 'processing' | 'completed' | 'failed',
  errorMessage?: string,
): Promise<void> {
  await runConvexVoid('extractionHelpers:updateDocumentStatus', {
    documentId,
    status,
    ...(errorMessage ? { errorMessage } : {}),
  });
}

async function storeExtraction(
  documentId: string,
  model: string,
  ingress: StoredIngressRow[],
  egress: StoredEgressRow[],
): Promise<void> {
  await runConvexVoid('extractionHelpers:storeExtraction', {
    documentId,
    model,
    ingress,
    egress,
  });
}

async function runSummaryExtraction(documentId: string): Promise<void> {
  await runConvexVoid('summaryExtraction:startSummaryExtraction', { documentId });
}

async function extractPageWithRetries(
  doc: DocumentRecord,
  pdfBytes: Uint8Array,
  pageNumber: number,
  totalPages: number,
  modelId: string,
): Promise<{ pageNumber: number; ingress: StoredIngressRow[]; egress: StoredEgressRow[] }> {
  const rotation = doc.pageRotations?.[String(pageNumber)] ?? 0;
  const maxAttempts = PAGE_RETRIES + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[${doc._id}] Page ${pageNumber}/${totalPages} (attempt ${attempt}/${maxAttempts})...`);

      const pngBytes = renderPageAsPng(pdfBytes, pageNumber, { rotation });
      const pngBase64 = Buffer.from(pngBytes).toString('base64');

      const { parsed } = await callGeminiCsvExtraction(pngBase64, process.env.GEMINI_API_KEY!, {
        modelId,
        mimeType: 'image/png',
        timeoutMs: PAGE_TIMEOUT_MS,
      });

      console.log(
        `[${doc._id}] Page ${pageNumber}/${totalPages} done: ${parsed.ingress.length} ingress, ${parsed.egress.length} egress`,
      );

      return {
        pageNumber,
        ingress: parsed.ingress.map((row) => ({ ...row, pageNumber })),
        egress: parsed.egress.map((row) => ({ ...row, pageNumber })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= maxAttempts) {
        throw new Error(`Page ${pageNumber} failed after ${maxAttempts} attempts: ${message}`);
      }
      console.warn(`[${doc._id}] Page ${pageNumber} failed: ${message}`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw new Error(`Unreachable retry state for page ${pageNumber}`);
}

async function processDocument(documentId: string, modelKey: ModelKey): Promise<void> {
  const model = getModel(modelKey);
  const doc = await getDocument(documentId);

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }
  if (!doc.fileUrl) {
    throw new Error(`Document ${documentId} has no file URL`);
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  console.log(`\n=== Processing ${doc._id} ===`);
  console.log(doc.name);
  console.log(`Model: ${model.id}`);

  await updateDocumentStatus(documentId, 'processing');

  const response = await fetch(doc.fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF from Convex storage: ${response.status} ${response.statusText}`);
  }

  const pdfBytes = new Uint8Array(await response.arrayBuffer());
  const pageCount = (await PDFDocument.load(pdfBytes)).getPageCount();

  console.log(`[${doc._id}] PDF has ${pageCount} pages.`);

  const limit = pLimit(PAGE_CONCURRENCY);
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  const settledResults = await Promise.allSettled(
    pageNumbers.map((pageNumber) => limit(() => extractPageWithRetries(doc, pdfBytes, pageNumber, pageCount, model.geminiId))),
  );

  const failures = settledResults
    .map((result, index) => ({ result, pageNumber: pageNumbers[index] }))
    .filter((entry): entry is { result: PromiseRejectedResult; pageNumber: number } => entry.result.status === 'rejected');

  if (failures.length > 0) {
    const message = failures.map((failure) => `page ${failure.pageNumber}: ${failure.result.reason}`).join('; ');
    throw new Error(`Extraction failed for ${failures.length} page(s): ${message}`);
  }

  const pageResults = settledResults
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter((result): result is Awaited<ReturnType<typeof extractPageWithRetries>> => result !== null)
    .sort((a, b) => a.pageNumber - b.pageNumber);

  const ingress = pageResults.flatMap((page) => page.ingress);
  const egress = pageResults.flatMap((page) => page.egress);

  await storeExtraction(documentId, model.id, ingress, egress);
  await updateDocumentStatus(documentId, 'completed');

  console.log(`[${doc._id}] Stored extraction: ${ingress.length} ingress, ${egress.length} egress`);
  console.log(`[${doc._id}] Running summary extraction...`);
  await runSummaryExtraction(documentId);
  console.log(`[${doc._id}] Done.`);
}

async function main(): Promise<void> {
  const { documentIds: cliDocumentIds, model, processing, help } = parseCli(Bun.argv.slice(2));

  if (help) {
    console.log(getUsage());
    return;
  }

  if (!processing && cliDocumentIds.length === 0) {
    throw new Error(`No target specified.\n\n${getUsage()}`);
  }

  const modelKey = await getConfiguredModelKey(model);

  console.log('Targeting Convex production deployment.');

  const documentIds = processing ? await listProcessingDocumentIds() : cliDocumentIds;

  if (documentIds.length === 0) {
    console.log('No documents to process.');
    return;
  }

  const failures: Array<{ documentId: string; error: string }> = [];

  for (const documentId of documentIds) {
    try {
      await processDocument(documentId, modelKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ documentId, error: message });
      console.error(`\n[${documentId}] Failed: ${message}`);
      try {
        await updateDocumentStatus(documentId, 'failed', message);
      } catch (statusError) {
        const statusMessage = statusError instanceof Error ? statusError.message : String(statusError);
        console.error(`[${documentId}] Also failed to update status in Convex: ${statusMessage}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('\nCompleted with failures:');
    for (const failure of failures) {
      console.error(`- ${failure.documentId}: ${failure.error}`);
    }
    process.exit(1);
  }

  console.log('\nAll requested documents completed successfully.');
}

await main();
