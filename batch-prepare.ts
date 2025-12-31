import { readdirSync, existsSync, mkdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import z from "zod";
import { nanoid } from "nanoid";
import {
  splitPdfIntoChunks,
  EXTRACTION_PROMPT,
  ResponseSchema,
  BATCH_SIZE,
} from "./process-pdf";

const EVALS_DIR = join(import.meta.dir, "evals");

interface BatchRequest {
  key: string;
  request: {
    contents: Array<{
      parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>;
    }>;
    generationConfig: {
      mediaResolution: string;
      responseMimeType: string;
      responseJsonSchema: unknown;
    };
  };
}

interface JobMetadata {
  jobName: string;
  model: string;
  runId: string;
  createdAt: string;
  evalNames: string[];
  requestCount: number;
  inputFileName?: string;
}

function getRunDir(model: string, runId: string): string {
  const date = new Date().toISOString().split("T")[0];
  return join(import.meta.dir, "runs", `${model}-${date}-${runId}`);
}

async function findEvalPdfs(): Promise<Array<{ evalName: string; pdfPath: string }>> {
  const entries = readdirSync(EVALS_DIR, { withFileTypes: true });
  const evals: Array<{ evalName: string; pdfPath: string }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = join(EVALS_DIR, entry.name);
    const files = readdirSync(dirPath);
    const pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"));

    if (pdfFile) {
      evals.push({
        evalName: entry.name,
        pdfPath: join(dirPath, pdfFile),
      });
    }
  }

  return evals;
}

async function generateBatchRequests(
  evals: Array<{ evalName: string; pdfPath: string }>
): Promise<BatchRequest[]> {
  const jsonSchema = z.toJSONSchema(ResponseSchema, { unrepresentable: "any" });
  const requests: BatchRequest[] = [];

  for (const { evalName, pdfPath } of evals) {
    console.log(`Processing ${evalName}...`);
    const pdfBuffer = await readFile(pdfPath);
    const chunks = await splitPdfIntoChunks(pdfBuffer, BATCH_SIZE);

    for (const chunk of chunks) {
      const pdfBase64 = Buffer.from(chunk.pdfBytes).toString("base64");
      const key = `${evalName}:batch-${chunk.batchIndex}`;

      requests.push({
        key,
        request: {
          contents: [
            {
              parts: [
                { text: EXTRACTION_PROMPT },
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: pdfBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            mediaResolution: "MEDIA_RESOLUTION_HIGH",
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
          },
        },
      });
    }

    console.log(`  → ${chunks.length} batch(es) for ${evalName}`);
  }

  return requests;
}

async function uploadJsonlFile(jsonlPath: string): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const fileContent = await readFile(jsonlPath);
  const fileName = jsonlPath.split("/").pop()!;

  // Step 1: Initiate resumable upload
  const initResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(fileContent.length),
        "X-Goog-Upload-Header-Content-Type": "application/jsonl",
      },
      body: JSON.stringify({
        file: {
          display_name: fileName,
        },
      }),
    }
  );

  if (!initResponse.ok) {
    const error = await initResponse.text();
    throw new Error(`Failed to initiate upload: ${initResponse.status} - ${error}`);
  }

  const uploadUrl = initResponse.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw new Error("No upload URL returned");
  }

  // Step 2: Upload the file content
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(fileContent.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: fileContent,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload file: ${uploadResponse.status} - ${error}`);
  }

  const result = await uploadResponse.json();
  console.log(`Uploaded file: ${result.file.name}`);
  return result.file.name;
}

async function createBatchJob(model: string, inputFileName: string): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchGenerateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batch: {
          display_name: `batch-${nanoid(8)}`,
          input_config: {
            file_name: inputFileName,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create batch job: ${response.status} - ${error}`);
  }

  const result = await response.json();
  console.log(`Created batch job: ${result.name}`);
  return result.name;
}

async function main() {
  const args = process.argv.slice(2);
  const modelIndex = args.indexOf("--model");
  const model = modelIndex !== -1 ? args[modelIndex + 1] : "gemini-3-flash-preview";

  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log(`\n=== Batch Preparation for ${model} ===\n`);

  // Find all eval PDFs
  const evals = await findEvalPdfs();
  console.log(`Found ${evals.length} evals to process\n`);

  if (evals.length === 0) {
    console.error("No eval PDFs found in evals/ directory");
    process.exit(1);
  }

  // Generate batch requests
  const requests = await generateBatchRequests(evals);
  console.log(`\nGenerated ${requests.length} total batch requests\n`);

  // Create run directory
  const runId = nanoid(8);
  const runDir = getRunDir(model, runId);
  mkdirSync(runDir, { recursive: true });

  // Write JSONL file
  const jsonlPath = join(runDir, "requests.jsonl");
  const jsonlContent = requests.map((r) => JSON.stringify(r)).join("\n");
  await writeFile(jsonlPath, jsonlContent);
  console.log(`Wrote requests to ${jsonlPath}`);

  // Upload JSONL file
  console.log("\nUploading JSONL file to Gemini...");
  const inputFileName = await uploadJsonlFile(jsonlPath);

  // Create batch job
  console.log("\nCreating batch job...");
  const jobName = await createBatchJob(model, inputFileName);

  // Save job metadata
  const metadata: JobMetadata = {
    jobName,
    model,
    runId,
    createdAt: new Date().toISOString(),
    evalNames: evals.map((e) => e.evalName),
    requestCount: requests.length,
    inputFileName,
  };

  const metadataPath = join(runDir, "job.json");
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`\nSaved job metadata to ${metadataPath}`);

  console.log(`\n=== Batch Job Created ===`);
  console.log(`Run directory: ${runDir}`);
  console.log(`Job name: ${jobName}`);
  console.log(`\nTo check results, run:`);
  console.log(`  bun run batch-results.ts ${runDir}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

