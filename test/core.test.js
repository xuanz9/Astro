import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cameras, findCamera, geometry, validateSession, recommend } from '../src/core.js';
import { extractMetadata, readFits, readJpeg, readTiff, normalizeMetadata } from '../src/metadata.js';

const session = JSON.parse(readFileSync(new URL('../examples/session.json', import.meta.url)));
test('camera aliases match exactly without confusing similar model names', () => {
  assert.equal(findCamera(' canon eos rebel t3i ').id, 'canon-600d');
  assert.equal(findCamera('Canon EOS 600'), null);
});
test('geometry agrees with independently calculated 1000mm field and scale', () => {
  const g = geometry(cameras[0], 1000);
  assert.ok(Math.abs(g.fieldWidthDeg - 1.2777) < 0.001);
  assert.ok(Math.abs(g.imageScaleArcsecPerPixel - 0.8873) < 0.001);
  assert.throws(() => geometry(cameras[0], 0));
});
test('no evidence produces no numerical exposure recommendation', () => {
  assert.equal(recommend(session).observedExposureSeconds, null);
});
test('incompatible conditions, optics, support, settings and bad outcomes are excluded', () => {
  for (const patch of [{mount:'tripod'}, {cameraId:'canon-60d'}, {target:'M42'}, {modified:true}, {filter:'Ha'}, {iso:1600}, {skyCondition:'unknown'}, {focalLengthMm:300}, {fNumber:5.6}, {outcome:{result:'trailing',usableFrames:27}}, {outcome:{result:'good',usableFrames:2}}]) {
    assert.equal(recommend(session, [{...session, ...patch}]).matchingSuccessfulSessions, 0);
  }
  assert.deepEqual(recommend(session, [session, {...session,exposureSeconds:90}]).observedExposureSeconds, {min:60,max:90});
});
test('outcome validation rejects impossible frame counts and nonfinite settings', () => {
  assert.throws(() => validateSession({...session,outcome:{result:'good',usableFrames:31}}));
  assert.throws(() => validateSession({...session,fNumber:Infinity}));
  assert.throws(() => validateSession({...session,frames:0}));
});
test('JSON metadata retains missing fields and does not expose private tags', () => {
  const result = extractMetadata(Buffer.from(JSON.stringify([{Model:'Canon EOS 600D',ExposureTime:'1/4',GPSLatitude:40,SerialNumber:'secret'}])), '.json');
  assert.equal(result.fields.exposureSeconds, 0.25);
  assert.equal(result.fields.iso, null);
  assert.ok(!JSON.stringify(result).includes('secret'));
  assert.ok(!JSON.stringify(result).includes('GPS'));
  assert.throws(() => extractMetadata(Buffer.from('[{},{}]'), '.json'));
  assert.equal(normalizeMetadata({GAIN:0}).fields.gain,0);
});
test('FITS parses quoted slashes, escaped quotes and exponent notation', () => {
  const cards = ["SIMPLE  =                    T", "INSTRUME= 'Camera / one''s' / comment", 'EXPTIME = 1.2D+02 / seconds', 'GAIN    = 0', 'END'];
  const b = Buffer.from(cards.map(c => c.padEnd(80)).join(''));
  const result = readFits(b);
  assert.equal(result.fields.cameraModel, "Camera / one's");
  assert.equal(result.fields.exposureSeconds,120);
  assert.equal(result.fields.gain,0);
  assert.throws(() => readFits(b.subarray(0,b.length-80)));
});
function tiff(order) {
  const b = Buffer.alloc(128), little = order === 'II'; b.write(order);
  const s = (p,v) => little ? b.writeUInt16LE(v,p) : b.writeUInt16BE(v,p);
  const l = (p,v) => little ? b.writeUInt32LE(v,p) : b.writeUInt32BE(v,p);
  s(2,42); l(4,8); s(8,2);
  s(10,0x110); s(12,2); l(14,15); l(18,80); b.write('Canon EOS 600D\0',80);
  s(22,0x8769); s(24,4); l(26,1); l(30,40);
  s(40,1); s(42,0x829a); s(44,5); l(46,1); l(50,100); l(100,1); l(104,4);
  return b;
}
test('little and big endian EXIF, including nested exposure rational', () => {
  for (const order of ['II','MM']) {
    const b = tiff(order);
    assert.equal(readTiff(b).fields.exposureSeconds,0.25);
    assert.equal(readTiff(b).fields.cameraModel,'Canon EOS 600D');
    const segment = Buffer.alloc(10); segment.writeUInt16BE(0xffd8); segment.writeUInt16BE(0xffe1,2); segment.writeUInt16BE(b.length+8,4); segment.write('Exif',6);
    const jpeg = Buffer.concat([segment,Buffer.alloc(2),b,Buffer.from([255,217])]);
    assert.equal(readJpeg(jpeg).fields.exposureSeconds,0.25);
    assert.throws(() => readTiff(b.subarray(0,30)));
  }
});
test('metadata-free and corrupt JPEGs fail safely', () => {
  assert.equal(readJpeg(Buffer.from([255,216,255,217,0,0])).fields.cameraModel,null);
  assert.throws(() => readJpeg(Buffer.from([255,216,255,225,255,255])));
  assert.throws(() => extractMetadata(Buffer.from('raw'), '.cr3'));
});
