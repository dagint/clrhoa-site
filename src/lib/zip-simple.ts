/**
 * Minimal ZIP builder (stored/uncompressed only) for backup download.
 * No external deps; produces a valid ZIP that all OS unzip tools understand.
 */
export function buildZip(files: { name: string; data: string | Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: { local: Uint8Array; data: Uint8Array; name: string }[] = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const data = typeof f.data === 'string' ? encoder.encode(f.data) : f.data;
    const localLen = 30 + nameBytes.length;
    const local = new Uint8Array(localLen);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true); // signature
    v.setUint16(4, 10, true); // version
    v.setUint16(6, 0, true); // flags
    v.setUint16(8, 0, true); // stored
    v.setUint16(10, 0, true); // mod time
    v.setUint16(12, 0, true); // mod date
    v.setUint32(14, 0, true); // crc (0 for stored)
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0, true); // extra len
    local.set(nameBytes, 30);
    parts.push({ local, data, name: f.name });
    offset += localLen + data.length;
  }
  const centralStart = offset;
  const centralChunks: Uint8Array[] = [];
  let centralLen = 0;
  offset = 0;
  for (const p of parts) {
    const nameBytes = encoder.encode(p.name);
    const blockLen = 46 + nameBytes.length;
    const block = new Uint8Array(blockLen);
    const v = new DataView(block.buffer);
    v.setUint32(0, 0x02014b50, true); // central file header
    v.setUint16(4, 20, true);
    v.setUint16(6, 10, true);
    v.setUint16(8, 0, true);
    v.setUint16(10, 0, true);
    v.setUint16(12, 0, true);
    v.setUint32(14, 0, true);
    v.setUint32(18, p.data.length, true);
    v.setUint32(22, p.data.length, true);
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0, true);
    v.setUint16(30, 0, true);
    v.setUint16(32, 0, true);
    v.setUint32(34, 0, true);
    v.setUint32(38, offset, true);
    block.set(nameBytes, 46);
    centralChunks.push(block);
    centralLen += blockLen;
    offset += p.local.length + p.data.length;
  }
  const endLen = 22;
  const end = new Uint8Array(endLen);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, parts.length, true);
  endView.setUint16(10, parts.length, true);
  endView.setUint32(12, centralLen, true);
  endView.setUint32(16, centralStart, true);
  endView.setUint16(20, 0, true);
  const total =
    parts.reduce((s, p) => s + p.local.length + p.data.length, 0) + centralLen + endLen;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p.local, pos); pos += p.local.length;
    out.set(p.data, pos); pos += p.data.length;
  }
  for (const c of centralChunks) {
    out.set(c, pos); pos += c.length;
  }
  out.set(end, pos);
  return out;
}
