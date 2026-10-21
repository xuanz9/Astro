import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lookupPollution,findNearbyDarkAreas,distanceKm} from '../web/light-pollution.ts';
const bytes=readFileSync(new URL('../public/data/light-pollution-2025.rle',import.meta.url));
const atlas=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
test('atlas gives geographic estimates rather than city-population guesses',()=>{
  assert.equal(lookupPollution(atlas,40.7128,-74.006).level,'heavy');
  assert.equal(lookupPollution(atlas,-24.627,-70.404).level,'dark');
  const city=lookupPollution(atlas,39.7684,-86.1581);
  assert.equal(city.year,2025);
  assert.ok(city.zone);
  assert.equal(city.latitude,39.7684);
});
test('unsupported coverage and invalid coordinates never turn into dark-sky claims',()=>{
  for(const [lat,lon] of [[85,0],[-70,0],[NaN,0],[0,Infinity],[0,181]])assert.equal(lookupPollution(atlas,lat,lon),null);
  assert.deepEqual(lookupPollution(atlas,0,180),{...lookupPollution(atlas,0,-180),longitude:180});
});
test('malformed or truncated atlas data fails explicitly',()=>{
  assert.throws(()=>lookupPollution(new ArrayBuffer(12),0,0),/Invalid/);
  assert.throws(()=>lookupPollution(atlas.slice(0,100),0,0),/Incomplete/);
});

test('nearby search returns separated dark areas in distance order within the selected radius',()=>{
  const origin={latitude:39.7684,longitude:-86.1581};
  const results=findNearbyDarkAreas(atlas,origin.latitude,origin.longitude,100);
  assert.equal(results.length,3);
  results.forEach((area,i)=>{
    assert.equal(lookupPollution(atlas,area.latitude,area.longitude).level,'dark');
    assert.ok(area.distanceKm>=5 && area.distanceKm<=100);
    assert.ok(Math.abs(distanceKm(origin,area)-area.distanceKm)<0.001);
    assert.ok(['N','NE','E','SE','S','SW','W','NW'].includes(area.direction));
    if(i) assert.ok(area.distanceKm>=results[i-1].distanceKm);
    results.slice(0,i).forEach(other=>assert.ok(distanceKm(other,area)>=15));
  });
});

test('nearby search handles unsupported coverage and small searches without invented results',()=>{
  assert.deepEqual(findNearbyDarkAreas(atlas,85,0),[]);
  assert.deepEqual(findNearbyDarkAreas(atlas,NaN,0),[]);
  assert.deepEqual(findNearbyDarkAreas(atlas,40.7128,-74.006,5),[]);
  assert.deepEqual(findNearbyDarkAreas(atlas,0,0,Infinity),[]);
  // Great-circle calculations remain valid across the international date line.
  assert.ok(distanceKm({latitude:0,longitude:179.9},{latitude:0,longitude:-179.9})<23);
});
