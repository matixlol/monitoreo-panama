import {
  getApiKey,
  getJobStatus,
  getState,
  loadJobMetadata,
  findAllRuns,
  formatStatus,
  processCompletedRun,
  COMPLETED_STATES,
  type JobMetadata,
  type BatchJobStatus,
} from "./batch-utils";

async function main() {
  getApiKey(); // Validate API key early

  const runDirs = await findAllRuns(import.meta.dir);
  if (runDirs.length === 0) {
    console.error("No runs found in runs/ directory");
    process.exit(1);
  }

  // Load all job metadata
  const jobs: Array<{ runDir: string; metadata: JobMetadata }> = [];
  for (const runDir of runDirs) {
    const metadata = await loadJobMetadata(runDir);
    if (metadata) {
      jobs.push({ runDir, metadata });
    }
  }

  console.log(`\n=== Polling ${jobs.length} Batch Jobs ===\n`);

  const pendingJobs = new Map(jobs.map((j) => [j.metadata.jobName, j]));
  const completedJobs: Array<{ runDir: string; status: BatchJobStatus }> = [];
  const failedJobs: Array<{ runDir: string; status: BatchJobStatus }> = [];

  while (pendingJobs.size > 0) {
    console.log(
      `\n[${new Date().toLocaleTimeString()}] Checking ${
        pendingJobs.size
      } job(s)...\n`
    );

    for (const [jobName, job] of pendingJobs) {
      try {
        const status = await getJobStatus(jobName);
        const runName = job.runDir.split("/").pop();
        console.log(`  ${runName}: ${formatStatus(status)}`);

        const state = getState(status);
        if (COMPLETED_STATES.has(state)) {
          pendingJobs.delete(jobName);

          if (state === "BATCH_STATE_SUCCEEDED") {
            completedJobs.push({ runDir: job.runDir, status });
          } else {
            failedJobs.push({ runDir: job.runDir, status });
          }
        }
      } catch (error) {
        console.error(`  Error checking ${jobName}: ${error}`);
      }
    }

    if (pendingJobs.size > 0) {
      console.log(`\nWaiting 30 seconds before next poll...`);
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }

  // Process all completed jobs
  console.log(`\n=== All Jobs Complete ===`);
  console.log(`Succeeded: ${completedJobs.length}`);
  console.log(`Failed: ${failedJobs.length}`);

  for (const { runDir } of completedJobs) {
    try {
      console.log(`\nProcessing ${runDir.split("/").pop()}...`);
      await processCompletedRun(runDir);
    } catch (error) {
      console.error(`Error processing ${runDir}: ${error}`);
    }
  }

  for (const { runDir, status } of failedJobs) {
    console.error(`\nFailed job: ${runDir.split("/").pop()}`);
    console.error(`  State: ${getState(status)}`);
    if (status.error) {
      console.error(`  Error: ${status.error.message}`);
    }
  }

  console.log(`\n=== Done ===`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
