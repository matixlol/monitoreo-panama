import PARTY_COLORS_CSV from '../data/COLORES.csv?raw';

const PARTY_COLORS = new Map(
  PARTY_COLORS_CSV.trim()
    .split(/\r?\n/)
    .map((line) => {
      const separatorIndex = line.lastIndexOf(',');
      return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
    }),
);

const PARTY_ALIASES = new Map([
  ['realizando metas', 'Realizando Metas'],
  ['revolucionario democratico', 'Partido Revolucionario Democrático'],
  ['prd', 'Partido Revolucionario Democrático'],
  ['panamenista', 'Partido Panameñista'],
  ['popular', 'Partido Popular'],
  ['libre postulacion', 'Libre Postulación'],
  ['cambio democratico', 'Cambio Democrático'],
  ['alianza', 'Alianza'],
  ['molirena', 'Molirena'],
  ['movimiento liberal republicano nacionalista', 'Molirena'],
  ['movimiento otro camino', 'Movimiento Otro Camino'],
  ['moca', 'Movimiento Otro Camino'],
  ['pais', 'País'],
]);

const FALLBACK_PARTY_COLORS = new Map([
  ['otros', '#CBD5E1'],
  ['sin partido', '#94A3B8'],
]);

const normalizePartyKey = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^partido\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

export const getPartyColor = (value) => {
  const normalized = normalizePartyKey(value);
  const canonical = PARTY_ALIASES.get(normalized);

  if (canonical) return PARTY_COLORS.get(canonical) ?? FALLBACK_PARTY_COLORS.get(normalized) ?? '#94A3B8';

  return PARTY_COLORS.get(String(value ?? '').trim()) ?? FALLBACK_PARTY_COLORS.get(normalized) ?? '#94A3B8';
};