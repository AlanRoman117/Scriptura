/**
 * A minimal ZIP writer — store-only, no dependency.
 *
 * "Export All Notes" is the escape hatch that makes the data genuinely the
 * user's, so it should not rest on a third-party archiver. Notes are small
 * markdown files, so compression buys little; storing them uncompressed
 * (method 0) removes the need for a deflate implementation and leaves a format
 * that is short enough to audit against the spec.
 *
 * Verified against the system `unzip` in tests/unit/zip.test.ts — a ZIP that only our own
 * reader can open would defeat the purpose.
 */

export interface ZipEntry {
  /** Path within the archive, e.g. `notes/genesis.md`. */
  name: string;
  content: string;
}

/** CRC-32, table built once on first use. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time, which is what the format stores. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2)),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

class ByteWriter {
  private parts: Uint8Array[] = [];
  length = 0;

  push(bytes: Uint8Array) {
    this.parts.push(bytes);
    this.length += bytes.length;
  }

  u16(value: number) {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number) {
    this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ])
    );
  }

  toBlob(type: string): Blob {
    return new Blob(this.parts as BlobPart[], { type });
  }
}

/**
 * Build a `.zip` from text entries.
 *
 * Local file header + data for each entry, then a central directory, then the
 * end-of-central-directory record — the minimum a conforming reader needs.
 */
export function createZip(entries: ZipEntry[], now = new Date()): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const out = new ByteWriter();
  const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);
    const offset = out.length;

    out.u32(0x04034b50); // local file header signature
    out.u16(20); // version needed
    out.u16(0x0800); // flags: UTF-8 filenames
    out.u16(0); // method 0 = stored
    out.u16(time);
    out.u16(date);
    out.u32(crc);
    out.u32(data.length); // compressed size == uncompressed, stored
    out.u32(data.length);
    out.u16(name.length);
    out.u16(0); // extra field length
    out.push(name);
    out.push(data);

    central.push({ name, crc, size: data.length, offset });
  }

  const centralStart = out.length;
  for (const e of central) {
    out.u32(0x02014b50); // central directory header signature
    out.u16(20); // version made by
    out.u16(20); // version needed
    out.u16(0x0800);
    out.u16(0);
    out.u16(time);
    out.u16(date);
    out.u32(e.crc);
    out.u32(e.size);
    out.u32(e.size);
    out.u16(e.name.length);
    out.u16(0); // extra
    out.u16(0); // comment
    out.u16(0); // disk number
    out.u16(0); // internal attrs
    out.u32(0); // external attrs
    out.u32(e.offset);
    out.push(e.name);
  }

  const centralSize = out.length - centralStart;
  out.u32(0x06054b50); // end of central directory
  out.u16(0);
  out.u16(0);
  out.u16(central.length);
  out.u16(central.length);
  out.u32(centralSize);
  out.u32(centralStart);
  out.u16(0); // comment length

  return out.toBlob('application/zip');
}

/** Filesystem-safe name derived from a note title, without collapsing to empty. */
export function safeFilename(title: string, fallback: string): string {
  const cleaned = title
    .normalize('NFC')
    .replace(/[/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    // A title of only separators folds to "-", which is a filename but not a
    // useful one; strip the edges so it collapses to empty and takes the
    // fallback instead.
    .replace(/^[-\s]+|[-\s]+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}
