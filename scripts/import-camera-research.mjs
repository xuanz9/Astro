import {readFileSync,writeFileSync} from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL(`../data/${name}`,import.meta.url)));
const html = read('camera-research-review.json');
const pdf = read('camera-pdf-research-review.json');
const fields = read('camera-fields.json');
const models = read('camera-models.json');
const accepted=[], rejected=[];
for (const claim of [...html,...pdf]) {
  const values={}; const evidence={};
  for (const [key,value] of Object.entries(claim.values)) {
    const definition=fields.find(f=>f.key===key);
    if(!definition || typeof value !== definition.kind || !claim.evidence[key] || (typeof value==='number' && (!Number.isFinite(value)||value<=0))) {
      rejected.push({id:claim.id,key,reason:'Missing evidence or invalid type'});continue;
    }
    // Manufacturer tables occasionally start with cropped/video output. Do not import
    // dimensions that contradict the same source's sensor shape or effective pixels.
    const v=claim.values;
    if(['widthPixels','heightPixels'].includes(key) && v.widthPixels && v.heightPixels) {
      const mismatch=v.effectiveMegapixels && Math.abs(v.widthPixels*v.heightPixels/1e6-v.effectiveMegapixels)/v.effectiveMegapixels>.08;
      const aspect=v.sensorWidthMm && v.sensorHeightMm && Math.abs(v.widthPixels/v.heightPixels-v.sensorWidthMm/v.sensorHeightMm)/(v.sensorWidthMm/v.sensorHeightMm)>.06;
      if(mismatch||aspect){rejected.push({id:claim.id,key,reason:'Output dimensions need crop/aspect review'});continue;}
    }
    if(key==='lensMount' && /Lens mount.*Lens mount|mount.*mount/i.test(value)) {rejected.push({id:claim.id,key,reason:'Duplicated PDF text needs manual review'});continue;}
    values[key]=value;evidence[key]=claim.evidence[key];
  }
  if(Object.keys(values).length) accepted.push({id:claim.id,source:claim.source,checkedOn:claim.checkedOn,values,evidence,method:'manufacturer-source extraction; consistency checked',...(claim.sha256?{sha256:claim.sha256}:{})});
}
writeFileSync(new URL('../data/camera-researched-specifications.json',import.meta.url),JSON.stringify(accepted,null,2)+'\n');
const curated=read('camera-specifications.json');
const original=read('cameras.json').map(c=>({id:c.id,source:c.source,values:Object.fromEntries(['sensorWidthMm','sensorHeightMm','widthPixels','heightPixels'].map(k=>[k,c[k]]))}));
const status=models.map(model=>{
  const claims=[...accepted,...curated,...original].filter(c=>c.id===model.id);
  const source=html.find(c=>c.id===model.id);
  const keys=[...new Set(claims.flatMap(c=>Object.keys(c.values)))];
  return {id:model.id,name:model.name,researchDate:'2026-10-17',status:keys.length?'partial sourced data':'unresolved',sourcedFieldCount:keys.length,sources:[...new Set(claims.map(c=>c.source))],attemptedSource:source?.source??null,sourceOutcome:source?.outcome??'not located',missingFields:fields.map(f=>f.key).filter(k=>!keys.includes(k))};
});
writeFileSync(new URL('../data/camera-research-status.json',import.meta.url),JSON.stringify({models:status,rejectedExtractions:rejected},null,2)+'\n');
console.log(`${status.length} models investigated; ${status.filter(s=>s.sourcedFieldCount).length} with sourced facts; ${accepted.reduce((n,c)=>n+Object.keys(c.values).length,0)} accepted sourced claims; ${rejected.length} held for review.`);
