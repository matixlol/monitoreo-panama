import { readdirSync, existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import pMap from "p-map";
import {
  extractDataFromPDF,
  type IngresoRow,
  type EgresoRow,
} from "../process-pdf";

const EVALS_DIR = import.meta.dir;

interface EvalResult {
  dirName: string;
  pdfPath: string;
  ingress: ComparisonResult;
  egress: ComparisonResult;
  passed: boolean;
  error?: any;
}

interface ComparisonResult {
  rowCount: { expected: number; actual: number };
  cedulaRucMismatches: Array<{
    index: number;
    expected: string | null;
    actual: string | null;
  }>;
  moneyMismatches: Array<{
    index: number;
    field: string;
    expected: number | null;
    actual: number | null;
  }>;
  namesMatched: number;
  namesMismatched: number;
}

function normalizeCedulaRuc(value: string | null | undefined): string {
  if (!value) return "";
  // Remove all non-alphanumeric characters and lowercase
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function getMoneyFields(type: "ingress" | "egress"): string[] {
  if (type === "ingress") {
    return [
      "donacionesPrivadasEfectivo",
      "donacionesPrivadasChequeAch",
      "donacionesPrivadasEspecie",
      "recursosPropiosEfectivoCheque",
      "recursosPropiosEspecie",
      "total",
    ];
  }
  return [
    "movilizacion",
    "combustible",
    "hospedaje",
    "activistas",
    "caravanaConcentraciones",
    "comidaBrindis",
    "alquilerLocalServiciosBasicos",
    "cargosBancarios",
    "totalGastosCampania",
    "personalizacionArticulosPromocionales",
    "propagandaElectoral",
    "totalGastosPropaganda",
    "totalGeneral",
  ];
}

function getNameField(type: "ingress" | "egress"): string {
  return type === "ingress" ? "contribuyenteNombre" : "proveedorNombre";
}

function compareRows<T extends Record<string, unknown>>(
  expected: T[],
  actual: T[],
  type: "ingress" | "egress"
): ComparisonResult {
  const result: ComparisonResult = {
    rowCount: { expected: expected.length, actual: actual.length },
    cedulaRucMismatches: [],
    moneyMismatches: [],
    namesMatched: 0,
    namesMismatched: 0,
  };

  const moneyFields = getMoneyFields(type);
  const nameField = getNameField(type);
  const maxRows = Math.max(expected.length, actual.length);

  for (let i = 0; i < maxRows; i++) {
    const exp = expected[i] as Record<string, unknown> | undefined;
    const act = actual[i] as Record<string, unknown> | undefined;

    if (!exp || !act) {
      // Row count mismatch - already tracked
      continue;
    }

    // Compare cedulaRuc (normalized)
    const expCedula = normalizeCedulaRuc(exp.cedulaRuc as string | null);
    const actCedula = normalizeCedulaRuc(act.cedulaRuc as string | null);
    if (expCedula !== actCedula) {
      result.cedulaRucMismatches.push({
        index: i,
        expected: exp.cedulaRuc as string | null,
        actual: act.cedulaRuc as string | null,
      });
    }

    // Compare money fields (exact match)
    for (const field of moneyFields) {
      const expVal = exp[field] as number | null | undefined;
      const actVal = act[field] as number | null | undefined;
      // Treat null and undefined as equivalent
      const expNorm = expVal ?? null;
      const actNorm = actVal ?? null;
      if (expNorm !== actNorm) {
        result.moneyMismatches.push({
          index: i,
          field,
          expected: expNorm,
          actual: actNorm,
        });
      }
    }

    // Count name matches/mismatches
    const expName = (exp[nameField] as string | null) ?? "";
    const actName = (act[nameField] as string | null) ?? "";
    if (expName.toLowerCase().trim() === actName.toLowerCase().trim()) {
      result.namesMatched++;
    } else {
      result.namesMismatched++;
    }
  }

  return result;
}

function isPassing(result: ComparisonResult): boolean {
  return (
    result.rowCount.expected === result.rowCount.actual &&
    result.cedulaRucMismatches.length === 0 &&
    result.moneyMismatches.length === 0
  );
}

async function runEval(dirPath: string): Promise<EvalResult> {
  const dirName = dirPath.split("/").pop()!;

  // Find PDF file
  const files = readdirSync(dirPath);
  const pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"));

  if (!pdfFile) {
    return {
      dirName,
      pdfPath: "",
      ingress: {
        rowCount: { expected: 0, actual: 0 },
        cedulaRucMismatches: [],
        moneyMismatches: [],
        namesMatched: 0,
        namesMismatched: 0,
      },
      egress: {
        rowCount: { expected: 0, actual: 0 },
        cedulaRucMismatches: [],
        moneyMismatches: [],
        namesMatched: 0,
        namesMismatched: 0,
      },
      passed: false,
      error: "No PDF file found",
    };
  }

  const pdfPath = join(dirPath, pdfFile);
  const ingressPath = join(dirPath, "ingress.json");
  const egressPath = join(dirPath, "egress.json");

  // Load expected data
  let expectedIngress: IngresoRow[] = [];
  let expectedEgress: EgresoRow[] = [];

  if (existsSync(ingressPath)) {
    const content = await readFile(ingressPath, "utf-8");
    expectedIngress = JSON.parse(content);
  }
  if (existsSync(egressPath)) {
    const content = await readFile(egressPath, "utf-8");
    expectedEgress = JSON.parse(content);
  }

  try {
    // Extract data from PDF
    const { data: extracted } = await extractDataFromPDF(pdfPath);

    // Compare
    const ingressResult = compareRows(
      expectedIngress,
      extracted.ingress,
      "ingress"
    );
    const egressResult = compareRows(
      expectedEgress,
      extracted.egress,
      "egress"
    );

    return {
      dirName,
      pdfPath,
      ingress: ingressResult,
      egress: egressResult,
      passed: isPassing(ingressResult) && isPassing(egressResult),
    };
  } catch (err) {
    return {
      dirName,
      pdfPath,
      ingress: {
        rowCount: { expected: expectedIngress.length, actual: 0 },
        cedulaRucMismatches: [],
        moneyMismatches: [],
        namesMatched: 0,
        namesMismatched: 0,
      },
      egress: {
        rowCount: { expected: expectedEgress.length, actual: 0 },
        cedulaRucMismatches: [],
        moneyMismatches: [],
        namesMatched: 0,
        namesMismatched: 0,
      },
      passed: false,
      error: err,
    };
  }
}

function printResult(result: EvalResult): void {
  const status = result.passed ? "✅ PASS" : "❌ FAIL";
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${status} - ${result.dirName}`);
  console.log(`${"=".repeat(60)}`);

  if (result.error) {
    console.log(`  Error: ${result.error}`);
    console.error(result.error);
    return;
  }

  // Ingress
  console.log(`\n  INGRESS (evals/${result.dirName}/ingress.json):`);
  console.log(
    `    Rows: ${result.ingress.rowCount.actual}/${result.ingress.rowCount.expected}`
  );
  console.log(
    `    Names: ${result.ingress.namesMatched} matched, ${result.ingress.namesMismatched} mismatched`
  );

  if (result.ingress.cedulaRucMismatches.length > 0) {
    console.log(`    Cédula/RUC mismatches:`);
    for (const m of result.ingress.cedulaRucMismatches) {
      console.log(
        `      [${m.index}] expected: "${m.expected}" | actual: "${m.actual}"`
      );
    }
  }

  if (result.ingress.moneyMismatches.length > 0) {
    console.log(`    Money mismatches:`);
    for (const m of result.ingress.moneyMismatches) {
      console.log(
        `      [${m.index}] ${m.field}: expected ${m.expected} | actual ${m.actual}`
      );
    }
  }

  // Egress
  console.log(`\n  EGRESS (evals/${result.dirName}/egress.json):`);
  console.log(
    `    Rows: ${result.egress.rowCount.actual}/${result.egress.rowCount.expected}`
  );
  console.log(
    `    Names: ${result.egress.namesMatched} matched, ${result.egress.namesMismatched} mismatched`
  );

  if (result.egress.cedulaRucMismatches.length > 0) {
    console.log(`    Cédula/RUC mismatches:`);
    for (const m of result.egress.cedulaRucMismatches) {
      console.log(
        `      [${m.index}] expected: "${m.expected}" | actual: "${m.actual}"`
      );
    }
  }

  if (result.egress.moneyMismatches.length > 0) {
    console.log(`    Money mismatches:`);
    for (const m of result.egress.moneyMismatches) {
      console.log(
        `      [${m.index}] ${m.field}: expected ${m.expected} | actual ${m.actual}`
      );
    }
  }
}

async function main() {
  // Get filter argument (first command-line argument)
  const filter = process.argv[2];

  // Find all eval directories (directories with a PDF and at least one JSON)
  const entries = readdirSync(EVALS_DIR, { withFileTypes: true });
  const evalDirs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = join(EVALS_DIR, entry.name);
    const files = readdirSync(dirPath);
    const hasPdf = files.some((f) => f.toLowerCase().endsWith(".pdf"));
    const hasJson = files.some(
      (f) => f === "ingress.json" || f === "egress.json"
    );
    if (hasPdf && hasJson) {
      // Filter by directory name if filter is provided
      if (!filter || entry.name.toLowerCase().includes(filter.toLowerCase())) {
        evalDirs.push(dirPath);
      }
    }
  }

  if (evalDirs.length === 0) {
    if (filter) {
      console.log(`No eval directories found matching filter: "${filter}"`);
    } else {
      console.log("No eval directories found.");
    }
    return;
  }

  if (filter) {
    console.log(`Filter: "${filter}"`);
  }
  console.log(`Found ${evalDirs.length} eval(s) to run...\n`);

  // Run all evals in parallel
  const results = await pMap(evalDirs, runEval, { concurrency: 5 });

  // Print results
  for (const result of results) {
    printResult(result);
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `SUMMARY: ${passed} passed, ${failed} failed out of ${results.length} total`
  );
  console.log(`${"=".repeat(60)}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
