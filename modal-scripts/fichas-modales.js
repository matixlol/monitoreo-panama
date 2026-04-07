// @ts-check

import { h, render } from 'https://esm.sh/preact@10.26.6';
import { useEffect, useMemo, useState } from 'https://esm.sh/preact@10.26.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

/**
 * @fileoverview
 * Hash-routed “ficha” modals for candidatos, aportantes y proveedores.
 *
 * The script is intentionally framework-light and buildless so it can be dropped
 * into a static page or WordPress template and mounted directly in the browser.
 *
 * Runtime assumptions:
 * - `window.documentosIngresos` contains the ingresos dataset as an array of objects.
 * - `window.documentosEgresos` contains the egresos dataset as an array of objects.
 * - Routes are driven by `window.location.hash`.
 *
 * Example routes:
 * - `#/ficha/candidato/francisco-javier-agapi-chami`
 * - `#/ficha/aportante/juan-perez`
 * - `#/ficha/proveedor/acme-publicidad`
 */

/**
 * Raw ingreso row shape coming from `window.documentosIngresos`.
 * Most fields are strings because they originate from CSV exports.
 *
 * @typedef {Object} IngresoRow
 * @property {string} [documentId]
 * @property {string} [documentName]
 * @property {string} [documentStatus]
 * @property {string} [documentPageCount]
 * @property {string} [documentCreatedAt]
 * @property {string} [documentErrorMessage]
 * @property {string} [candidateName]
 * @property {string} [candidatePosition]
 * @property {string} [candidateParty]
 * @property {string} [candidateProvince]
 * @property {string} [candidateDistrict]
 * @property {string} [source]
 * @property {string} [sourceModel]
 * @property {string} [sourceCompletedAt]
 * @property {string} [pageNumber]
 * @property {string} [fecha]
 * @property {string} [reciboNumero]
 * @property {string} [contribuyenteNombre]
 * @property {string} [representanteLegal]
 * @property {string} [cedulaRuc]
 * @property {string} [direccion]
 * @property {string} [telefono]
 * @property {string} [correoElectronico]
 * @property {string} [donacionesPrivadasEfectivo]
 * @property {string} [donacionesPrivadasChequeAch]
 * @property {string} [donacionesPrivadasEspecie]
 * @property {string} [recursosPropiosEfectivoCheque]
 * @property {string} [recursosPropiosEspecie]
 * @property {string} [total]
 * @property {string} [unreadableFields]
 * @property {string} [humanUnreadableFields]
 */

/**
 * Raw egreso row shape coming from `window.documentosEgresos`.
 *
 * @typedef {Object} EgresoRow
 * @property {string} [documentPageCount]
 * @property {string} [candidateName]
 * @property {string} [candidatePosition]
 * @property {string} [candidateParty]
 * @property {string} [candidateProvince]
 * @property {string} [candidateDistrict]
 * @property {string} [fecha]
 * @property {string} [cedulaRuc]
 * @property {string} [proveedorNombre]
 * @property {string} [detalleGasto]
 * @property {string} [detalleGastoResumido]
 * @property {string} [pagoTipo]
 * @property {string} [movilizacion]
 * @property {string} [combustible]
 * @property {string} [hospedaje]
 * @property {string} [activistas]
 * @property {string} [caravanaConcentraciones]
 * @property {string} [comidaBrindis]
 * @property {string} [alquilerLocalServiciosBasicos]
 * @property {string} [cargosBancarios]
 * @property {string} [totalGastosCampania]
 * @property {string} [personalizacionArticulosPromocionales]
 * @property {string} [propagandaElectoral]
 * @property {string} [totalGastosPropaganda]
 * @property {string} [totalDeGastosDePropagandaYCampania]
 * @property {string} [GastoCategoria]
 */

/**
 * Shared shape used by donut legends, treemaps and progress rows.
 *
 * @typedef {Object} ChartDatum
 * @property {string} id
 * @property {string} label
 * @property {number} value
 * @property {string} color
 */

/**
 * Timeline point for the expenses line chart.
 *
 * @typedef {Object} TimelinePoint
 * @property {string} key
 * @property {string} label
 * @property {number} value
 * @property {number} timestamp
 */

/**
 * Candidate ficha summary derived from both datasets.
 *
 * @typedef {Object} CandidateEntity
 * @property {"candidato"} kind
 * @property {string} id
 * @property {string} name
 * @property {string[]} parties
 * @property {string[]} positions
 * @property {string[]} provinces
 * @property {string[]} districts
 * @property {IngresoRow[]} ingresos
 * @property {EgresoRow[]} egresos
 * @property {number} ingresoTotal
 * @property {number} egresoTotal
 * @property {number} contributorCount
 * @property {number} providerCount
 */

/**
 * Aportante ficha summary derived from ingresos.
 *
 * @typedef {Object} DonorEntity
 * @property {"aportante"} kind
 * @property {string} id
 * @property {string} name
 * @property {string[]} parties
 * @property {string[]} positions
 * @property {IngresoRow[]} ingresos
 * @property {number} total
 * @property {number} candidateCount
 */

/**
 * Proveedor ficha summary derived from egresos.
 *
 * @typedef {Object} ProviderEntity
 * @property {"proveedor"} kind
 * @property {string} id
 * @property {string} name
 * @property {string[]} parties
 * @property {string[]} positions
 * @property {EgresoRow[]} egresos
 * @property {number} total
 * @property {number} candidateCount
 */

/**
 * Normalized in-memory index used by the router and launcher.
 *
 * @typedef {Object} FichasStore
 * @property {IngresoRow[]} ingresos
 * @property {EgresoRow[]} egresos
 * @property {CandidateEntity[]} candidates
 * @property {DonorEntity[]} donors
 * @property {ProviderEntity[]} providers
 * @property {Map<string, CandidateEntity>} candidateById
 * @property {Map<string, DonorEntity>} donorById
 * @property {Map<string, ProviderEntity>} providerById
 */

/**
 * Parsed hash route descriptor.
 *
 * @typedef {Object} HashRoute
 * @property {"none" | "unknown" | "candidato" | "aportante" | "proveedor"} kind
 * @property {string} [id]
 * @property {string} [raw]
 */

/**
 * Inputs accepted by the store builder.
 *
 * @typedef {Object} DatasetInput
 * @property {IngresoRow[]} ingresos
 * @property {EgresoRow[]} egresos
 */

/**
 * Parameters for the CSV helper.
 *
 * @typedef {Object} CsvDatasetOptions
 * @property {string} ingresosUrl
 * @property {string} egresosUrl
 * @property {boolean} [assignToWindow=true]
 */

/**
 * Parameters accepted by the mount function.
 *
 * @typedef {Object} MountOptions
 * @property {string | Element | null | undefined} [target]
 * @property {boolean} [showLauncher]
 * @property {DatasetInput} [datasets]
 * @property {FichasStore} [store]
 * @property {string} [emptyHash="#/"]
 */

/**
 * Return value of the mount API.
 *
 * @typedef {Object} MountedApp
 * @property {Element} target
 * @property {FichasStore} store
 * @property {() => void} unmount
 * @property {() => void} rerender
 */

/** @type {readonly string[]} */
const TREEMAP_COLORS = [
  '#9BC493',
  '#C8B0A3',
  '#A6CFCF',
  '#94AECC',
  '#E29196',
  '#F2B77D',
  '#D5C6E0',
  '#F0DA8A',
  '#C9C6C3',
  '#F2C6D4',
];

/** @type {readonly string[]} */
const BREAKDOWN_COLORS = ['#2F80ED', '#7DB3F3', '#B9D5FA', '#DCEAFD', '#9AC7FF'];

/**
 * Contribution type definitions used to translate the ingresos CSV columns into
 * human-readable sections.
 *
 * @type {readonly Array<{id: string, label: string, color: string, getValue: (row: IngresoRow) => number}>}
 */
const CONTRIBUTION_TYPES = [
  {
    id: 'donacion-efectivo',
    label: 'Donación privada · efectivo',
    color: BREAKDOWN_COLORS[0],
    getValue: (row) => toAmount(row.donacionesPrivadasEfectivo),
  },
  {
    id: 'donacion-cheque-ach',
    label: 'Donación privada · cheque / ACH',
    color: BREAKDOWN_COLORS[1],
    getValue: (row) => toAmount(row.donacionesPrivadasChequeAch),
  },
  {
    id: 'donacion-especie',
    label: 'Donación privada · especie',
    color: BREAKDOWN_COLORS[2],
    getValue: (row) => toAmount(row.donacionesPrivadasEspecie),
  },
  {
    id: 'recurso-propio',
    label: 'Recurso propio · efectivo / cheque',
    color: BREAKDOWN_COLORS[3],
    getValue: (row) => toAmount(row.recursosPropiosEfectivoCheque),
  },
  {
    id: 'recurso-propio-especie',
    label: 'Recurso propio · especie',
    color: BREAKDOWN_COLORS[4],
    getValue: (row) => toAmount(row.recursosPropiosEspecie),
  },
];

/** @type {boolean} */
let stylesInjected = false;

/**
 * Ensures the component stylesheet exists exactly once.
 *
 * @returns {void}
 */
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') {
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-fichas-modales', 'true');
  style.textContent = `
    :root {
      --mf-text: #171717;
      --mf-muted: #5f6368;
      --mf-panel: #f8f7f4;
      --mf-line: #ddd9d1;
      --mf-track: #e7edf5;
      --mf-blue: #2f80ed;
      --mf-blue-2: #7db3f3;
      --mf-shadow: 0 22px 68px rgba(15, 23, 42, 0.18);
    }

    .mf-app {
      color: var(--mf-text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    .mf-launcher {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px 96px;
    }

    .mf-launcher-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 28px;
    }

    .mf-eyebrow {
      margin: 0 0 8px;
      color: var(--mf-blue);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .mf-launcher-title {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3.2rem);
      line-height: 0.95;
      font-weight: 800;
    }

    .mf-launcher-copy,
    .mf-help,
    .mf-empty,
    .mf-mini-meta,
    .mf-not-found-copy,
    .mf-footnote {
      color: var(--mf-muted);
    }

    .mf-help {
      max-width: 480px;
      font-size: 14px;
      line-height: 1.5;
    }

    .mf-launcher-section + .mf-launcher-section {
      margin-top: 28px;
    }

    .mf-launcher-section-title {
      margin: 0 0 14px;
      font-size: 1.45rem;
      font-weight: 700;
    }

    .mf-launcher-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    }

    .mf-launcher-card {
      display: grid;
      gap: 10px;
      padding: 18px;
      color: inherit;
      background: white;
      border: 1px solid var(--mf-line);
      border-radius: 20px;
      text-decoration: none;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.04);
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }

    .mf-launcher-card:hover,
    .mf-launcher-card:focus-visible {
      transform: translateY(-2px);
      border-color: #cfd6e0;
      box-shadow: 0 18px 32px rgba(15, 23, 42, 0.08);
      outline: none;
    }

    .mf-launcher-card-title {
      font-size: 1.1rem;
      font-weight: 700;
      line-height: 1.15;
    }

    .mf-launcher-card-amount {
      font-size: 1.35rem;
      font-weight: 800;
    }

    .mf-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 24px;
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(6px);
    }

    .mf-dialog {
      position: relative;
      width: min(1180px, calc(100vw - 48px));
      max-height: calc(100vh - 48px);
      overflow: auto;
      background: white;
      border-radius: 28px;
      box-shadow: var(--mf-shadow);
    }

    .mf-dialog-content {
      padding: 28px 36px 40px;
    }

    .mf-close-row {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 8px;
      position: sticky;
      top: 0;
      z-index: 5;
      pointer-events: none;
    }

    .mf-close {
      pointer-events: auto;
      width: 44px;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(23, 23, 23, 0.12);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.94);
      color: #111827;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
    }

    .mf-page-head {
      display: grid;
      gap: 22px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-bottom: 26px;
    }

    .mf-head-cell {
      min-width: 0;
    }

    .mf-head-label {
      margin: 0 0 6px;
      font-size: clamp(1.2rem, 2.2vw, 1.35rem);
      line-height: 1.1;
      font-weight: 400;
      color: #2d2f34;
    }

    .mf-head-value {
      margin: 0;
      font-size: clamp(1.45rem, 3.35vw, 2rem);
      line-height: 1.02;
      font-weight: 800;
      letter-spacing: -0.03em;
      text-wrap: balance;
    }

    .mf-head-stack {
      display: grid;
      gap: 4px;
    }

    .mf-head-list {
      margin: 2px 0 0;
      padding-left: 1rem;
      list-style: disc;
    }

    .mf-head-list li {
      margin: 0;
    }

    .mf-context-line {
      margin: -6px 0 22px;
      font-size: 14px;
      color: var(--mf-muted);
    }

    .mf-metric-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-bottom: 22px;
    }

    .mf-metric-grid.mf-metric-grid-two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .mf-metric-card {
      min-height: 170px;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 8px;
      padding: 20px;
      background: var(--mf-panel);
      border: 1px solid var(--mf-line);
      border-radius: 16px;
      text-align: center;
    }

    .mf-metric-icon {
      width: 42px;
      height: 42px;
      color: #1f2937;
    }

    .mf-metric-value {
      margin: 0;
      font-size: clamp(1.6rem, 2.8vw, 2.35rem);
      line-height: 1;
      font-weight: 800;
    }

    .mf-metric-label {
      margin: 0;
      font-size: 15px;
      color: #30343b;
    }

    .mf-section {
      margin-bottom: 16px;
      padding: 24px;
      background: var(--mf-panel);
      border-radius: 14px;
    }

    .mf-section-title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
    }

    .mf-section-title {
      margin: 0;
      font-size: clamp(1.6rem, 3vw, 2rem);
      line-height: 1.05;
      font-weight: 500;
      letter-spacing: -0.02em;
    }

    .mf-breakdown {
      display: grid;
      gap: 30px;
      align-items: center;
      grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    }

    .mf-donut-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mf-donut-svg {
      width: min(100%, 310px);
      height: auto;
      overflow: visible;
    }

    .mf-donut-center-number {
      font-size: 22px;
      font-weight: 800;
      fill: #3b4a70;
      text-anchor: middle;
    }

    .mf-donut-center-label {
      font-size: 11px;
      font-weight: 700;
      fill: #6a7590;
      text-anchor: middle;
    }

    .mf-bars {
      display: grid;
      gap: 20px;
    }

    .mf-bar-row {
      display: grid;
      gap: 8px;
    }

    .mf-bar-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
    }

    .mf-bar-label {
      font-size: 15px;
      font-weight: 700;
      color: #3b4a70;
    }

    .mf-bar-value {
      font-size: 15px;
      color: #4a5575;
      white-space: nowrap;
    }

    .mf-track {
      height: 10px;
      overflow: hidden;
      background: var(--mf-track);
      border-radius: 999px;
    }

    .mf-fill {
      height: 100%;
      border-radius: inherit;
    }

    .mf-tabs {
      display: inline-flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      padding-bottom: 1px;
      border-bottom: 1px solid #cfd6e0;
    }

    .mf-tab {
      padding: 10px 2px;
      border: 0;
      border-bottom: 3px solid transparent;
      background: transparent;
      color: #4b5563;
      font-weight: 600;
      cursor: pointer;
    }

    .mf-tab.is-active {
      color: #1f7bff;
      border-bottom-color: #2f80ed;
    }

    .mf-treemap {
      position: relative;
      min-height: 360px;
      overflow: hidden;
      border-radius: 12px;
      background: white;
      border: 1px solid #e4e3df;
    }

    .mf-rect {
      position: absolute;
      inset: auto;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      padding: 8px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.5);
      box-sizing: border-box;
    }

    .mf-rect-copy {
      font-size: 12px;
      line-height: 1.15;
      color: rgba(23, 23, 23, 0.82);
    }

    .mf-rect-title {
      display: block;
      font-weight: 700;
    }

    .mf-rect-value {
      display: block;
      margin-top: 2px;
      opacity: 0.85;
    }

    .mf-line-chart {
      overflow: hidden;
      border-radius: 12px;
      background: white;
      border: 1px solid #e4e3df;
      padding: 14px;
    }

    .mf-line-svg {
      width: 100%;
      height: auto;
      display: block;
    }

    .mf-axis-label {
      fill: #7c8597;
      font-size: 12px;
    }

    .mf-table-wrap {
      overflow: auto;
      min-height: 240px;
      max-height: 66vh;
      border: 1px solid #e4e3df;
      border-radius: 12px;
      background: white;
    }

    .mf-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 720px;
    }

    .mf-table thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 14px 16px;
      background: white;
      color: #5b6477;
      font-size: 12px;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #e9edf3;
    }

    .mf-table tbody td {
      padding: 13px 16px;
      border-bottom: 1px solid #edf1f5;
      font-size: 14px;
      vertical-align: top;
    }

    .mf-table tbody tr:nth-child(even) {
      background: #fcfcfb;
    }

    .mf-table tbody tr:last-child td {
      border-bottom: 0;
    }

    .mf-cell-strong {
      font-weight: 700;
      color: #1f2937;
    }

    .mf-empty {
      padding: 32px 18px;
      text-align: center;
    }

    .mf-not-found {
      display: grid;
      gap: 12px;
      padding: 32px 24px 40px;
      text-align: center;
    }

    .mf-not-found-title {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 800;
    }

    .mf-button-row {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    .mf-button,
    .mf-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 16px;
      border-radius: 999px;
      border: 1px solid var(--mf-line);
      background: white;
      color: #111827;
      text-decoration: none;
      cursor: pointer;
    }

    .mf-pill {
      min-height: 30px;
      padding: 0 12px;
      font-size: 12px;
      color: #475569;
      background: #f9fafb;
    }

    .mf-pill-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }

    .mf-split-columns {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 980px) {
      .mf-dialog-content {
        padding: 20px 20px 28px;
      }

      .mf-page-head,
      .mf-breakdown,
      .mf-split-columns,
      .mf-metric-grid,
      .mf-metric-grid.mf-metric-grid-two {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .mf-overlay {
        padding: 12px;
      }

      .mf-dialog {
        width: calc(100vw - 24px);
        max-height: calc(100vh - 24px);
        border-radius: 20px;
      }

      .mf-page-head {
        gap: 14px;
      }

      .mf-head-value {
        font-size: 1.4rem;
      }

      .mf-section {
        padding: 18px;
      }

      .mf-launcher {
        padding-inline: 18px;
      }
    }
  `;

  document.head.append(style);
  stylesInjected = true;
}

/**
 * Normalizes any incoming value to a clean string.
 *
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

/**
 * Creates a slug that is stable enough to use as a hash route id.
 *
 * @param {unknown} value
 * @returns {string}
 */
function slugify(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Converts loose numeric strings into numbers.
 * Empty, invalid or missing values become zero.
 *
 * @param {unknown} value
 * @returns {number}
 */
function toAmount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const text = cleanText(value);
  if (!text) {
    return 0;
  }

  const normalized = text.replace(/\s+/g, '').replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Returns a de-duplicated list of non-empty strings while preserving order.
 *
 * @param {unknown[]} values
 * @returns {string[]}
 */
function uniqueText(values) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    const text = cleanText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }

  return output;
}

/**
 * Picks the most common string value in a collection.
 * If there is a tie, the earliest seen value wins.
 *
 * @param {unknown[]} values
 * @returns {string}
 */
function mostCommonText(values) {
  /** @type {Map<string, {value: string, count: number, firstIndex: number}>} */
  const counts = new Map();

  values.forEach((value, index) => {
    const text = cleanText(value);
    if (!text) return;
    const key = text.toLowerCase();
    const entry = counts.get(key);
    if (entry) {
      entry.count += 1;
      return;
    }
    counts.set(key, { value: text, count: 1, firstIndex: index });
  });

  const ranked = Array.from(counts.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.firstIndex - right.firstIndex;
  });

  return ranked[0]?.value ?? '';
}

/**
 * Sums all numeric values produced by the accessor.
 *
 * @template T
 * @param {T[]} rows
 * @param {(row: T) => number} accessor
 * @returns {number}
 */
function sumBy(rows, accessor) {
  let total = 0;
  for (const row of rows) {
    total += accessor(row);
  }
  return total;
}

/**
 * Returns the number of unique non-empty values derived by the accessor.
 *
 * @template T
 * @param {T[]} rows
 * @param {(row: T) => unknown} accessor
 * @returns {number}
 */
function countUnique(rows, accessor) {
  const seen = new Set();
  for (const row of rows) {
    const text = cleanText(accessor(row));
    if (!text) continue;
    seen.add(text.toLowerCase());
  }
  return seen.size;
}

/**
 * Formats a number as a Panama-style Balboa amount.
 *
 * @param {number} value
 * @returns {string}
 */
function formatCurrency(value) {
  const amount = Number.isFinite(value) ? value : 0;
  const hasDecimals = Math.abs(amount % 1) > 0.001;
  const formatted = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(amount);
  return `B/.${formatted}`;
}

/**
 * Formats a positive integer for metric cards.
 *
 * @param {number} value
 * @returns {string}
 */
function formatInteger(value) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value);
}

/**
 * Returns a friendly label for singular/plural metadata blocks.
 *
 * @param {number} count
 * @param {string} singular
 * @param {string} plural
 * @returns {string}
 */
function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}

/**
 * Parses CSV text into objects.
 * Supports quoted values, escaped double quotes and multiline cells.
 *
 * @param {string} csvText
 * @returns {Record<string, string>[]}
 */
function parseCsvText(csvText) {
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(current);
      current = '';
      continue;
    }

    if (char === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    current += char;
  }

  row.push(current);
  rows.push(row);

  if (!rows.length) {
    return [];
  }

  const headers = rows.shift().map((header, index) => {
    const text = cleanText(header);
    return index === 0 ? text.replace(/^\uFEFF/, '') : text;
  });

  return rows
    .filter((values) => values.some((value) => cleanText(value) !== ''))
    .map((values) => {
      /** @type {Record<string, string>} */
      const record = {};
      headers.forEach((header, index) => {
        if (!header) return;
        record[header] = values[index] ?? '';
      });
      return record;
    });
}

/**
 * Loads both CSV files, parses them and optionally writes the results to
 * `window.documentosIngresos` and `window.documentosEgresos`.
 *
 * @param {CsvDatasetOptions} options
 * @returns {Promise<DatasetInput>}
 */
async function loadCsvDatasets(options) {
  const { ingresosUrl, egresosUrl, assignToWindow = true } = options;

  const [ingresosResponse, egresosResponse] = await Promise.all([fetch(ingresosUrl), fetch(egresosUrl)]);

  if (!ingresosResponse.ok) {
    throw new Error(`No se pudo cargar ingresos desde ${ingresosUrl}`);
  }

  if (!egresosResponse.ok) {
    throw new Error(`No se pudo cargar egresos desde ${egresosUrl}`);
  }

  const [ingresosText, egresosText] = await Promise.all([ingresosResponse.text(), egresosResponse.text()]);

  const ingresos = /** @type {IngresoRow[]} */ (parseCsvText(ingresosText));
  const egresos = /** @type {EgresoRow[]} */ (parseCsvText(egresosText));

  if (assignToWindow && typeof window !== 'undefined') {
    window.documentosIngresos = ingresos;
    window.documentosEgresos = egresos;
  }

  return { ingresos, egresos };
}

/**
 * Reads datasets from explicit options or from the window globals.
 *
 * @param {MountOptions} [options]
 * @returns {DatasetInput}
 */
function resolveDatasets(options = {}) {
  if (options.datasets) {
    return options.datasets;
  }

  if (typeof window === 'undefined') {
    throw new Error('No hay datasets disponibles fuera del navegador.');
  }

  const ingresos = Array.isArray(window.documentosIngresos) ? window.documentosIngresos : null;
  const egresos = Array.isArray(window.documentosEgresos) ? window.documentosEgresos : null;

  if (!ingresos || !egresos) {
    throw new Error(
      'Faltan window.documentosIngresos o window.documentosEgresos. Cárgalos antes de montar las fichas.',
    );
  }

  return {
    ingresos: /** @type {IngresoRow[]} */ (ingresos),
    egresos: /** @type {EgresoRow[]} */ (egresos),
  };
}

/**
 * Builds the routing and lookup store used by the UI.
 *
 * @param {DatasetInput} datasets
 * @returns {FichasStore}
 */
function buildStore(datasets) {
  const ingresos = Array.isArray(datasets.ingresos) ? datasets.ingresos : [];
  const egresos = Array.isArray(datasets.egresos) ? datasets.egresos : [];

  /** @type {Map<string, {ingresos: IngresoRow[], egresos: EgresoRow[]}>} */
  const candidateBuckets = new Map();
  /** @type {Map<string, {ingresos: IngresoRow[]}>} */
  const donorBuckets = new Map();
  /** @type {Map<string, {egresos: EgresoRow[]}>} */
  const providerBuckets = new Map();

  for (const row of ingresos) {
    const candidateId = slugify(row.candidateName);
    if (candidateId) {
      const candidate = ensureMapEntry(candidateBuckets, candidateId, () => ({ ingresos: [], egresos: [] }));
      candidate.ingresos.push(row);
    }

    const donorId = slugify(row.contribuyenteNombre);
    if (donorId) {
      const donor = ensureMapEntry(donorBuckets, donorId, () => ({ ingresos: [] }));
      donor.ingresos.push(row);
    }
  }

  for (const row of egresos) {
    const candidateId = slugify(row.candidateName);
    if (candidateId) {
      const candidate = ensureMapEntry(candidateBuckets, candidateId, () => ({ ingresos: [], egresos: [] }));
      candidate.egresos.push(row);
    }

    const providerId = slugify(row.proveedorNombre);
    if (providerId) {
      const provider = ensureMapEntry(providerBuckets, providerId, () => ({ egresos: [] }));
      provider.egresos.push(row);
    }
  }

  /** @type {CandidateEntity[]} */
  const candidates = Array.from(candidateBuckets.entries())
    .map(([id, bucket]) => finalizeCandidate(id, bucket))
    .sort((left, right) => right.ingresoTotal + right.egresoTotal - (left.ingresoTotal + left.egresoTotal));

  /** @type {DonorEntity[]} */
  const donors = Array.from(donorBuckets.entries())
    .map(([id, bucket]) => finalizeDonor(id, bucket))
    .sort((left, right) => right.total - left.total);

  /** @type {ProviderEntity[]} */
  const providers = Array.from(providerBuckets.entries())
    .map(([id, bucket]) => finalizeProvider(id, bucket))
    .sort((left, right) => right.total - left.total);

  return {
    ingresos,
    egresos,
    candidates,
    donors,
    providers,
    candidateById: new Map(candidates.map((item) => [item.id, item])),
    donorById: new Map(donors.map((item) => [item.id, item])),
    providerById: new Map(providers.map((item) => [item.id, item])),
  };
}

/**
 * Ensures a map entry exists and returns it.
 *
 * @template T
 * @param {Map<string, T>} map
 * @param {string} key
 * @param {() => T} create
 * @returns {T}
 */
function ensureMapEntry(map, key, create) {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const value = create();
  map.set(key, value);
  return value;
}

/**
 * Finalizes a candidate bucket into a UI-ready entity.
 *
 * @param {string} id
 * @param {{ingresos: IngresoRow[], egresos: EgresoRow[]}} bucket
 * @returns {CandidateEntity}
 */
function finalizeCandidate(id, bucket) {
  const ingresos = sortRowsByDate(bucket.ingresos, (row) => row.fecha, true);
  const egresos = sortRowsByDate(bucket.egresos, (row) => row.fecha, true);
  const allRows = [...ingresos, ...egresos];

  return {
    kind: 'candidato',
    id,
    name: mostCommonText(allRows.map((row) => row.candidateName)) || id,
    parties: uniqueText(allRows.map((row) => row.candidateParty)),
    positions: uniqueText(allRows.map((row) => row.candidatePosition)),
    provinces: uniqueText(allRows.map((row) => row.candidateProvince)),
    districts: uniqueText(allRows.map((row) => row.candidateDistrict)),
    ingresos,
    egresos,
    ingresoTotal: sumBy(ingresos, (row) => toAmount(row.total)),
    egresoTotal: sumBy(egresos, (row) => toAmount(row.totalDeGastosDePropagandaYCampania)),
    contributorCount: countUnique(ingresos, (row) => row.contribuyenteNombre),
    providerCount: countUnique(egresos, (row) => row.proveedorNombre),
  };
}

/**
 * Finalizes a donor bucket into a UI-ready entity.
 *
 * @param {string} id
 * @param {{ingresos: IngresoRow[]}} bucket
 * @returns {DonorEntity}
 */
function finalizeDonor(id, bucket) {
  const ingresos = sortRowsByDate(bucket.ingresos, (row) => row.fecha, true);
  return {
    kind: 'aportante',
    id,
    name: mostCommonText(ingresos.map((row) => row.contribuyenteNombre)) || id,
    parties: uniqueText(ingresos.map((row) => row.candidateParty)),
    positions: uniqueText(ingresos.map((row) => row.candidatePosition)),
    ingresos,
    total: sumBy(ingresos, (row) => toAmount(row.total)),
    candidateCount: countUnique(ingresos, (row) => row.candidateName),
  };
}

/**
 * Finalizes a provider bucket into a UI-ready entity.
 *
 * @param {string} id
 * @param {{egresos: EgresoRow[]}} bucket
 * @returns {ProviderEntity}
 */
function finalizeProvider(id, bucket) {
  const egresos = sortRowsByDate(bucket.egresos, (row) => row.fecha, true);
  return {
    kind: 'proveedor',
    id,
    name: mostCommonText(egresos.map((row) => row.proveedorNombre)) || id,
    parties: uniqueText(egresos.map((row) => row.candidateParty)),
    positions: uniqueText(egresos.map((row) => row.candidatePosition)),
    egresos,
    total: sumBy(egresos, (row) => toAmount(row.totalDeGastosDePropagandaYCampania)),
    candidateCount: countUnique(egresos, (row) => row.candidateName),
  };
}

/**
 * Sorts rows by date descending or ascending, falling back to the original value.
 *
 * @template T
 * @param {T[]} rows
 * @param {(row: T) => unknown} accessor
 * @param {boolean} [desc=false]
 * @returns {T[]}
 */
function sortRowsByDate(rows, accessor, desc = false) {
  return rows.slice().sort((left, right) => {
    const leftDate = parsePanamaDate(accessor(left));
    const rightDate = parsePanamaDate(accessor(right));

    if (leftDate && rightDate) {
      return desc ? rightDate.getTime() - leftDate.getTime() : leftDate.getTime() - rightDate.getTime();
    }

    if (leftDate) return desc ? -1 : 1;
    if (rightDate) return desc ? 1 : -1;

    const leftText = cleanText(accessor(left));
    const rightText = cleanText(accessor(right));
    return desc ? rightText.localeCompare(leftText) : leftText.localeCompare(rightText);
  });
}

/**
 * Parses dates from either the original CSV format (`28/abr/2024`, `04/05/2024`)
 * or the later autofixed ISO-like format (`2024-05-02`).
 * Invalid dates return null.
 *
 * @param {unknown} value
 * @returns {Date | null}
 */
function parsePanamaDate(value) {
  const text = cleanText(value);
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const date = new Date(year, month, day);
    if (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const match = text.match(/^(\d{1,2})\/(\d{1,2}|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\/(\d{4})$/i);
  if (!match) return null;

  const day = Number(match[1]);
  const monthText = match[2].toLowerCase();
  const year = Number(match[3]);

  const monthLookup = {
    ene: 0,
    feb: 1,
    mar: 2,
    abr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dic: 11,
  };

  const month = /^\d+$/.test(monthText)
    ? Number(monthText) - 1
    : monthLookup[/** @type {keyof typeof monthLookup} */ (monthText)];
  if (!Number.isInteger(month) || month < 0 || month > 11) return null;

  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Converts a hash string into a normalized route descriptor.
 *
 * Supported formats:
 * - `#/ficha/candidato/:id`
 * - `#/ficha/aportante/:id`
 * - `#/ficha/proveedor/:id`
 * - `#/candidato/:id`
 * - `#/aportante/:id`
 * - `#/proveedor/:id`
 *
 * @param {string} hash
 * @returns {HashRoute}
 */
function parseHashRoute(hash) {
  const raw = cleanText(hash).replace(/^#/, '');
  const parts = raw.split('/').filter(Boolean);

  if (!parts.length) {
    return { kind: 'none' };
  }

  if (parts[0] === 'ficha' && parts[1] && parts[2]) {
    const kind = parts[1];
    if (kind === 'candidato' || kind === 'aportante' || kind === 'proveedor') {
      return { kind, id: decodeURIComponent(parts.slice(2).join('/')) };
    }
  }

  if (parts[0] === 'candidato' || parts[0] === 'aportante' || parts[0] === 'proveedor') {
    if (parts[1]) {
      return { kind: parts[0], id: decodeURIComponent(parts.slice(1).join('/')) };
    }
  }

  if (raw === '/') {
    return { kind: 'none' };
  }

  return { kind: 'unknown', raw: hash };
}

/**
 * Builds a canonical hash route for one ficha type.
 *
 * @param {"candidato" | "aportante" | "proveedor"} kind
 * @param {string} id
 * @returns {string}
 */
function buildHashRoute(kind, id) {
  return `#/ficha/${kind}/${encodeURIComponent(id)}`;
}

/**
 * Resolves an entity from the store for a parsed route.
 *
 * @param {FichasStore} store
 * @param {HashRoute} route
 * @returns {CandidateEntity | DonorEntity | ProviderEntity | null}
 */
function resolveEntity(store, route) {
  if (!route.id) return null;
  if (route.kind === 'candidato') return store.candidateById.get(route.id) ?? null;
  if (route.kind === 'aportante') return store.donorById.get(route.id) ?? null;
  if (route.kind === 'proveedor') return store.providerById.get(route.id) ?? null;
  return null;
}

/**
 * Creates the contribution type breakdown from ingreso rows.
 * Empty series are removed from the result.
 *
 * @param {IngresoRow[]} rows
 * @returns {ChartDatum[]}
 */
function getContributionTypeBreakdown(rows) {
  return CONTRIBUTION_TYPES.map((definition) => ({
    id: definition.id,
    label: definition.label,
    color: definition.color,
    value: sumBy(rows, (row) => definition.getValue(row)),
  })).filter((item) => item.value > 0);
}

/**
 * Returns the non-empty contribution type labels present in a single row.
 *
 * @param {IngresoRow} row
 * @returns {string}
 */
function describeContributionRow(row) {
  const labels = CONTRIBUTION_TYPES.filter((definition) => definition.getValue(row) > 0).map(
    (definition) => definition.label,
  );
  return labels.join(' · ') || 'Sin clasificar';
}

/**
 * Groups ingreso rows by party using the `total` column.
 *
 * @param {IngresoRow[]} rows
 * @returns {ChartDatum[]}
 */
function getPartyBreakdown(rows) {
  /** @type {Map<string, number>} */
  const totals = new Map();

  for (const row of rows) {
    const label = cleanText(row.candidateParty) || 'Sin partido';
    totals.set(label, (totals.get(label) ?? 0) + toAmount(row.total));
  }

  return Array.from(totals.entries())
    .map(([label, value], index) => ({
      id: slugify(label) || `party-${index}`,
      label,
      value,
      color: BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length],
    }))
    .sort((left, right) => right.value - left.value);
}

/**
 * Groups egreso rows by `GastoCategoria` using the total campaign+propaganda amount.
 *
 * @param {EgresoRow[]} rows
 * @returns {ChartDatum[]}
 */
function getExpenseBreakdown(rows) {
  /** @type {Map<string, number>} */
  const totals = new Map();

  for (const row of rows) {
    const label = cleanText(row.GastoCategoria) || cleanText(row.detalleGastoResumido) || 'Sin categoría';
    totals.set(label, (totals.get(label) ?? 0) + toAmount(row.totalDeGastosDePropagandaYCampania));
  }

  return Array.from(totals.entries())
    .map(([label, value], index) => ({
      id: slugify(label) || `expense-${index}`,
      label,
      value,
      color: TREEMAP_COLORS[index % TREEMAP_COLORS.length],
    }))
    .sort((left, right) => right.value - left.value);
}

/**
 * Builds a daily timeline of egresos.
 * Invalid dates are skipped so malformed rows do not break the chart.
 *
 * @param {EgresoRow[]} rows
 * @returns {TimelinePoint[]}
 */
function getExpenseTimeline(rows) {
  /** @type {Map<string, TimelinePoint>} */
  const points = new Map();

  for (const row of rows) {
    const date = parsePanamaDate(row.fecha);
    if (!date) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const existing = points.get(key);
    const value = toAmount(row.totalDeGastosDePropagandaYCampania);

    if (existing) {
      existing.value += value;
      continue;
    }

    points.set(key, {
      key,
      label: formatShortDate(date),
      value,
      timestamp: date.getTime(),
    });
  }

  return Array.from(points.values()).sort((left, right) => left.timestamp - right.timestamp);
}

/**
 * Formats a date as `04 May` in Spanish-style short form.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatShortDate(date) {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}`;
}

/**
 * Returns the unique list of positions represented in a row collection.
 *
 * @template T extends {candidatePosition?: string}
 * @param {T[]} rows
 * @returns {Array<{id: string, label: string}>}
 */
function getPositionTabs(rows) {
  const positions = uniqueText(rows.map((row) => row.candidatePosition));
  return [{ id: 'total', label: 'Total' }, ...positions.map((label) => ({ id: label, label }))];
}

/**
 * Filters candidate-related rows by the currently selected position tab.
 *
 * @template T extends {candidatePosition?: string}
 * @param {T[]} rows
 * @param {string} tabId
 * @returns {T[]}
 */
function filterRowsByPosition(rows, tabId) {
  if (tabId === 'total') return rows;
  return rows.filter((row) => cleanText(row.candidatePosition) === tabId);
}

/**
 * Computes rectangles using a simple balanced binary treemap partitioning.
 *
 * @param {ChartDatum[]} items
 * @returns {Array<ChartDatum & {x: number, y: number, width: number, height: number}>}
 */
function computeTreemap(items) {
  const positive = items.filter((item) => item.value > 0);
  return layoutTreemap(positive, 0, 0, 100, 100);
}

/**
 * Recursive balanced treemap helper.
 *
 * @param {ChartDatum[]} items
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {Array<ChartDatum & {x: number, y: number, width: number, height: number}>}
 */
function layoutTreemap(items, x, y, width, height) {
  if (!items.length) return [];
  if (items.length === 1) {
    return [{ ...items[0], x, y, width, height }];
  }

  const total = sumBy(items, (item) => item.value);
  let leftTotal = 0;
  let splitIndex = 0;

  for (let index = 0; index < items.length; index += 1) {
    leftTotal += items[index].value;
    splitIndex = index + 1;
    if (leftTotal >= total / 2) break;
  }

  const firstGroup = items.slice(0, splitIndex);
  const secondGroup = items.slice(splitIndex);
  const firstRatio = leftTotal / total;

  if (width >= height) {
    const firstWidth = width * firstRatio;
    return [
      ...layoutTreemap(firstGroup, x, y, firstWidth, height),
      ...layoutTreemap(secondGroup, x + firstWidth, y, width - firstWidth, height),
    ];
  }

  const firstHeight = height * firstRatio;
  return [
    ...layoutTreemap(firstGroup, x, y, width, firstHeight),
    ...layoutTreemap(secondGroup, x, y + firstHeight, width, height - firstHeight),
  ];
}

/**
 * Resolves the target element used for mounting the app.
 * If no target is provided, one is appended to `document.body`.
 *
 * @param {string | Element | null | undefined} target
 * @returns {Element}
 */
function resolveTarget(target) {
  if (typeof document === 'undefined') {
    throw new Error('No se puede montar la interfaz fuera del navegador.');
  }

  if (typeof target === 'string') {
    const node = document.querySelector(target);
    if (!node) {
      throw new Error(`No se encontró el target: ${target}`);
    }
    return node;
  }

  if (target instanceof Element) {
    return target;
  }

  const root = document.createElement('div');
  root.setAttribute('data-fichas-root', 'true');
  document.body.append(root);
  return root;
}

/**
 * Mounts the app and returns small lifecycle helpers.
 *
 * @param {MountOptions} [options]
 * @returns {MountedApp}
 */
function mount(options = {}) {
  injectStyles();

  const target = resolveTarget(options.target);
  const store = options.store ?? buildStore(resolveDatasets(options));
  const showLauncher = options.showLauncher ?? Boolean(options.target);
  const emptyHash = options.emptyHash ?? '#/';

  const renderApp = () => {
    render(html`<${App} store=${store} showLauncher=${showLauncher} emptyHash=${emptyHash} />`, target);
  };

  renderApp();

  return {
    target,
    store,
    unmount() {
      render(null, target);
    },
    rerender() {
      renderApp();
    },
  };
}

/**
 * Reacts to location hash updates.
 *
 * @returns {HashRoute}
 */
function useHashRoute() {
  const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash : '');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return useMemo(() => parseHashRoute(hash), [hash]);
}

/**
 * Locks body scroll while a modal is visible.
 *
 * @param {boolean} active
 * @returns {void}
 */
function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/**
 * Global app shell.
 *
 * @param {{store: FichasStore, showLauncher: boolean, emptyHash: string}} props
 * @returns {import("preact").ComponentChildren}
 */
function App(props) {
  const route = useHashRoute();
  const entity = useMemo(() => resolveEntity(props.store, route), [props.store, route]);
  const hasModal =
    route.kind === 'candidato' || route.kind === 'aportante' || route.kind === 'proveedor' || route.kind === 'unknown';

  useBodyScrollLock(hasModal);

  useEffect(() => {
    if (!hasModal || typeof window === 'undefined') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        window.location.hash = props.emptyHash;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasModal, props.emptyHash]);

  return html`
    <div class="mf-app">
      ${props.showLauncher ? html`<${Launcher} store=${props.store} />` : null}
      <${ModalRouter} route=${route} entity=${entity} emptyHash=${props.emptyHash} />
    </div>
  `;
}

/**
 * Home/demo launcher shown when the modal script is embedded in the sample page.
 *
 * @param {{store: FichasStore}} props
 * @returns {import("preact").ComponentChildren}
 */
function Launcher(props) {
  return html`
    <div class="mf-launcher">
      <div class="mf-launcher-head">
        <div>
          <p class="mf-eyebrow">Fichas hash-routed</p>
          <h1 class="mf-launcher-title">Candidatos, aportantes y proveedores</h1>
          <p class="mf-launcher-copy">Abrí una ficha desde estas tarjetas o cambiá manualmente el hash en la URL.</p>
        </div>
        <div class="mf-help">
          Rutas soportadas: <code>#/ficha/candidato/:id</code>, <code>#/ficha/aportante/:id</code> y
          <code>#/ficha/proveedor/:id</code>.
        </div>
      </div>

      <${LauncherSection}
        title="Candidatos"
        items=${props.store.candidates.slice(0, 9).map((item) => ({
          kind: item.kind,
          id: item.id,
          title: item.name,
          amount: formatCurrency(item.ingresoTotal + item.egresoTotal),
          meta:
            [item.parties[0], item.positions[0]].filter(Boolean).join(' · ') ||
            `${formatInteger(item.contributorCount)} ${pluralize(item.contributorCount, 'aportante', 'aportantes')}`,
        }))}
      />

      <${LauncherSection}
        title="Aportantes"
        items=${props.store.donors.slice(0, 9).map((item) => ({
          kind: item.kind,
          id: item.id,
          title: item.name,
          amount: formatCurrency(item.total),
          meta: `${formatInteger(item.candidateCount)} ${pluralize(item.candidateCount, 'candidato', 'candidatos')}`,
        }))}
      />

      <${LauncherSection}
        title="Proveedores"
        items=${props.store.providers.slice(0, 9).map((item) => ({
          kind: item.kind,
          id: item.id,
          title: item.name,
          amount: formatCurrency(item.total),
          meta: `${formatInteger(item.candidateCount)} ${pluralize(item.candidateCount, 'candidato', 'candidatos')}`,
        }))}
      />
    </div>
  `;
}

/**
 * Section used by the launcher grid.
 *
 * @param {{title: string, items: Array<{kind: "candidato" | "aportante" | "proveedor", id: string, title: string, amount: string, meta: string}>}} props
 * @returns {import("preact").ComponentChildren}
 */
function LauncherSection(props) {
  return html`
    <section class="mf-launcher-section">
      <h2 class="mf-launcher-section-title">${props.title}</h2>
      <div class="mf-launcher-grid">
        ${props.items.map(
          (item) => html`
            <a class="mf-launcher-card" href=${buildHashRoute(item.kind, item.id)}>
              <div class="mf-launcher-card-title">${item.title}</div>
              <div class="mf-mini-meta">${item.meta}</div>
              <div class="mf-launcher-card-amount">${item.amount}</div>
            </a>
          `,
        )}
      </div>
    </section>
  `;
}

/**
 * Small router that decides which modal to show.
 *
 * @param {{route: HashRoute, entity: CandidateEntity | DonorEntity | ProviderEntity | null, emptyHash: string}} props
 * @returns {import("preact").ComponentChildren}
 */
function ModalRouter(props) {
  if (props.route.kind === 'none') {
    return null;
  }

  const close = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = props.emptyHash;
    }
  };

  if (props.route.kind === 'unknown') {
    return html`
      <${ModalShell} title="Ruta no soportada" onClose=${close}>
        <div class="mf-not-found">
          <h2 class="mf-not-found-title">No pude interpretar esta ruta</h2>
          <p class="mf-not-found-copy">
            Probá con <code>#/ficha/candidato/:id</code>, <code>#/ficha/aportante/:id</code> o
            <code>#/ficha/proveedor/:id</code>.
          </p>
          <div class="mf-button-row">
            <button class="mf-button" type="button" onClick=${close}>Cerrar</button>
          </div>
        </div>
      <//>
    `;
  }

  if (!props.entity) {
    return html`
      <${ModalShell} title="Ficha no encontrada" onClose=${close}>
        <div class="mf-not-found">
          <h2 class="mf-not-found-title">No encontré esa ficha</h2>
          <p class="mf-not-found-copy">Revisá el id del hash o abrí la ficha desde el launcher de ejemplo.</p>
          <div class="mf-button-row">
            <button class="mf-button" type="button" onClick=${close}>Cerrar</button>
          </div>
        </div>
      <//>
    `;
  }

  if (props.entity.kind === 'candidato') {
    return html`<${ModalShell} title=${props.entity.name} onClose=${close}
      ><${CandidateModal} entity=${props.entity}
    /><//>`;
  }

  if (props.entity.kind === 'aportante') {
    return html`<${ModalShell} title=${props.entity.name} onClose=${close}
      ><${DonorModal} entity=${props.entity}
    /><//>`;
  }

  return html`<${ModalShell} title=${props.entity.name} onClose=${close}
    ><${ProviderModal} entity=${props.entity}
  /><//>`;
}

/**
 * Shared modal chrome.
 *
 * @param {{title: string, onClose: () => void, children: import("preact").ComponentChildren}} props
 * @returns {import("preact").ComponentChildren}
 */
function ModalShell(props) {
  return html`
    <div class="mf-overlay" onClick=${(event) => event.target === event.currentTarget && props.onClose()}>
      <div class="mf-dialog" role="dialog" aria-modal="true" aria-label=${props.title}>
        <div class="mf-dialog-content">
          <div class="mf-close-row">
            <button class="mf-close" type="button" onClick=${props.onClose} aria-label="Cerrar ficha">×</button>
          </div>
          ${props.children}
        </div>
      </div>
    </div>
  `;
}

/**
 * Candidate ficha.
 *
 * @param {{entity: CandidateEntity}} props
 * @returns {import("preact").ComponentChildren}
 */
function CandidateModal(props) {
  const { entity } = props;
  const financing = useMemo(() => getContributionTypeBreakdown(entity.ingresos), [entity.ingresos]);
  const expenseTabs = useMemo(() => getPositionTabs(entity.egresos), [entity.egresos]);
  const [expenseTab, setExpenseTab] = useState('total');
  const filteredExpenses = useMemo(
    () => filterRowsByPosition(entity.egresos, expenseTab),
    [entity.egresos, expenseTab],
  );
  const expenseBreakdown = useMemo(() => getExpenseBreakdown(filteredExpenses), [filteredExpenses]);
  const timeline = useMemo(() => getExpenseTimeline(filteredExpenses), [filteredExpenses]);
  const context = [entity.provinces[0], entity.districts[0]].filter(Boolean).join(' · ');

  return html`
    <div>
      <${ProfileHeader}
        items=${[
          { label: 'Candidato', values: [entity.name] },
          { label: pluralize(entity.parties.length, 'Partido', 'Partidos'), values: entity.parties },
          { label: pluralize(entity.positions.length, 'Candidatura', 'Candidaturas'), values: entity.positions },
        ]}
        context=${context}
      />

      <div class="mf-metric-grid">
        <${MetricCard}
          icon="people"
          value=${formatInteger(entity.contributorCount)}
          label=${pluralize(entity.contributorCount, 'Aportante', 'Aportantes')}
        />
        <${MetricCard} icon="money" value=${formatCurrency(entity.ingresoTotal)} label="Ingresos totales" />
        <${MetricCard} icon="money" value=${formatCurrency(entity.egresoTotal)} label="Gastos totales" />
      </div>

      <${BreakdownSection}
        title="Financiación por tipo"
        items=${financing}
        total=${entity.ingresoTotal}
        emptyText="No hay ingresos clasificados para mostrar en esta ficha."
      />

      <${TableSection}
        title="Tabla de aportantes"
        columns=${[
          { header: 'Fecha', key: 'fecha' },
          { header: 'Aportante', key: 'aportante', strong: true },
          { header: 'Cédula / RUC', key: 'cedula' },
          { header: 'Tipo', key: 'tipo' },
          { header: 'Monto', key: 'monto' },
        ]}
        rows=${entity.ingresos.map((row) => ({
          fecha: cleanText(row.fecha) || '—',
          aportante: cleanText(row.contribuyenteNombre) || 'Sin nombre',
          cedula: cleanText(row.cedulaRuc) || '—',
          tipo: describeContributionRow(row),
          monto: formatCurrency(toAmount(row.total)),
        }))}
        emptyText="Este candidato no tiene aportes cargados."
      />

      <${TreemapSection}
        title="Tipo de gastos de campaña"
        tabs=${expenseTabs}
        activeTab=${expenseTab}
        onTabChange=${setExpenseTab}
        items=${expenseBreakdown}
        emptyText="No hay gastos clasificados para esta selección."
      />

      <${TimelineSection}
        title="Línea de tiempo de gastos"
        tabs=${expenseTabs}
        activeTab=${expenseTab}
        onTabChange=${setExpenseTab}
        points=${timeline}
        emptyText="No hay fechas válidas suficientes para dibujar la línea de tiempo."
      />

      <${TableSection}
        title="Tabla de gastos"
        columns=${[
          { header: 'Fecha', key: 'fecha' },
          { header: 'Proveedor', key: 'proveedor', strong: true },
          { header: 'Detalle', key: 'detalle' },
          { header: 'Categoría', key: 'categoria' },
          { header: 'Monto', key: 'monto' },
        ]}
        rows=${filteredExpenses.map((row) => ({
          fecha: cleanText(row.fecha) || '—',
          proveedor: cleanText(row.proveedorNombre) || 'Sin nombre',
          detalle: cleanText(row.detalleGastoResumido) || cleanText(row.detalleGasto) || '—',
          categoria: cleanText(row.GastoCategoria) || 'Sin categoría',
          monto: formatCurrency(toAmount(row.totalDeGastosDePropagandaYCampania)),
        }))}
        emptyText="Este candidato no tiene gastos cargados."
      />
    </div>
  `;
}

/**
 * Donor ficha.
 *
 * @param {{entity: DonorEntity}} props
 * @returns {import("preact").ComponentChildren}
 */
function DonorModal(props) {
  const { entity } = props;
  const byType = useMemo(() => getContributionTypeBreakdown(entity.ingresos), [entity.ingresos]);
  const byParty = useMemo(() => getPartyBreakdown(entity.ingresos), [entity.ingresos]);

  return html`
    <div>
      <${ProfileHeader}
        items=${[
          { label: 'Aportante', values: [entity.name] },
          { label: pluralize(entity.parties.length, 'Partido', 'Partidos'), values: entity.parties },
          { label: pluralize(entity.positions.length, 'Candidatura', 'Candidaturas'), values: entity.positions },
        ]}
      />

      <div class="mf-metric-grid mf-metric-grid-two">
        <${MetricCard}
          icon="people"
          value=${formatInteger(entity.candidateCount)}
          label=${pluralize(entity.candidateCount, 'Candidato', 'Candidatos')}
        />
        <${MetricCard} icon="money" value=${formatCurrency(entity.total)} label="Aportes totales" />
      </div>

      <${BreakdownSection}
        title="Aportes por tipo"
        items=${byType}
        total=${entity.total}
        emptyText="Este aportante no tiene aportes clasificados."
      />

      <${TableSection}
        title="Tabla de aportes"
        columns=${[
          { header: 'Fecha', key: 'fecha' },
          { header: 'Candidato', key: 'candidato', strong: true },
          { header: 'Partido', key: 'partido' },
          { header: 'Tipo', key: 'tipo' },
          { header: 'Monto', key: 'monto' },
        ]}
        rows=${entity.ingresos.map((row) => ({
          fecha: cleanText(row.fecha) || '—',
          candidato: cleanText(row.candidateName) || 'Sin nombre',
          partido: cleanText(row.candidateParty) || 'Sin partido',
          tipo: describeContributionRow(row),
          monto: formatCurrency(toAmount(row.total)),
        }))}
        emptyText="Este aportante no tiene registros cargados."
      />

      <${BreakdownSection}
        title="Aportes por partido"
        items=${byParty}
        total=${entity.total}
        emptyText="No hay partidos suficientes para desglosar los aportes."
      />
    </div>
  `;
}

/**
 * Provider ficha.
 *
 * @param {{entity: ProviderEntity}} props
 * @returns {import("preact").ComponentChildren}
 */
function ProviderModal(props) {
  const { entity } = props;
  const tabs = useMemo(() => getPositionTabs(entity.egresos), [entity.egresos]);
  const [tab, setTab] = useState('total');
  const rows = useMemo(() => filterRowsByPosition(entity.egresos, tab), [entity.egresos, tab]);
  const byCategory = useMemo(() => getExpenseBreakdown(rows), [rows]);

  return html`
    <div>
      <${ProfileHeader}
        items=${[
          { label: 'Proveedor', values: [entity.name] },
          { label: pluralize(entity.parties.length, 'Partido', 'Partidos'), values: entity.parties },
          { label: pluralize(entity.positions.length, 'Candidatura', 'Candidaturas'), values: entity.positions },
        ]}
      />

      <div class="mf-metric-grid mf-metric-grid-two">
        <${MetricCard}
          icon="people"
          value=${formatInteger(entity.candidateCount)}
          label=${pluralize(entity.candidateCount, 'Candidato', 'Candidatos')}
        />
        <${MetricCard} icon="money" value=${formatCurrency(entity.total)} label="Gastos totales" />
      </div>

      <${TreemapSection}
        title="Tipo de gastos de campaña"
        tabs=${tabs}
        activeTab=${tab}
        onTabChange=${setTab}
        items=${byCategory}
        emptyText="No hay gastos clasificados para esta selección."
      />

      <${TableSection}
        title="Tabla de gastos"
        columns=${[
          { header: 'Fecha', key: 'fecha' },
          { header: 'Candidato', key: 'candidato', strong: true },
          { header: 'Partido', key: 'partido' },
          { header: 'Categoría', key: 'categoria' },
          { header: 'Monto', key: 'monto' },
        ]}
        rows=${rows.map((row) => ({
          fecha: cleanText(row.fecha) || '—',
          candidato: cleanText(row.candidateName) || 'Sin nombre',
          partido: cleanText(row.candidateParty) || 'Sin partido',
          categoria: cleanText(row.GastoCategoria) || cleanText(row.detalleGastoResumido) || 'Sin categoría',
          monto: formatCurrency(toAmount(row.totalDeGastosDePropagandaYCampania)),
        }))}
        emptyText="Este proveedor no tiene gastos cargados."
      />
    </div>
  `;
}

/**
 * Large profile header shown at the top of each ficha.
 *
 * @param {{items: Array<{label: string, values: string[]}>, context?: string}} props
 * @returns {import("preact").ComponentChildren}
 */
function ProfileHeader(props) {
  return html`
    <div>
      <div class="mf-page-head">
        ${props.items.map(
          (item) => html`
            <div class="mf-head-cell">
              <p class="mf-head-label">${item.label}</p>
              <div class="mf-head-stack">
                ${(item.values.length ? item.values : ['—']).length > 1
                  ? html`
                      <ul class="mf-head-list">
                        ${(item.values.length ? item.values : ['—']).map(
                          (value) => html`<li><p class="mf-head-value">${value}</p></li>`,
                        )}
                      </ul>
                    `
                  : html`<p class="mf-head-value">${(item.values.length ? item.values : ['—'])[0]}</p>`}
              </div>
            </div>
          `,
        )}
      </div>
      ${props.context ? html`<p class="mf-context-line">${props.context}</p>` : null}
    </div>
  `;
}

/**
 * Metric summary card.
 *
 * @param {{icon: "people" | "money", value: string, label: string}} props
 * @returns {import("preact").ComponentChildren}
 */
function MetricCard(props) {
  return html`
    <div class="mf-metric-card">
      <div class="mf-metric-icon">${props.icon === 'people' ? html`<${PeopleIcon} />` : html`<${MoneyIcon} />`}</div>
      <p class="mf-metric-value">${props.value}</p>
      <p class="mf-metric-label">${props.label}</p>
    </div>
  `;
}

/**
 * Outline people icon matching the card style in the mockups.
 *
 * @returns {import("preact").ComponentChildren}
 */
function PeopleIcon() {
  return html`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"></path>
      <path d="M4 20a8 8 0 0 1 16 0"></path>
    </svg>
  `;
}

/**
 * Outline currency icon matching the card style in the mockups.
 *
 * @returns {import("preact").ComponentChildren}
 */
function MoneyIcon() {
  return html`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 2v20"></path>
      <path d="M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5S14.8 17 12 17s-5-1.6-5-3.5"></path>
    </svg>
  `;
}

/**
 * Shared donut + legend section.
 *
 * @param {{title: string, items: ChartDatum[], total: number, emptyText: string}} props
 * @returns {import("preact").ComponentChildren}
 */
function BreakdownSection(props) {
  return html`
    <section class="mf-section">
      <div class="mf-section-title-row">
        <h2 class="mf-section-title">${props.title}</h2>
      </div>
      ${props.items.length
        ? html`
            <div class="mf-breakdown">
              <div class="mf-donut-wrap">
                <${DonutChart} items=${props.items} total=${props.total} />
              </div>
              <${BarsLegend} items=${props.items} />
            </div>
          `
        : html`<div class="mf-empty">${props.emptyText}</div>`}
    </section>
  `;
}

/**
 * Progress-bar legend for breakdown sections.
 *
 * @param {{items: ChartDatum[]}} props
 * @returns {import("preact").ComponentChildren}
 */
function BarsLegend(props) {
  const maxValue = Math.max(...props.items.map((item) => item.value), 0);

  return html`
    <div class="mf-bars">
      ${props.items.map(
        (item) => html`
          <div class="mf-bar-row">
            <div class="mf-bar-head">
              <span class="mf-bar-label">${item.label}</span>
              <span class="mf-bar-value">${formatCurrency(item.value)}</span>
            </div>
            <div class="mf-track">
              <div
                class="mf-fill"
                style=${{ width: `${maxValue ? (item.value / maxValue) * 100 : 0}%`, background: item.color }}
              ></div>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

/**
 * Treemap section with optional tabs.
 *
 * @param {{title: string, tabs: Array<{id: string, label: string}>, activeTab: string, onTabChange: (tabId: string) => void, items: ChartDatum[], emptyText: string}} props
 * @returns {import("preact").ComponentChildren}
 */
function TreemapSection(props) {
  return html`
    <section class="mf-section">
      <div class="mf-section-title-row">
        <h2 class="mf-section-title">${props.title}</h2>
        ${props.tabs.length > 1
          ? html`<${Tabs} tabs=${props.tabs} activeTab=${props.activeTab} onChange=${props.onTabChange} />`
          : null}
      </div>
      ${props.items.length
        ? html`<${TreemapChart} items=${props.items} />`
        : html`<div class="mf-empty">${props.emptyText}</div>`}
    </section>
  `;
}

/**
 * Timeline section with optional tabs.
 *
 * @param {{title: string, tabs: Array<{id: string, label: string}>, activeTab: string, onTabChange: (tabId: string) => void, points: TimelinePoint[], emptyText: string}} props
 * @returns {import("preact").ComponentChildren}
 */
function TimelineSection(props) {
  return html`
    <section class="mf-section">
      <div class="mf-section-title-row">
        <h2 class="mf-section-title">${props.title}</h2>
        ${props.tabs.length > 1
          ? html`<${Tabs} tabs=${props.tabs} activeTab=${props.activeTab} onChange=${props.onTabChange} />`
          : null}
      </div>
      ${props.points.length >= 2
        ? html`<${LineChart} points=${props.points} />`
        : html`<div class="mf-empty">${props.emptyText}</div>`}
    </section>
  `;
}

/**
 * Shared tabs row.
 *
 * @param {{tabs: Array<{id: string, label: string}>, activeTab: string, onChange: (tabId: string) => void}} props
 * @returns {import("preact").ComponentChildren}
 */
function Tabs(props) {
  return html`
    <div class="mf-tabs" role="tablist">
      ${props.tabs.map(
        (tab) => html`
          <button
            class=${`mf-tab ${tab.id === props.activeTab ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected=${tab.id === props.activeTab}
            onClick=${() => props.onChange(tab.id)}
          >
            ${tab.label}
          </button>
        `,
      )}
    </div>
  `;
}

/**
 * Generic table section.
 *
 * @param {{title: string, columns: Array<{header: string, key: string, strong?: boolean}>, rows: Array<Record<string, string>>, emptyText: string}} props
 * @returns {import("preact").ComponentChildren}
 */
function TableSection(props) {
  return html`
    <section class="mf-section">
      <div class="mf-section-title-row">
        <h2 class="mf-section-title">${props.title}</h2>
      </div>
      ${props.rows.length
        ? html`
            <div class="mf-table-wrap">
              <table class="mf-table">
                <thead>
                  <tr>
                    ${props.columns.map((column) => html`<th>${column.header}</th>`)}
                  </tr>
                </thead>
                <tbody>
                  ${props.rows.map(
                    (row) => html`
                      <tr>
                        ${props.columns.map(
                          (column) => html`
                            <td class=${column.strong ? 'mf-cell-strong' : ''}>${row[column.key] ?? '—'}</td>
                          `,
                        )}
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            </div>
          `
        : html`<div class="mf-empty">${props.emptyText}</div>`}
    </section>
  `;
}

/**
 * Donut chart used by the funding breakdown sections.
 *
 * @param {{items: ChartDatum[], total: number}} props
 * @returns {import("preact").ComponentChildren}
 */
function DonutChart(props) {
  const displayTotal = props.total || sumBy(props.items, (item) => item.value);
  const visualTotal = sumBy(props.items, (item) => item.value) || displayTotal;
  const radius = 84;
  const stroke = 24;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return html`
    <svg class="mf-donut-svg" viewBox="0 0 240 240" aria-hidden="true">
      <circle cx="120" cy="120" r=${radius} fill="none" stroke="#EAF1F8" stroke-width=${stroke}></circle>
      ${props.items.map((item) => {
        const fraction = visualTotal ? item.value / visualTotal : 0;
        const segmentLength = circumference * fraction;
        const node = html`
          <circle
            cx="120"
            cy="120"
            r=${radius}
            fill="none"
            stroke=${item.color}
            stroke-width=${stroke}
            stroke-linecap="butt"
            stroke-dasharray=${`${segmentLength} ${circumference - segmentLength}`}
            stroke-dashoffset=${-offset}
            transform="rotate(-90 120 120)"
          ></circle>
        `;
        offset += segmentLength;
        return node;
      })}
      <circle cx="120" cy="120" r="56" fill="white"></circle>
      <text class="mf-donut-center-number" x="120" y="122">${formatCurrency(displayTotal)}</text>
      <text class="mf-donut-center-label" x="120" y="144">100%</text>
    </svg>
  `;
}

/**
 * Treemap chart component.
 *
 * @param {{items: ChartDatum[]}} props
 * @returns {import("preact").ComponentChildren}
 */
function TreemapChart(props) {
  const rectangles = computeTreemap(props.items);
  return html`
    <div class="mf-treemap">
      ${rectangles.map(
        (item) => html`
          <div
            class="mf-rect"
            style=${{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: `${item.width}%`,
              height: `${item.height}%`,
              background: item.color,
            }}
          >
            <div class="mf-rect-copy">
              <span class="mf-rect-title">${item.label}</span>
              <span class="mf-rect-value">${formatCurrency(item.value)}</span>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

/**
 * SVG line chart for the gastos timeline.
 *
 * @param {{points: TimelinePoint[]}} props
 * @returns {import("preact").ComponentChildren}
 */
function LineChart(props) {
  const width = 760;
  const height = 260;
  const padding = { top: 18, right: 26, bottom: 34, left: 20 };
  const minTime = props.points[0]?.timestamp ?? 0;
  const maxTime = props.points[props.points.length - 1]?.timestamp ?? minTime;
  const maxValue = Math.max(...props.points.map((point) => point.value), 0);

  const scaleX = (point, index) => {
    if (maxTime === minTime) {
      const innerWidth = width - padding.left - padding.right;
      return (
        padding.left + (props.points.length <= 1 ? innerWidth / 2 : (innerWidth / (props.points.length - 1)) * index)
      );
    }
    const ratio = (point.timestamp - minTime) / (maxTime - minTime);
    return padding.left + ratio * (width - padding.left - padding.right);
  };

  const scaleY = (value) => {
    if (!maxValue) return height - padding.bottom;
    const ratio = value / maxValue;
    return height - padding.bottom - ratio * (height - padding.top - padding.bottom);
  };

  const path = props.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point, index)} ${scaleY(point.value)}`)
    .join(' ');

  const areaPath = `${path} L ${scaleX(props.points[props.points.length - 1], props.points.length - 1)} ${height - padding.bottom} L ${scaleX(props.points[0], 0)} ${height - padding.bottom} Z`;
  const axisIndexes = uniqueAxisIndexes(props.points.length, 4);

  return html`
    <div class="mf-line-chart">
      <svg class="mf-line-svg" viewBox=${`0 0 ${width} ${height}`} aria-hidden="true">
        <path d=${areaPath} fill="rgba(47, 128, 237, 0.10)"></path>
        <path
          d=${path}
          fill="none"
          stroke="#1F1F1F"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
        ${props.points.map(
          (point, index) => html`
            <circle cx=${scaleX(point, index)} cy=${scaleY(point.value)} r="4" fill="#2F80ED"></circle>
          `,
        )}
        <line
          x1=${padding.left}
          y1=${height - padding.bottom}
          x2=${width - padding.right}
          y2=${height - padding.bottom}
          stroke="#D9E1EC"
        ></line>
        ${axisIndexes.map((index) => {
          const point = props.points[index];
          return html`
            <text class="mf-axis-label" x=${scaleX(point, index)} y=${height - 10} text-anchor="middle">
              ${point.label}
            </text>
          `;
        })}
      </svg>
    </div>
  `;
}

/**
 * Picks a small set of evenly spaced axis label indexes.
 *
 * @param {number} length
 * @param {number} desired
 * @returns {number[]}
 */
function uniqueAxisIndexes(length, desired) {
  if (length <= desired) {
    return Array.from({ length }, (_, index) => index);
  }

  const indexes = new Set([0, length - 1]);
  for (let step = 1; step < desired - 1; step += 1) {
    indexes.add(Math.round((step / (desired - 1)) * (length - 1)));
  }
  return Array.from(indexes).sort((left, right) => left - right);
}

/**
 * Prepares a small API surface for direct browser usage.
 *
 * @type {{mount: typeof mount, buildStore: typeof buildStore, loadCsvDatasets: typeof loadCsvDatasets, parseCsvText: typeof parseCsvText, parseHashRoute: typeof parseHashRoute, buildHashRoute: typeof buildHashRoute, slugify: typeof slugify}}
 */
const api = {
  mount,
  buildStore,
  loadCsvDatasets,
  parseCsvText,
  parseHashRoute,
  buildHashRoute,
  slugify,
};

if (typeof window !== 'undefined') {
  window.MonitoreoFichas = api;
}

export { buildHashRoute, buildStore, loadCsvDatasets, mount, parseCsvText, parseHashRoute, slugify };
