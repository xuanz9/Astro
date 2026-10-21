import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCameraRecords, cameraFields } from '../src/camera-database.js';

const records = buildCameraRecords();
mkdirSync(new URL('../data/',import.meta.url), {recursive:true});
const db = new DatabaseSync(fileURLToPath(new URL('../data/cameras.sqlite',import.meta.url)));
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS cameras (id TEXT PRIMARY KEY, brand TEXT NOT NULL, model TEXT NOT NULL, name TEXT NOT NULL, coverage TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS fields (key TEXT PRIMARY KEY, label TEXT NOT NULL, unit TEXT, kind TEXT NOT NULL, help TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS specifications (camera_id TEXT REFERENCES cameras(id), field_key TEXT REFERENCES fields(key), value_json TEXT, status TEXT NOT NULL, source_url TEXT, checked_on TEXT, PRIMARY KEY(camera_id,field_key));
CREATE TABLE IF NOT EXISTS derived_geometry (camera_id TEXT PRIMARY KEY REFERENCES cameras(id), pixel_pitch_um REAL, sensor_area_mm2 REAL, crop_factor REAL, basis TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS source_evidence (camera_id TEXT, field_key TEXT, method TEXT, evidence_json TEXT NOT NULL, PRIMARY KEY(camera_id,field_key), FOREIGN KEY(camera_id,field_key) REFERENCES specifications(camera_id,field_key));
BEGIN; DELETE FROM source_evidence; DELETE FROM specifications; DELETE FROM derived_geometry; DELETE FROM cameras; DELETE FROM fields;`);
try {
  const putCamera = db.prepare('INSERT INTO cameras VALUES (?,?,?,?,?)');
  const putField = db.prepare('INSERT INTO fields VALUES (?,?,?,?,?)');
  const putSpec = db.prepare('INSERT INTO specifications VALUES (?,?,?,?,?,?)');
  const putDerived = db.prepare('INSERT INTO derived_geometry VALUES (?,?,?,?,?)');
  const putEvidence = db.prepare('INSERT INTO source_evidence VALUES (?,?,?,?)');
  for (const f of cameraFields) putField.run(f.key,f.label,f.unit,f.kind,f.help);
  for (const c of records) {
    putCamera.run(c.id,c.brand,c.model,c.name,c.coverage);
    for (const [key,s] of Object.entries(c.specifications)) {
      putSpec.run(c.id,key,s.value === null ? null : JSON.stringify(s.value),s.status,s.source,s.checkedOn);
      if(s.evidence) putEvidence.run(c.id,key,s.method??null,JSON.stringify(s.evidence));
    }
    putDerived.run(c.id,c.derived.pixelPitchUm,c.derived.sensorAreaMm2,c.derived.cropFactor,c.derivedBasis);
  }
  db.exec('COMMIT');
} catch(error) { db.exec('ROLLBACK'); throw error; } finally { db.close(); }
writeFileSync(new URL('../data/camera-database.json',import.meta.url), JSON.stringify(records,null,2)+'\n');
const basic=['effectiveMegapixels','sensorWidthMm','sensorHeightMm','widthPixels','heightPixels'];
const summary={models:records.length,modelsWithSourcedFacts:records.filter(c=>c.knownFields>0).length,
  modelsWithBasicImagingSpecs:records.filter(c=>basic.every(k=>c.specifications[k].value!==null)).length,
  sourcedFields:records.reduce((n,c)=>n+c.knownFields,0),totalFields:records.length*cameraFields.length,
  unresolved:records.filter(c=>!c.knownFields).map(c=>({id:c.id,name:c.name})),
  note:'Partial manufacturer research, not a complete measured-performance database. Unknown fields are not negative capability claims.'};
writeFileSync(new URL('../data/camera-research-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
const brands=[...new Set(records.map(c=>c.brand))];
const report=[
  '# Camera research coverage', '',
  'Research date: October 17, 2026. All information is background data; camera specifications are not displayed in the app.', '',
  `${summary.modelsWithSourcedFacts} of ${summary.models} models have source-backed facts. ${summary.modelsWithBasicImagingSpecs} models have all five core imaging fields: effective megapixels, physical sensor width and height, and full-size still-image width and height.`, '',
  `${summary.sourcedFields} of ${summary.totalFields} specification slots are populated. Every profile remains partial; no camera is labeled fully researched or assigned an invented low-light score.`, '',
  '| Brand | Models | With sourced facts | With all five core imaging fields |',
  '| --- | ---: | ---: | ---: |',
  ...brands.map(brand=>{const group=records.filter(c=>c.brand===brand);return `| ${brand} | ${group.length} | ${group.filter(c=>c.knownFields).length} | ${group.filter(c=>basic.every(k=>c.specifications[k].value!==null)).length} |`;}), '',
  '## Sources and remaining work', '',
  'Sources include manufacturer archives, model specification sheets, and instruction manuals. Where an older manufacturer document is only available through a mirror, its URL identifies the mirror. Existing curated values take precedence over extracted candidates. Table rows or PDF page references accompany imported evidence where available.', '',
  'Full-size image dimensions are checked against effective pixel count and sensor shape to avoid importing cropped, panorama, pixel-shift, or video output. Ambiguous extractions remain in the review file rather than being treated as verified facts.', '',
  'Research coverage is uneven: some cameras have many capabilities documented; a few have only one or two verified facts. Completing their remaining fields requires further source review. Noise curves, quantum efficiency, dark current, and full-well capacity require independent measurements with operating conditions, rather than assumptions based on ISO or megapixels.', '',
  'See data/camera-research-status.json for per-model gaps, data/camera-research-summary.json for totals, and data/cameras.sqlite for the usable background database.', '',
];
writeFileSync(new URL('../docs/camera-research-report.md',import.meta.url),report.join('\n'));
console.log(`${records.length} models; ${records.filter(c => c.knownFields).length} partially researched; ${cameraFields.length} specification fields. SQLite and web export updated.`);
