export const DONOR_BEESWARM_PRECOMPUTE_VERSION = 'donor-force-v1';

const toFixedString = (value) => {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? `${n}` : n.toFixed(6);
};

function djb2Hash(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function createDonorBeeswarmSignature(rows) {
  const parts = rows
    .map((row) => [
      row.id || '',
      row.name || '',
      row.position || '',
      row.party || '',
      toFixedString(row.ingresoTotal ?? row.total ?? 0),
    ].join('\t'))
    .sort();

  return djb2Hash([DONOR_BEESWARM_PRECOMPUTE_VERSION, `${rows.length}`, ...parts].join('\n'));
}
