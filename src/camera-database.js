import { readFileSync } from 'node:fs';

export const cameraFields = JSON.parse(readFileSync(new URL('../data/camera-fields.json', import.meta.url)));
const models = JSON.parse(readFileSync(new URL('../data/camera-models.json', import.meta.url)));
const original = JSON.parse(readFileSync(new URL('../data/cameras.json', import.meta.url)));
const specifications = JSON.parse(readFileSync(new URL('../data/camera-specifications.json', import.meta.url)));
const researched = JSON.parse(readFileSync(new URL('../data/camera-researched-specifications.json', import.meta.url)));

export function buildCameraRecords() {
  const records = models.map(model => ({ ...model,
    specifications: Object.fromEntries(cameraFields.map(f => [f.key, {value:null, status:'unknown', source:null, checkedOn:null}])),
  }));
  const ids = new Set(records.map(c => c.id));
  if (ids.size !== records.length) throw new Error('Duplicate camera IDs');
  const claims = [...researched, ...original.map(c => ({id:c.id, source:c.source, checkedOn:c.checkedOn,
    values:Object.fromEntries(['sensorWidthMm','sensorHeightMm','widthPixels','heightPixels'].map(k => [k,c[k]]))})), ...specifications];
  for (const claim of claims) {
    const record = records.find(c => c.id === claim.id);
    if (!record) throw new Error(`Unknown camera: ${claim.id}`);
    if (!/^https:\/\//.test(claim.source) || !/^\d{4}-\d{2}-\d{2}$/.test(claim.checkedOn)) throw new Error('Claim needs source and date');
    for (const [key,value] of Object.entries(claim.values)) {
      const field = cameraFields.find(f => f.key === key);
      if (!field || typeof value !== field.kind || (field.kind === 'number' && (!Number.isFinite(value) || value <= 0))) throw new Error(`Invalid ${claim.id}.${key}`);
      record.specifications[key] = {value, status:'manufacturer', source:claim.source, checkedOn:claim.checkedOn,
        ...(claim.evidence?.[key] ? {evidence:claim.evidence[key],method:claim.method} : {})};
    }
  }
  return records.map(record => {
    const values = Object.fromEntries(Object.entries(record.specifications).map(([k,v]) => [k,v.value]));
    const knownFields = Object.values(record.specifications).filter(s => s.value !== null).length;
    const derived = {
      pixelPitchUm: values.sensorWidthMm && values.widthPixels ? +(values.sensorWidthMm * 1000 / values.widthPixels).toFixed(3) : null,
      sensorAreaMm2: values.sensorWidthMm && values.sensorHeightMm ? +(values.sensorWidthMm * values.sensorHeightMm).toFixed(2) : null,
      cropFactor: values.sensorWidthMm && values.sensorHeightMm ? +(Math.hypot(36,24) / Math.hypot(values.sensorWidthMm,values.sensorHeightMm)).toFixed(3) : null,
    };
    return {...record, knownFields, totalFields:cameraFields.length, coverage:knownFields ? 'partial' : 'awaiting research', derived,
      derivedBasis:'Geometric estimates from nominal sensor dimensions and uncropped full-size image dimensions; not measured pixel pitch or noise performance.'};
  });
}
