import { readdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { ResponseSchema, type ExtractedData } from "./process-pdf";

export interface JobMetadata {
  jobName: string;
  model: string;
  runId: string;
  createdAt: string;
  evalNames: string[];
  requestCount: number;
  inputFileName?: string;
}

export interface BatchJobStatus {
  name: string;
  state: string;
  createTime?: string;
  updateTime?: string;
  batchStats?: {
    totalRequestCount: number;
    successRequestCount?: number;
    failedRequestCount?: number;
  };
  dest?: {
    fileName: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface BatchResponse {
  key: string;
  response?: {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

export const COMPLETED_STATES = new Set([
  "JOB_STATE_SUCCEEDED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
]);

export function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return key;
}

export async function getJobStatus(jobName: string): Promise<BatchJobStatus> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${jobName}?key=${getApiKey()}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get job status: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function downloadResultsFile(fileName: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/download/v1beta/${fileName}:download?alt=media&key=${getApiKey()}`,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to download results: ${response.status} - ${error}`);
  }

  return response.text();
}

export async function loadJobMetadata(runDir: string): Promise<JobMetadata | null> {
  try {
    const metadataPath = join(runDir, "job.json");
    const content = await readFile(metadataPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function formatStatus(status: BatchJobStatus): string {
  const state = status.state || "UNKNOWN";
  if (status.batchStats) {
    const { successRequestCount = 0, totalRequestCount } = status.batchStats;
    return `${state} (${successRequestCount}/${totalRequestCount})`;
  }
  return state;
}

export function parseKey(key: string): { evalName: string; batchIndex: number } {
  const parts = key.split(":batch-");
  if (parts.length !== 2) {
    throw new Error(`Invalid key format: ${key}`);
  }
  return {
    evalName: parts[0],
    batchIndex: parseInt(parts[1], 10),
  };
}

function parseResponseText(text: string): ExtractedData {
  try {
    const parsed = JSON.parse(text);
    return ResponseSchema.parse(parsed);
  } catch (error) {
    console.error(`Failed to parse response: ${error}`);
    return { ingress: [], egress: [] };
  }
}

export async function processResults(
  runDir: string,
  resultsContent: string
): Promise<void> {
  const { mkdirSync } = await import("fs");
  const lines = resultsContent.trim().split("\n").filter(Boolean);
  console.log(`\nProcessing ${lines.length} responses...`);

  // Group responses by eval name
  const evalResults: Map<
    string,
    Array<{ batchIndex: number; data: ExtractedData }>
  > = new Map();

  for (const line of lines) {
    const response: BatchResponse = JSON.parse(line);

    if (response.error) {
      console.error(`Error for ${response.key}: ${response.error.message}`);
      continue;
    }

    const text = response.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error(`No text in response for ${response.key}`);
      continue;
    }

    const { evalName, batchIndex } = parseKey(response.key);
    const data = parseResponseText(text);

    if (!evalResults.has(evalName)) {
      evalResults.set(evalName, []);
    }
    evalResults.get(evalName)!.push({ batchIndex, data });
  }

  // Merge and save results for each eval
  for (const [evalName, batches] of evalResults) {
    // Sort by batch index to maintain order
    batches.sort((a, b) => a.batchIndex - b.batchIndex);

    const merged: ExtractedData = {
      ingress: [],
      egress: [],
    };

    for (const batch of batches) {
      merged.ingress.push(...batch.data.ingress);
      merged.egress.push(...batch.data.egress);
    }

    // Create eval directory
    const evalDir = join(runDir, evalName);
    mkdirSync(evalDir, { recursive: true });

    // Save results
    await writeFile(
      join(evalDir, "ingress.json"),
      JSON.stringify(merged.ingress, null, 2)
    );
    await writeFile(
      join(evalDir, "egress.json"),
      JSON.stringify(merged.egress, null, 2)
    );

    console.log(
      `  ${evalName}: ${merged.ingress.length} ingress, ${merged.egress.length} egress`
    );
  }
}

export async function processCompletedRun(runDir: string): Promise<void> {
  const metadata = await loadJobMetadata(runDir);
  if (!metadata) {
    throw new Error(`No job metadata found in ${runDir}`);
  }

  const status = await getJobStatus(metadata.jobName);

  if (status.state !== "JOB_STATE_SUCCEEDED") {
    throw new Error(`Job not succeeded: ${status.state}`);
  }

  if (!status.dest?.fileName) {
    throw new Error("No results file found in completed job");
  }

  console.log(`Downloading results from ${status.dest.fileName}...`);
  const resultsContent = await downloadResultsFile(status.dest.fileName);

  // Save raw results
  const resultsPath = join(runDir, "results.jsonl");
  await writeFile(resultsPath, resultsContent);
  console.log(`Saved raw results to ${resultsPath}`);

  // Process and save parsed results
  await processResults(runDir, resultsContent);
}

export async function findAllRuns(baseDir: string): Promise<string[]> {
  const runsDir = join(baseDir, "runs");
  try {
    const entries = readdirSync(runsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => join(runsDir, e.name));
  } catch {
    return [];
  }
}

