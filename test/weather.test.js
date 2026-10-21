import test from 'node:test';
import assert from 'node:assert/strict';
import {localStamp,nightHours,getForecast,searchPlaces} from '../web/weather.ts';
test('weather uses observing timezone and retains repeated DST hours',()=>{
  assert.equal(localStamp(Date.parse('2026-10-18T02:00:00Z')/1000,'America/Indiana/Indianapolis'),'2026-10-17T22:00');
  assert.equal(localStamp(Date.parse('2026-11-01T05:00:00Z')/1000,'America/New_York'),'2026-11-01T01:00');
  assert.equal(localStamp(Date.parse('2026-11-01T06:00:00Z')/1000,'America/New_York'),'2026-11-01T01:00');
});
test('night selection crosses midnight and excludes elapsed hours and invalid dates',()=>{
  const hours=['2026-12-31T17:00','2026-12-31T18:00','2027-01-01T00:00','2027-01-01T06:00','2027-01-01T07:00'].map((label,i)=>({label,time:100+i}));
  assert.equal(nightHours(hours,'2026-12-31',0).length,3);
  assert.equal(nightHours(hours,'2026-12-31',103000).length,1);
  assert.deepEqual(nightHours(hours,'',0),[]);
  assert.deepEqual(nightHours(hours,'2027-02-01',0),[]);
});
test('weather preserves missing readings and rejects service errors',async(t)=>{
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({timezone:'UTC',hourly:{time:[1792260000],cloud_cover:[null],is_day:[null]}})}));
  const result=await getForecast({latitude:0,longitude:0},new AbortController().signal);
  assert.equal(result.hours[0].cloud,null);
  assert.equal(result.hours[0].temperature,null);
  assert.equal(result.hours[0].night,null);
  globalThis.fetch=async()=>({ok:false,status:429});
  await assert.rejects(()=>searchPlaces('London',new AbortController().signal),/busy/);
});
