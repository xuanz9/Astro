import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCameraRecords, cameraFields } from '../src/camera-database.js';
import { findCamera, geometry } from '../src/core.js';
test('all catalog models have field slots, and missing evidence remains unknown', () => {
  const records = buildCameraRecords();
  assert.equal(records.length,320);
  assert.equal(new Set(records.map(c => c.id)).size,320);
  for(const c of records) {
    assert.ok(c.knownFields > 0, `${c.id} needs at least one source-backed fact`);
    assert.equal(Object.keys(c.specifications).length,cameraFields.length);
    for(const s of Object.values(c.specifications)) {
      if(s.value === null) { assert.equal(s.status,'unknown'); assert.equal(s.source,null); }
      else { assert.match(s.source,/^https:\/\//); assert.match(s.checkedOn,/^\d{4}-\d{2}-\d{2}$/); }
    }
  }
});
test('derived geometry requires sourced dimensions and never implies measured noise', () => {
  const records = buildCameraRecords();
  assert.equal(records.find(c => c.id === 'nikon-d850').derived.pixelPitchUm,4.348);
  assert.equal(records.find(c => c.id === 'nikon-d850').specifications.readNoiseCurve.value,null);
  for(const c of records) {
    if(c.specifications.sensorWidthMm.value === null || c.specifications.widthPixels.value === null) assert.equal(c.derived.pixelPitchUm,null);
    if(c.specifications.sensorWidthMm.value === null || c.specifications.sensorHeightMm.value === null) assert.equal(c.derived.cropFactor,null);
  }
  assert.equal(geometry(findCamera('Nikon D850'),50).pixelSizeUm,4.348);
  assert.equal(findCamera('An unsupported camera'),null);
});
test('native resolution does not silently become a cropped or video frame',()=>{
  const records=buildCameraRecords();
  const gh5=records.find(c=>c.id==='panasonic-lumix-gh5');
  assert.equal(gh5.specifications.widthPixels.value,5184);
  assert.equal(gh5.specifications.heightPixels.value,3888);
  const s1=records.find(c=>c.id==='panasonic-lumix-s1');
  assert.equal(s1.specifications.widthPixels.value,6000);
  assert.equal(s1.specifications.heightPixels.value,4000);
});
