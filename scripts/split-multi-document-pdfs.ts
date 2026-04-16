#!/usr/bin/env bun

import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';

const execFileAsync = promisify(execFile);

type Args = {
  inputPaths: string[];
  dryRun: boolean;
  verbose: boolean;
  dpi: number;
  outputDir?: string;
};

type PageType =
  | 'receipt'
  | 'transaction'
  | 'summary'
  | 'declaration'
  | 'data'
  | 'cover-letter'
  | 'other';

type PageAnalysis = {
  pageNumber: number;
  pageType: PageType;
  rotation: 0 | 90 | 180 | 270;
  snippet: string;
  normalizedText: string;
  receiptHits: string[];
  transactionHits: string[];
  summaryHits: string[];
};

type Segment = {
  startPage: number;
  endPage: number;
  transactionEndPage: number | null;
  nextReceiptPage: number | null;
};

const RECEIPT_MARKERS = [
  'recepcion de documentos presentados',
  'formulario pre 8 2',
  'formulario pre 8 3',
];

const TRANSACTION_MARKERS = ['informe de ingresos', 'informe de gastos'];

const SUMMARY_MARKERS = [
  'resumen de ingresos y gastos',
  'sumatoria de informe de ingresos',
  'sumatoria de informe de gastos',
];

function printUsage() {
  console.error(`Usage:
  bun run scripts/split-multi-document-pdfs.ts [options] <pdf...>

Options:
  --dry-run            Only print the detected splits
  --verbose            Print page-level OCR classifications
  --dpi <n>            OCR render DPI (default: 150)
  --output-dir <dir>   Directory where split PDFs will be written
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    inputPaths: [],
    dryRun: false,
    verbose: false,
    dpi: 150,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg === '--verbose') {
      args.verbose = true;
      continue;
    }

    if (arg === '--dpi') {
      const value = argv[++i];
      if (!value || !/^\d+$/.test(value)) {
        throw new Error('--dpi requires a numeric value');
      }
      args.dpi = Number(value);
      continue;
    }

    if (arg === '--output-dir') {
      const value = argv[++i];
      if (!value) {
        throw new Error('--output-dir requires a directory path');
      }
      args.outputDir = resolve(value);
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    args.inputPaths.push(resolve(arg));
  }

  if (args.inputPaths.length === 0) {
    throw new Error('At least one PDF path is required');
  }

  return args;
}

async function assertCommandAvailable(command: string) {
  try {
    await execFileAsync('which', [command]);
  } catch {
    throw new Error(`Required command not found in PATH: ${command}`);
  }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesMarkers(text: string, markers: string[]) {
  return markers.filter((marker) => text.includes(marker));
}

function getPageType(normalizedText: string): Omit<PageAnalysis, 'pageNumber' | 'rotation' | 'snippet'> {
  const receiptHits = matchesMarkers(normalizedText, RECEIPT_MARKERS);
  const summaryHits = matchesMarkers(normalizedText, SUMMARY_MARKERS);
  const transactionHits = matchesMarkers(normalizedText, TRANSACTION_MARKERS);

  const isReceipt = receiptHits.length > 0;
  const isSummary = summaryHits.length > 0;
  const isDeclaration = normalizedText.includes('declaracion jurada');
  const isCoverLetter = normalizedText.includes('formulario pre 32');
  const isData =
    normalizedText.includes('datos generales del la precandidat') ||
    normalizedText.includes('datos generales de la nomina') ||
    normalizedText.includes('formulario pre 4') ||
    normalizedText.includes('formulario pre 12');
  const hasTransactionFormNumber =
    /\bformulario pre 17\b/.test(normalizedText) ||
    /\bformulario pre 18\b/.test(normalizedText) ||
    /\bformulario pre 7\b/.test(normalizedText) ||
    (/\bformulario pre 8\b/.test(normalizedText) && !/\bformulario pre 8 [23]\b/.test(normalizedText));
  const isTransaction =
    (transactionHits.length > 0 || hasTransactionFormNumber) &&
    !isDeclaration &&
    !isSummary &&
    !normalizedText.includes('declaracion jurada de informe de ingresos y gastos');

  let pageType: PageType = 'other';
  if (isReceipt) pageType = 'receipt';
  else if (isTransaction) pageType = 'transaction';
  else if (isSummary) pageType = 'summary';
  else if (isDeclaration) pageType = 'declaration';
  else if (isData) pageType = 'data';
  else if (isCoverLetter) pageType = 'cover-letter';

  return {
    pageType,
    normalizedText,
    receiptHits,
    transactionHits,
    summaryHits,
  };
}

function scorePageAnalysis(analysis: Omit<PageAnalysis, 'pageNumber' | 'rotation' | 'snippet'>) {
  const markerScore =
    analysis.receiptHits.length * 100 + analysis.transactionHits.length * 80 + analysis.summaryHits.length * 60;

  let typeBonus = 0;
  if (analysis.pageType === 'receipt') typeBonus = 50;
  else if (analysis.pageType === 'transaction') typeBonus = 40;
  else if (analysis.pageType === 'summary') typeBonus = 30;
  else if (analysis.pageType === 'declaration') typeBonus = 20;
  else if (analysis.pageType === 'data' || analysis.pageType === 'cover-letter') typeBonus = 10;

  return markerScore + typeBonus + Math.min(analysis.normalizedText.length, 400) / 20;
}

async function runTesseract(imagePath: string) {
  const { stdout } = await execFileAsync('tesseract', [imagePath, 'stdout', '--psm', '6'], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

async function rotateImage(sourcePath: string, angle: 90 | 180 | 270, destinationPath: string) {
  await execFileAsync('sips', ['-r', String(angle), sourcePath, '--out', destinationPath], {
    maxBuffer: 2 * 1024 * 1024,
  });
}

async function renderPage(pdfPath: string, pageNumber: number, dpi: number, outputPrefix: string) {
  await execFileAsync(
    'pdftoppm',
    ['-f', String(pageNumber), '-l', String(pageNumber), '-r', String(dpi), '-png', pdfPath, outputPrefix],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  const dir = dirname(outputPrefix);
  const prefix = `${basename(outputPrefix)}-`;
  const files = (await readdir(dir))
    .filter((file) => file.startsWith(prefix) && file.endsWith('.png'))
    .sort();

  if (files.length === 0) {
    throw new Error(`pdftoppm did not emit a PNG for page ${pageNumber}`);
  }

  return join(dir, files[0]!);
}

async function analyzePage(pdfPath: string, pageNumber: number, dpi: number, workingDir: string): Promise<PageAnalysis> {
  const outputPrefix = join(workingDir, `page-${String(pageNumber).padStart(4, '0')}`);
  const baseImagePath = await renderPage(pdfPath, pageNumber, dpi, outputPrefix);

  const attempts: Array<{ rotation: 0 | 90 | 180 | 270; imagePath: string }> = [{ rotation: 0, imagePath: baseImagePath }];
  for (const rotation of [90, 180, 270] as const) {
    const rotatedPath = join(workingDir, `page-${String(pageNumber).padStart(4, '0')}-rot-${rotation}.png`);
    await rotateImage(baseImagePath, rotation, rotatedPath);
    attempts.push({ rotation, imagePath: rotatedPath });
  }

  let best: PageAnalysis | null = null;

  for (const attempt of attempts) {
    const rawText = await runTesseract(attempt.imagePath);
    const snippet = rawText.replace(/\s+/g, ' ').trim().slice(0, 220);
    const baseAnalysis = getPageType(normalizeText(rawText));
    const candidate: PageAnalysis = {
      pageNumber,
      rotation: attempt.rotation,
      snippet,
      ...baseAnalysis,
    };

    if (!best || scorePageAnalysis(candidate) > scorePageAnalysis(best)) {
      best = candidate;
    }

    if (candidate.pageType === 'receipt' || candidate.pageType === 'transaction') {
      break;
    }
  }

  if (!best) {
    throw new Error(`Failed to OCR page ${pageNumber}`);
  }

  return best;
}

function buildSegments(totalPages: number, pages: PageAnalysis[]): Segment[] {
  const segments: Segment[] = [];
  let currentStart = 1;
  let lastTransactionPage: number | null = null;

  for (const page of pages) {
    const isNewReceipt = page.pageType === 'receipt' && page.pageNumber > currentStart;

    if (isNewReceipt && lastTransactionPage !== null) {
      segments.push({
        startPage: currentStart,
        endPage: lastTransactionPage,
        transactionEndPage: lastTransactionPage,
        nextReceiptPage: page.pageNumber,
      });
      currentStart = page.pageNumber;
      lastTransactionPage = null;
    }

    if (page.pageType === 'transaction') {
      lastTransactionPage = page.pageNumber;
    }
  }

  segments.push({
    startPage: currentStart,
    endPage: lastTransactionPage ?? totalPages,
    transactionEndPage: lastTransactionPage,
    nextReceiptPage: null,
  });

  return segments.filter((segment) => segment.endPage >= segment.startPage);
}

function fileStem(inputPath: string) {
  return basename(inputPath, extname(inputPath));
}

function segmentOutputDir(inputPath: string, outputDir?: string) {
  if (outputDir) return outputDir;
  return dirname(inputPath);
}

async function writeSegments(pdfPath: string, totalPages: number, segments: Segment[], outputDir: string) {
  const bytes = await readFile(pdfPath);
  const srcDoc = await PDFDocument.load(bytes);
  await mkdir(outputDir, { recursive: true });

  const stem = fileStem(pdfPath);
  const manifest = {
    sourcePdf: pdfPath,
    totalPages,
    segments,
  };

  for (const [index, segment] of segments.entries()) {
    const newDoc = await PDFDocument.create();
    const pageIndices = Array.from(
      { length: segment.endPage - segment.startPage + 1 },
      (_, offset) => segment.startPage - 1 + offset,
    );
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }

    const outputPath = join(
      outputDir,
      `${stem}-split-${index + 1}.pdf`,
    );
    await writeFile(outputPath, await newDoc.save());
  }

  await writeFile(join(outputDir, `${stem}-split-manifest.json`), JSON.stringify(manifest, null, 2));
}

async function processPdf(pdfPath: string, args: Args) {
  const pdfStats = await stat(pdfPath);
  if (!pdfStats.isFile()) {
    throw new Error(`Not a file: ${pdfPath}`);
  }

  const srcBytes = await readFile(pdfPath);
  const srcDoc = await PDFDocument.load(srcBytes);
  const totalPages = srcDoc.getPageCount();

  const workingDir = await mkdtemp(join(tmpdir(), 'pdf-split-ocr-'));
  try {
    const pages: PageAnalysis[] = [];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      const page = await analyzePage(pdfPath, pageNumber, args.dpi, workingDir);
      pages.push(page);
      if (args.verbose) {
        console.log(
          [
            `P${String(page.pageNumber).padStart(3, '0')}`,
            page.pageType.padEnd(12),
            `rot=${String(page.rotation).padStart(3, ' ')}`,
            page.snippet || '(no OCR text)',
          ].join('  '),
        );
      }
    }

    const segments = buildSegments(totalPages, pages);
    const outputDir = segmentOutputDir(pdfPath, args.outputDir);

    console.log(`\n${pdfPath}`);
    console.log(`  pages: ${totalPages}`);
    console.log(`  detected segments: ${segments.length}`);
    for (const [index, segment] of segments.entries()) {
      const boundaryNote =
        segment.nextReceiptPage == null
          ? 'end of file'
          : `next receipt at page ${segment.nextReceiptPage}`;
      console.log(
        `  part ${index + 1}: pages ${segment.startPage}-${segment.endPage} (${boundaryNote})`,
      );
    }

    if (!args.dryRun) {
      await writeSegments(pdfPath, totalPages, segments, outputDir);
      console.log(`  wrote split PDFs to ${outputDir}`);
    }
  } finally {
    await rm(workingDir, { recursive: true, force: true });
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    await Promise.all([assertCommandAvailable('pdftoppm'), assertCommandAvailable('tesseract'), assertCommandAvailable('sips')]);

    if (!args.dryRun && args.outputDir) {
      await mkdir(args.outputDir, { recursive: true });
      await access(args.outputDir, constants.W_OK);
    }

    for (const inputPath of args.inputPaths) {
      await processPdf(inputPath, args);
    }
  } catch (error) {
    if (error instanceof Error && /required|Unknown option|At least one PDF path|--dpi|--output-dir/.test(error.message)) {
      printUsage();
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
