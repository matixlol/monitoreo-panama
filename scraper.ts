import { readFile, mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { z } from "zod";
import pMap from "p-map";

// Disable SSL verification for this government site with certificate issues
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE_URL = "https://ingresosygastos.te.gob.pa/api/public";
const DATA_DIR = "./data";

// Zod schemas with passthrough() to keep unknown keys

const AffidavitDocumentSchema = z
  .object({
    id: z.string(),
    mimeType: z.string(),
    key: z.string(),
    url: z.string(),
  })
  .passthrough();

const AffidavitSummarySchema = z
  .object({
    id: z.string(),
    candidateId: z.string(),
    status: z.string(),
    isProclaimed: z.boolean(),
    Candidate: z
      .object({
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        documentId: z.string().nullable(),
      })
      .passthrough(),
    Postulation: z
      .object({
        Position: z
          .object({
            name: z.string(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type AffidavitSummary = z.infer<typeof AffidavitSummarySchema>;

const AffidavitDetailSchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    candidateId: z.string(),
    postulationId: z.string(),
    status: z.string(),
    dateSent: z.string().nullable(),
    isProclaimed: z.boolean(),
    Party: z.any(),
    Candidate: z.any(),
    AffidavitSigners: z.array(z.any()),
    Postulation: z.any(),
    AffidavitDocumentAudit: z.array(AffidavitDocumentSchema),
    AffidavitDocument: z.array(AffidavitDocumentSchema),
    totalEgress: z.number(),
    totalIngress: z.number(),
  })
  .passthrough();

const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z
    .object({
      data: z.array(itemSchema),
      count: z.number(),
      page: z.number(),
      limit: z.number(),
    })
    .passthrough();

// Generic record schema that passes through everything
const RecordSchema = z.record(z.string(), z.any());

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return schema.parse(json);
}

async function fetchAllPages<T>(
  baseUrl: string,
  itemSchema: z.ZodType<T>,
  limit = 1000
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let count = Infinity;

  while (all.length < count) {
    const url = `${baseUrl}${
      baseUrl.includes("?") ? "&" : "?"
    }page=${page}&limit=${limit}`;
    const schema = PaginatedResponseSchema(itemSchema);
    const res = await fetchJson(url, schema);
    all.push(...res.data);
    count = res.count;
    page++;
    if (res.data.length === 0) break;
  }

  return all;
}

async function downloadPdf(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download PDF: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  await writeFile(destPath, Buffer.from(buffer));
}

async function isEntryComplete(entryDir: string): Promise<boolean> {
  const metaPath = join(entryDir, "_complete.json");
  return existsSync(metaPath);
}

async function markEntryComplete(entryDir: string): Promise<void> {
  const metaPath = join(entryDir, "_complete.json");
  await writeFile(
    metaPath,
    JSON.stringify({ completedAt: new Date().toISOString() })
  );
}

async function scrapeEntry(id: string): Promise<void> {
  const entryDir = join(DATA_DIR, "entries", id);

  // Check if already downloaded
  if (await isEntryComplete(entryDir)) {
    console.log(`Skipping ${id} - already complete`);
    return;
  }

  await mkdir(entryDir, { recursive: true });
  const pdfsDir = join(entryDir, "pdfs");
  await mkdir(pdfsDir, { recursive: true });

  console.log(`Scraping entry ${id}...`);

  // 1. Fetch main entry details
  const detail = await fetchJson(
    `${BASE_URL}/affidavit/${id}`,
    AffidavitDetailSchema
  );
  await writeFile(
    join(entryDir, "detail.json"),
    JSON.stringify(detail, null, 2)
  );
  console.log(`  - Saved detail.json`);

  // 2. Fetch all income records (ingresos)
  const ingress = await fetchAllPages(
    `${BASE_URL}/affidavit/${id}/ingress?affidavitId=${id}&type=ingress&sortKey=date&sortOrder=asc`,
    RecordSchema
  );
  await writeFile(
    join(entryDir, "ingress.json"),
    JSON.stringify(ingress, null, 2)
  );
  console.log(`  - Saved ingress.json (${ingress.length} records)`);

  // 3. Fetch all expense records (gastos)
  const egress = await fetchAllPages(
    `${BASE_URL}/affidavit/${id}/egress?affidavitId=${id}&type=egress&sortKey=date&sortOrder=asc`,
    RecordSchema
  );
  await writeFile(
    join(entryDir, "egress.json"),
    JSON.stringify(egress, null, 2)
  );
  console.log(`  - Saved egress.json (${egress.length} records)`);

  // 4. Fetch all donor records (donantes)
  const donations = await fetchAllPages(
    `${BASE_URL}/affidavit/${id}/donations?affidavitId=${id}&sortKey=date&sortOrder=asc`,
    RecordSchema
  );
  await writeFile(
    join(entryDir, "donations.json"),
    JSON.stringify(donations, null, 2)
  );
  console.log(`  - Saved donations.json (${donations.length} records)`);

  // 5. Download PDFs
  for (const doc of detail.AffidavitDocument || []) {
    if (doc.url && doc.mimeType === "application/pdf") {
      const filename = doc.key.split("/").pop() || `${doc.id}.pdf`;
      const pdfPath = join(pdfsDir, filename);
      try {
        console.log(`  - Downloading PDF: ${filename}`);
        await downloadPdf(doc.url, pdfPath);
      } catch (err) {
        console.error(`  - Failed to download PDF ${filename}:`, err);
      }
    }
  }

  // 6. Download audit documents if any
  for (const doc of detail.AffidavitDocumentAudit || []) {
    if (doc.url && doc.mimeType === "application/pdf") {
      const filename = `audit_${doc.key.split("/").pop() || `${doc.id}.pdf`}`;
      const pdfPath = join(pdfsDir, filename);
      try {
        console.log(`  - Downloading audit PDF: ${filename}`);
        await downloadPdf(doc.url, pdfPath);
      } catch (err) {
        console.error(`  - Failed to download audit PDF ${filename}:`, err);
      }
    }
  }

  // Mark as complete
  await markEntryComplete(entryDir);
  console.log(`  - Entry ${id} complete!`);
}

await mkdir(join(DATA_DIR, "entries"), { recursive: true });

console.log("Fetching list of all entries...");

let allEntries: AffidavitSummary[];
if (existsSync(join(DATA_DIR, "all_entries.json"))) {
  allEntries = JSON.parse(
    await readFile(join(DATA_DIR, "all_entries.json"), "utf8")
  );
} else {
  allEntries = await fetchAllPages(
    `${BASE_URL}/affidavit?sortKey=Candidate.firstName|Candidate.lastName&sortOrder=asc`,
    AffidavitSummarySchema
  );
  await writeFile(
    join(DATA_DIR, "all_entries.json"),
    JSON.stringify(allEntries)
  );
}

const entries = allEntries.filter((entry) => {
  const proclaimed = entry.isProclaimed;
  const position = entry.Postulation?.Position?.name.toLowerCase();
  if (
    position !== "alcalde" &&
    position !== "diputado(a)" &&
    position !== "presidente"
  )
    return false;
  if (proclaimed || position === "presidente") return true;
  return false;
});

console.log(
  `Found ${allEntries.length} total entries, ${entries.length} to scrape`
);

await pMap(
  entries,
  async (entry) => {
    try {
      await scrapeEntry(entry.id);
    } catch (err) {
      console.error(`Failed to scrape entry ${entry.id}:`, err);
    }
  },
  { concurrency: 10 }
);

console.log("Done!");
