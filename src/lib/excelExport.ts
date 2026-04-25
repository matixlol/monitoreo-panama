const SHEETJS_MODULE_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';

type SheetJsModule = {
  read: (data: string, options: { type: 'string' }) => unknown;
  write: (workbook: unknown, options: { bookType: 'xlsx'; type: 'array' }) => ArrayBuffer;
};

async function loadSheetJs(): Promise<SheetJsModule> {
  return import(/* @vite-ignore */ SHEETJS_MODULE_URL) as Promise<SheetJsModule>;
}

export async function createXlsxBlobFromCsv(csv: string): Promise<Blob> {
  const XLSX = await loadSheetJs();
  const workbook = XLSX.read(csv, { type: 'string' });
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
