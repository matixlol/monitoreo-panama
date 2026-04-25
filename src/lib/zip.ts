type ZipEntrySource = Blob | ArrayBuffer | Uint8Array | string;

export type ZipEntry = {
  name: string;
  data: ZipEntrySource;
};

const textEncoder = new TextEncoder();
let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }

  crcTable = table;
  return table;
}

function crc32(data: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value: number): Uint8Array {
  const output = new Uint8Array(2);
  const view = new DataView(output.buffer);
  view.setUint16(0, value, true);
  return output;
}

function uint32(value: number): Uint8Array {
  const output = new Uint8Array(4);
  const view = new DataView(output.buffer);
  view.setUint32(0, value, true);
  return output;
}

function concatChunks(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output as Uint8Array<ArrayBuffer>;
}

async function readEntryData(data: ZipEntrySource): Promise<Uint8Array> {
  if (typeof data === 'string') return textEncoder.encode(data);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(await data.arrayBuffer());
}

function makeLocalFileHeader(fileName: Uint8Array, crc: number, byteLength: number): Uint8Array {
  return concatChunks([
    uint32(0x04034b50),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(crc),
    uint32(byteLength),
    uint32(byteLength),
    uint16(fileName.byteLength),
    uint16(0),
    fileName,
  ]);
}

function makeCentralDirectoryHeader(
  fileName: Uint8Array,
  crc: number,
  byteLength: number,
  localHeaderOffset: number,
): Uint8Array {
  return concatChunks([
    uint32(0x02014b50),
    uint16(20),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(crc),
    uint32(byteLength),
    uint32(byteLength),
    uint16(fileName.byteLength),
    uint16(0),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(0),
    uint32(localHeaderOffset),
    fileName,
  ]);
}

function makeEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  return concatChunks([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entryCount),
    uint16(entryCount),
    uint32(centralDirectorySize),
    uint32(centralDirectoryOffset),
    uint16(0),
  ]);
}

export async function createZipBlob(entries: ZipEntry[]): Promise<Blob> {
  const fileChunks: Uint8Array[] = [];
  const centralDirectoryChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = textEncoder.encode(entry.name);
    const data = await readEntryData(entry.data);
    const checksum = crc32(data);
    const localHeader = makeLocalFileHeader(fileName, checksum, data.byteLength);

    fileChunks.push(localHeader, data);
    centralDirectoryChunks.push(makeCentralDirectoryHeader(fileName, checksum, data.byteLength, offset));
    offset += localHeader.byteLength + data.byteLength;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = concatChunks(centralDirectoryChunks);
  const endOfCentralDirectory = makeEndOfCentralDirectory(
    entries.length,
    centralDirectory.byteLength,
    centralDirectoryOffset,
  );

  const zipData = concatChunks([...fileChunks, centralDirectory, endOfCentralDirectory]);
  return new Blob([zipData], { type: 'application/zip' });
}
