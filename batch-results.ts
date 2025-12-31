import { existsSync } from "fs";
import { join } from "path";
import {
  getApiKey,
  getJobStatus,
  loadJobMetadata,
  processCompletedRun,
  COMPLETED_STATES,
} from "./batch-utils";

async function pollUntilComplete(
  jobName: string,
  pollIntervalMs: number = 10000
) {
  console.log(`Polling job status for ${jobName}...`);

  while (true) {
    const status = await getJobStatus(jobName);
    console.log(
      `  State: ${status.state}` +
        (status.batchStats
          ? ` (${status.batchStats.successRequestCount ?? 0}/${
              status.batchStats.totalRequestCount
            } complete)`
          : "")
    );

    if (COMPLETED_STATES.has(status.state)) {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

async function main() {
  const runDir = process.argv[2];

  if (!runDir) {
    console.error("Usage: bun run batch-results.ts <run-directory>");
    console.error(
      "Example: bun run batch-results.ts runs/gemini-3-flash-preview-2024-12-30-abc123"
    );
    process.exit(1);
  }

  getApiKey(); // Validate API key early

  const metadataPath = join(runDir, "job.json");
  if (!existsSync(metadataPath)) {
    console.error(`Job metadata not found: ${metadataPath}`);
    process.exit(1);
  }

  const metadata = await loadJobMetadata(runDir);
  if (!metadata) {
    console.error(`Failed to load job metadata from ${runDir}`);
    process.exit(1);
  }

  console.log(`\n=== Batch Results for ${metadata.model} ===`);
  console.log(`Job: ${metadata.jobName}`);
  console.log(`Created: ${metadata.createdAt}`);
  console.log(`Requests: ${metadata.requestCount}\n`);

  // Poll until complete
  const status = await pollUntilComplete(metadata.jobName);

  if (status.state !== "JOB_STATE_SUCCEEDED") {
    console.error(`\nJob ended with state: ${status.state}`);
    if (status.error) {
      console.error(`Error: ${status.error.message}`);
    }
    process.exit(1);
  }

  // Process results
  await processCompletedRun(runDir);

  console.log(`\n=== Processing Complete ===`);
  console.log(`Results saved to ${runDir}`);

  if (status.batchStats?.failedRequestCount) {
    console.log(
      `\nWarning: ${status.batchStats.failedRequestCount} requests failed`
    );
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
