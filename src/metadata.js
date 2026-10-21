// Only capture fields are returned. GPS, author, serial numbers and paths are not retained.
function numeric(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  if (/^\d+(\.\d+)?\/\d+(\.\d+)?$/.test(v)) { const [a,b] = v.split('/').map(Number); return b ? a/b : null; }
  const n = Number(v); return v.trim() && Number.isFinite(n) ? n : null;
}
export function normalizeMetadata(tags) {
  const mapping = {
    cameraModel: ['Model', 'INSTRUME'], lens: ['LensModel', 'TELESCOP'],
    exposureSeconds: ['ExposureTime', 'EXPTIME', 'EXPOSURE'], iso: ['ISO', 'ISOSPEED'],
    gain: ['GAIN'], fNumber: ['FNumber', 'FOCRATIO'], focalLengthMm: ['FocalLength', 'FOCALLEN'],
    widthPixels: ['ExifImageWidth', 'ImageWidth', 'NAXIS1'], heightPixels: ['ExifImageHeight', 'ImageHeight', 'NAXIS2']
  };
  const result = {};
  for (const [field, keys] of Object.entries(mapping)) {
    const value = keys.map(k => tags[k]).find(v => v != null);
    result[field] = ['cameraModel', 'lens'].includes(field) ? (typeof value === 'string' ? value.trim() : null) : numeric(value);
    if (typeof result[field] === 'number' && (result[field] < 0 || (field !== 'gain' && result[field] === 0))) result[field] = null;
  }
  return { fields: result, missing: Object.keys(result).filter(k => result[k] == null), warnings: ['Metadata does not establish tracking, stacking, sky conditions, or image quality. Confirm imported settings before saving.'] };
}
export function readFits(buffer) {
  if (buffer.toString('ascii', 0, 9) !== 'SIMPLE  =') throw new Error('Not a primary FITS file.');
  const tags = {}; let ended = false;
  for (let offset = 0; offset + 80 <= buffer.length && offset < 1024 * 1024; offset += 80) {
    const card = buffer.toString('ascii', offset, offset + 80), key = card.slice(0, 8).trim();
    if (key === 'END') { ended = true; break; }
    if (card[8] !== '=') continue;
    const raw = card.slice(10).trim();
    if (raw.startsWith("'")) {
      const match = raw.match(/^'((?:[^']|'')*)'/);
      if (match) tags[key] = match[1].replaceAll("''", "'").trim();
    } else tags[key] = raw.split('/')[0].trim().replace(/[dD]/, 'E');
  }
  if (!ended) throw new Error('FITS header is truncated or larger than 1 MiB.');
  return normalizeMetadata(tags);
}
export function readJpeg(buffer) {
  if (buffer.readUInt16BE(0) !== 0xffd8) throw new Error('Not a JPEG file.');
  for (let p = 2; p + 4 <= buffer.length;) {
    if (buffer[p] !== 0xff) throw new Error('Invalid JPEG marker.');
    const marker = buffer[p + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = buffer.readUInt16BE(p + 2);
    if (length < 2 || p + length + 2 > buffer.length) throw new Error('Truncated JPEG segment.');
    if (marker === 0xe1 && buffer.toString('ascii', p + 4, p + 10) === 'Exif\0\0') return readTiff(buffer.subarray(p + 10, p + 2 + length));
    p += length + 2;
  }
  return normalizeMetadata({});
}
export function readTiff(b) {
  const order = b.toString('ascii', 0, 2);
  if (!['II', 'MM'].includes(order)) throw new Error('Invalid TIFF byte order.');
  const check = (p, n) => { if (p < 0 || p + n > b.length) throw new Error('Truncated EXIF data.'); };
  const u16 = p => { check(p,2); return order === 'II' ? b.readUInt16LE(p) : b.readUInt16BE(p); };
  const u32 = p => { check(p,4); return order === 'II' ? b.readUInt32LE(p) : b.readUInt32BE(p); };
  if (u16(2) !== 42) throw new Error('Unsupported TIFF format.');
  const names = { 0x110:'Model', 0x100:'ImageWidth', 0x101:'ImageHeight', 0x829a:'ExposureTime', 0x829d:'FNumber', 0x8827:'ISO', 0x920a:'FocalLength', 0xa002:'ExifImageWidth', 0xa003:'ExifImageHeight', 0xa434:'LensModel' };
  const tags = {}, visited = new Set();
  function directory(offset) {
    if (visited.has(offset) || visited.size >= 4) throw new Error('Invalid EXIF directory chain.');
    visited.add(offset);
    const count = u16(offset); check(offset + 2, count * 12);
    for (let i = 0; i < count; i++) {
      const p = offset + 2 + i * 12, tag = u16(p), type = u16(p+2), n = u32(p+4);
      if (tag === 0x8769) { directory(u32(p+8)); continue; }
      if (!names[tag]) continue;
      const size = {2:1,3:2,4:4,5:8}[type]; if (!size || !n) continue;
      const start = size * n <= 4 ? p+8 : u32(p+8); check(start, size*n);
      if (type === 2) tags[names[tag]] = b.toString('utf8', start, start+n).replace(/\0+$/, '');
      else if (type === 3) tags[names[tag]] = u16(start);
      else if (type === 4) tags[names[tag]] = u32(start);
      else tags[names[tag]] = u32(start+4) ? u32(start)/u32(start+4) : null;
    }
  }
  directory(u32(4)); return normalizeMetadata(tags);
}
export function extractMetadata(buffer, extension) {
  if (buffer.length > 64 * 1024 * 1024) throw new Error('Maximum import size is 64 MiB.');
  if (['.fit', '.fits', '.fts'].includes(extension)) return readFits(buffer);
  if (['.jpg', '.jpeg'].includes(extension)) return readJpeg(buffer);
  if (['.tif', '.tiff'].includes(extension)) return readTiff(buffer);
  if (extension === '.json') {
    const data = JSON.parse(buffer.toString());
    if (Array.isArray(data) && data.length !== 1) throw new Error('Import one photo metadata record at a time.');
    const tags = Array.isArray(data) ? data[0] : data;
    if (!tags || typeof tags !== 'object') throw new Error('Expected a metadata object.');
    return normalizeMetadata(tags);
  }
  throw new Error('Use JPEG, TIFF, FITS, or an ExifTool JSON export. Proprietary RAW files are not supported directly yet.');
}
