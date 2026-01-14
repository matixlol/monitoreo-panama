/**
 * Generates a JSON index of all documents with candidate metadata.
 * Run with: bun run scripts/generate-documents-index.ts
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface CandidateMetadata {
  id: string;
  candidateName: string;
  documentId: string;
  position: string;
  party: string;
  province: string | null;
  district: string | null;
  township: string | null;
  status: string;
  isProclaimed: boolean;
  dateSent: string | null;
  totalIngress: number;
  totalEgress: number;
  pdfUrl: string | null;
}

async function generateIndex() {
  const entriesDir = join(import.meta.dirname, '..', 'data', 'entries');
  const entries = await readdir(entriesDir);

  const documents: CandidateMetadata[] = [];

  for (const entryId of entries) {
    const detailPath = join(entriesDir, entryId, 'detail.json');

    try {
      const content = await readFile(detailPath, 'utf-8');
      const detail = JSON.parse(content);

      const candidate = detail.Candidate;
      const postulation = detail.Postulation;

      const candidateName = [
        candidate?.firstName,
        candidate?.middleName,
        candidate?.lastName,
        candidate?.secondLastName,
      ]
        .filter(Boolean)
        .join(' ');

      const pdfDoc = detail.AffidavitDocument?.[0];

      documents.push({
        id: detail.id,
        candidateName: candidateName || 'Desconocido',
        documentId: candidate?.documentId || '',
        position: postulation?.Position?.name || 'Desconocido',
        party: detail.Party?.name || 'Desconocido',
        province: postulation?.Province?.name || null,
        district: postulation?.District?.name || null,
        township: postulation?.Township?.name || null,
        status: detail.status || 'unknown',
        isProclaimed: detail.isProclaimed || false,
        dateSent: detail.dateSent || null,
        totalIngress: detail.totalIngress || 0,
        totalEgress: detail.totalEgress || 0,
        pdfUrl: pdfDoc?.url || null,
      });
    } catch (error) {
      console.error(`Failed to read ${entryId}:`, error);
    }
  }

  // Sort by candidate name
  documents.sort((a, b) => a.candidateName.localeCompare(b.candidateName));

  const outputPath = join(import.meta.dirname, '..', 'data', 'documents-index.json');
  await writeFile(outputPath, JSON.stringify(documents, null, 2));

  console.log(`Generated index with ${documents.length} documents at ${outputPath}`);
}

generateIndex().catch(console.error);
