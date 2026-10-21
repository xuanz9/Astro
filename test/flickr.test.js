import test from 'node:test';
import assert from 'node:assert/strict';
import {exifNumber,normalizeFlickr,collectFlickr,createFlickrClient} from '../src/flickr.js';

const license={id:'4',name:'CC BY',url:'https://creativecommons.org/licenses/by/2.0/'};
const photo={id:'123',owner:'abc@N01',ownername:'Photographer',title:'Test',license:'4',ispublic:1};
const exif={photo:{exif:[['Model','NIKON Z5'],['ExposureTime','1/2'],['FNumber','28/10'],['ISO','3200'],['FocalLength','24/1'],['GPSLatitude','40'],['SerialNumber','private']].map(([tag,value])=>({tag,raw:{_content:value}}))}};

test('Flickr capture fields retain fractions and exclude private EXIF and invented context',()=>{
  const record=normalizeFlickr(photo,exif,license,'2026-10-21');
  assert.equal(record.settings.exposureSeconds,0.5);
  assert.equal(record.settings.fNumber,2.8);
  assert.equal(record.settings.iso,3200);
  assert.equal(record.settings.lens,null);
  assert.equal(record.context.stacked,null);
  assert.equal(record.reviewRequired,true);
  assert.equal(record.outcome,'unknown');
  assert.ok(!JSON.stringify(record).includes('private'));
  assert.ok(!JSON.stringify(record).includes('GPS'));
  for(const value of ['1/0','0','unknown','ISO 3200','1/2 extra',null]) assert.equal(exifNumber(value),null);
});
test('Flickr sample skips inaccessible EXIF, empty fields and unsupported licenses',async()=>{
  const calls=[];
  const call=async(method,params)=>{
    calls.push({method,params});
    if(method.endsWith('getInfo')) return {licenses:{license:[license]}};
    if(method.endsWith('search')) return {photos:{photo:[photo,{...photo,id:'2'},{...photo,id:'3'},{...photo,id:'4',license:'0'}]}};
    if(params.photo_id==='2') throw Object.assign(new Error('denied'),{code:2});
    if(params.photo_id==='3') return {photo:{exif:[]}};
    return exif;
  };
  const result=await collectFlickr(call,{limit:4});
  assert.equal(result.records.length,1);
  assert.equal(result.skipped.length,3);
  assert.equal(calls.find(c=>c.method.endsWith('search')).params.license,'4');
  assert.ok(!calls.some(c=>c.params?.secret));
});
test('Flickr errors stop the import and never reveal credentials or provider error text',async()=>{
  assert.throws(()=>createFlickrClient(''),/not configured/);
  const client=createFlickrClient('test-key',{pause:async()=>{},fetchImpl:async()=>({ok:true,json:async()=>({stat:'fail',code:100,message:'test-key'})})});
  await assert.rejects(client('flickr.photos.search'),e=>e.code===100&&!e.message.includes('test-key'));
  await assert.rejects(collectFlickr(async()=>{throw new Error('unavailable');}),/unavailable/);
});
