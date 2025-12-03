import { readFile, readdir } from "fs/promises";
import { join } from "path";

const DATA_DIR = "./data/entries";

interface IngressRecord {
  amount: number;
}

interface EgressRecord {
  amount: number;
}

interface DonationRecord {
  amount: number;
}

async function analyzeData() {
  const entriesDir = DATA_DIR;
  const entryIds = await readdir(entriesDir);

  let totalIngress = 0;
  let totalEgress = 0;
  let totalDonations = 0;
  let entriesWithIngress = 0;
  let entriesWithEgress = 0;
  let entriesWithDonations = 0;
  let totalIngressRecords = 0;
  let totalEgressRecords = 0;
  let totalDonationRecords = 0;

  console.log(`Analyzing ${entryIds.length} entries...\n`);

  for (const entryId of entryIds) {
    const entryDir = join(entriesDir, entryId);

    try {
      // Check ingress
      try {
        const ingressPath = join(entryDir, "ingress.json");
        const ingressData = JSON.parse(
          await readFile(ingressPath, "utf8")
        ) as IngressRecord[];
        if (ingressData && ingressData.length > 0) {
          entriesWithIngress++;
          totalIngressRecords += ingressData.length;
          const sum = ingressData.reduce(
            (acc, record) => acc + (record.amount || 0),
            0
          );
          totalIngress += sum;
        }
      } catch (err) {
        // File doesn't exist or is invalid, skip
      }

      // Check egress
      try {
        const egressPath = join(entryDir, "egress.json");
        const egressData = JSON.parse(
          await readFile(egressPath, "utf8")
        ) as EgressRecord[];
        if (egressData && egressData.length > 0) {
          entriesWithEgress++;
          totalEgressRecords += egressData.length;
          const sum = egressData.reduce(
            (acc, record) => acc + (record.amount || 0),
            0
          );
          totalEgress += sum;
        }
      } catch (err) {
        // File doesn't exist or is invalid, skip
      }

      // Check donations
      try {
        const donationsPath = join(entryDir, "donations.json");
        const donationsData = JSON.parse(
          await readFile(donationsPath, "utf8")
        ) as DonationRecord[];
        if (donationsData && donationsData.length > 0) {
          entriesWithDonations++;
          totalDonationRecords += donationsData.length;
          const sum = donationsData.reduce(
            (acc, record) => acc + (record.amount || 0),
            0
          );
          totalDonations += sum;
        }
      } catch (err) {
        // File doesn't exist or is invalid, skip
      }
    } catch (err) {
      // Skip entries that can't be read
    }
  }

  console.log("=== SUMMARY ===");
  console.log(`\nTotal entries analyzed: ${entryIds.length}`);

  const totalEntries = entryIds.length;
  const missingIngress = totalEntries - entriesWithIngress;
  const missingEgress = totalEntries - entriesWithEgress;
  const missingDonations = totalEntries - entriesWithDonations;

  console.log(`\n--- INGRESS (Ingresos) ---`);
  console.log(`Entries with ingress data: ${entriesWithIngress}`);
  console.log(`Entries missing ingress data: ${missingIngress}`);
  console.log(`Total ingress records: ${totalIngressRecords}`);
  console.log(
    `Total ingress amount: ${totalIngress.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    })}`
  );

  console.log(`\n--- EGRESS (Egresos/Gastos) ---`);
  console.log(`Entries with egress data: ${entriesWithEgress}`);
  console.log(`Entries missing egress data: ${missingEgress}`);
  console.log(`Total egress records: ${totalEgressRecords}`);
  console.log(
    `Total egress amount: ${totalEgress.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    })}`
  );

  console.log(`\n--- DONATIONS (Donaciones) ---`);
  console.log(`Entries with donations data: ${entriesWithDonations}`);
  console.log(`Entries missing donations data: ${missingDonations}`);
  console.log(`Total donation records: ${totalDonationRecords}`);
  console.log(
    `Total donations amount: ${totalDonations.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    })}`
  );

  console.log(`\n--- NET ---`);
  console.log(
    `Net (Ingress - Egress): ${(totalIngress - totalEgress).toLocaleString(
      "en-US",
      { style: "currency", currency: "USD" }
    )}`
  );
}

analyzeData().catch(console.error);
