// zip.mjs — writes a standard ZIP archive (deflate, UTF-8 names) without dependencies.
//
// Cross-platform replacement for `zip`/`ditto`/`Compress-Archive`. No ZIP64: an archive
// that could exceed 4 GiB is refused before the first byte is written, and a failed write
// removes the partial file. Verification reads through a file handle, so archives larger
// than Node's 2 GiB buffer limit can be checked.

import { closeSync, fstatSync, openSync, readdirSync, readFileSync, readSync, rmSync, statSync, writeSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function listFiles(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') continue;
    if (entry.isDirectory()) listFiles(full, base, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export const ZIP_LIMIT = 0xffffffff;

/**
 * Zips `sourceDir` into `zipPath`; entries are prefixed with the directory's own name,
 * so unpacking recreates the folder. Returns { files, bytes }.
 * `limit` (bytes) caps the archive size; the default is the ZIP format's 4 GiB.
 */
export function zipDirectory(sourceDir, zipPath, { limit = ZIP_LIMIT } = {}) {
  const rootName = path.basename(path.resolve(sourceDir));
  const files = listFiles(sourceDir).sort();
  // Worst case is stored data plus headers; refuse up front instead of failing halfway.
  const worstCase = files.reduce((sum, f) => sum + statSync(f).size + 2 * (46 + Buffer.byteLength(f)), 22);
  if (worstCase > (limit ?? ZIP_LIMIT)) {
    throw new Error(`archive would exceed ${Math.floor((limit ?? ZIP_LIMIT) / 1024 ** 2)} MB (ZIP64 not supported); zip the folder with another tool`);
  }
  const fd = openSync(zipPath, 'w');
  const central = [];
  let offset = 0;
  let failed = true;
  const write = (buf) => {
    writeSync(fd, buf);
    offset += buf.length;
  };
  try {
    for (const file of files) {
      const name = `${rootName}/${path.relative(sourceDir, file).split(path.sep).join('/')}`;
      const nameBuf = Buffer.from(name, 'utf8');
      const data = readFileSync(file);
      const crc = crc32(data);
      const deflated = zlib.deflateRawSync(data, { level: 6 });
      const useDeflate = deflated.length < data.length;
      const body = useDeflate ? deflated : data;
      const { time, day } = dosDateTime(statSync(file).mtime);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0800, 6);
      local.writeUInt16LE(useDeflate ? 8 : 0, 8);
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(day, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(body.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(nameBuf.length, 26);
      local.writeUInt16LE(0, 28);
      const headerOffset = offset;
      write(local);
      write(nameBuf);
      write(body);
      const entry = Buffer.alloc(46);
      entry.writeUInt32LE(0x02014b50, 0);
      entry.writeUInt16LE(0x031e, 4);
      entry.writeUInt16LE(20, 6);
      entry.writeUInt16LE(0x0800, 8);
      entry.writeUInt16LE(useDeflate ? 8 : 0, 10);
      entry.writeUInt16LE(time, 12);
      entry.writeUInt16LE(day, 14);
      entry.writeUInt32LE(crc, 16);
      entry.writeUInt32LE(body.length, 20);
      entry.writeUInt32LE(data.length, 24);
      entry.writeUInt16LE(nameBuf.length, 28);
      entry.writeUInt32LE((0o100644 << 16) >>> 0, 38);
      entry.writeUInt32LE(headerOffset, 42);
      central.push(Buffer.concat([entry, nameBuf]));
    }
    const centralStart = offset;
    for (const c of central) write(c);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(central.length, 8);
    end.writeUInt16LE(central.length, 10);
    end.writeUInt32LE(offset - centralStart, 12);
    end.writeUInt32LE(centralStart, 16);
    write(end);
    failed = false;
  } finally {
    closeSync(fd);
    if (failed) rmSync(zipPath, { force: true });
  }
  return { files: files.length, bytes: offset };
}

function readAt(fd, position, length) {
  const buf = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const n = readSync(fd, buf, read, length - read, position + read);
    if (n === 0) break;
    read += n;
  }
  return buf.subarray(0, read);
}

/**
 * Reads the central directory back through a file handle and checks every entry's CRC,
 * one entry in memory at a time: [{ name, size, crcOk }].
 */
export function listZip(zipPath) {
  const fd = openSync(zipPath, 'r');
  try {
    const size = fstatSync(fd).size;
    const tailLength = Math.min(size, 22 + 0xffff);
    const tail = readAt(fd, size - tailLength, tailLength);
    const endPos = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (endPos === -1) throw new Error('No end of central directory');
    const count = tail.readUInt16LE(endPos + 10);
    const centralSize = tail.readUInt32LE(endPos + 12);
    const centralStart = tail.readUInt32LE(endPos + 16);
    const cd = readAt(fd, centralStart, centralSize);
    const entries = [];
    let pos = 0;
    for (let i = 0; i < count; i++) {
      if (cd.readUInt32LE(pos) !== 0x02014b50) throw new Error('Corrupt central directory');
      const method = cd.readUInt16LE(pos + 10);
      const crc = cd.readUInt32LE(pos + 16);
      const compressed = cd.readUInt32LE(pos + 20);
      const entrySize = cd.readUInt32LE(pos + 24);
      const nameLen = cd.readUInt16LE(pos + 28);
      const extraLen = cd.readUInt16LE(pos + 30);
      const commentLen = cd.readUInt16LE(pos + 32);
      const localOffset = cd.readUInt32LE(pos + 42);
      const name = cd.subarray(pos + 46, pos + 46 + nameLen).toString('utf8');
      const local = readAt(fd, localOffset, 30);
      const dataStart = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      const raw = readAt(fd, dataStart, compressed);
      const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
      entries.push({ name, size: entrySize, crcOk: crc32(data) === crc && data.length === entrySize });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  } finally {
    closeSync(fd);
  }
}

/** { ok, entries } — every entry present and its CRC correct. */
export function verifyZip(zipPath) {
  const entries = listZip(zipPath);
  return { ok: entries.every((e) => e.crcOk), entries: entries.length };
}

