export type PollutionLevel = 'dark'|'moderate'|'heavy';
export const pollutionLabels:Record<PollutionLevel,string>={dark:'Dark sky',moderate:'Moderately light-polluted',heavy:'Heavily light-polluted'};
export const pollutionAdvice:Record<PollutionLevel,string>={
  dark:'A promising baseline for wide-field stars and the Milky Way. Check clouds, Moon brightness, and target visibility before heading out.',
  moderate:'Faint Milky Way detail may be harder to capture. Avoid nearby lights and try a darker direction or a darker observing site.',
  heavy:'Faint sky detail can be overwhelmed by artificial light. Consider a darker site for the Milky Way, or start with brighter stars and constellations.',
};
export type PollutionEstimate={level:PollutionLevel;zone:string;year:2025;latitude:number;longitude:number};
// Original PNG palette order: zone 0 is index 2, followed by 1a/1b at 0/1.
const zones=['1a','1b','0','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b'];
export function lookupPollution(buffer:ArrayBuffer,latitude:number,longitude:number):PollutionEstimate|null {
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||longitude < -180 || longitude >180 || latitude>75 || latitude<=-65) return null;
  const view=new DataView(buffer);
  if(view.byteLength<12 || view.getUint32(0,false)!==0x4c503235) throw new Error('Invalid light-pollution atlas');
  const width=view.getUint32(4,true),height=view.getUint32(8,true);
  if(width!==14400||height!==5600) throw new Error('Unexpected atlas dimensions');
  const base=12+(height+1)*4;
  if(view.byteLength<base) throw new Error('Incomplete atlas');
  const x=Math.floor(((longitude===180?-180:longitude)+180)*width/360);
  const y=Math.min(height-1,Math.floor((75-latitude)*height/140));
  const start=view.getUint32(12+y*4,true),end=view.getUint32(12+(y+1)*4,true);
  if(start>end || (end-start)%3 || base+end>view.byteLength) throw new Error('Invalid atlas row');
  let cursor=0;
  for(let i=base+start;i<base+end;i+=3) {
    const count=view.getUint16(i,true),palette=view.getUint8(i+2);
    if(!count||cursor+count>width||palette>=zones.length) throw new Error('Invalid atlas run');
    if(x<cursor+count) return {level:palette===2||palette<=6?'dark':palette<=10?'moderate':'heavy',zone:zones[palette],year:2025,latitude,longitude};
    cursor+=count;
  }
  throw new Error('Incomplete atlas row');
}
let atlas:Promise<ArrayBuffer>|null=null;
function loadAtlas():Promise<ArrayBuffer> {
  // Shared immutable local asset: no coordinates are sent to an external map service.
  if(!atlas) atlas=fetch('/data/light-pollution-2025.rle').then(async response=>{
    if(!response.ok) throw new Error('Light-pollution map could not load');return response.arrayBuffer();
  }).catch(error=>{atlas=null;throw error;});
  return atlas;
}
export function loadPollution(latitude:number,longitude:number):Promise<PollutionEstimate|null> {
  return loadAtlas().then(buffer=>lookupPollution(buffer,latitude,longitude));
}
export type DarkArea=PollutionEstimate & {distanceKm:number;direction:string};
const radians=Math.PI/180;
function destination(latitude:number,longitude:number,distanceKm:number,bearing:number) {
  const lat=latitude*radians,lon=longitude*radians,angle=distanceKm/6371,b=bearing*radians;
  const nextLat=Math.asin(Math.sin(lat)*Math.cos(angle)+Math.cos(lat)*Math.sin(angle)*Math.cos(b));
  const nextLon=lon+Math.atan2(Math.sin(b)*Math.sin(angle)*Math.cos(lat),Math.cos(angle)-Math.sin(lat)*Math.sin(nextLat));
  return {latitude:nextLat/radians,longitude:((nextLon/radians+540)%360)-180};
}
export function distanceKm(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}) {
  const lat=(b.latitude-a.latitude)*radians,lon=(b.longitude-a.longitude)*radians;
  const h=Math.sin(lat/2)**2+Math.cos(a.latitude*radians)*Math.cos(b.latitude*radians)*Math.sin(lon/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
// Sample rings, nearest first. These are map areas, not verified observing venues.
export function findNearbyDarkAreas(buffer:ArrayBuffer,latitude:number,longitude:number,radiusKm=100):DarkArea[] {
  const origin=lookupPollution(buffer,latitude,longitude);
  if(!origin || !Number.isFinite(radiusKm) || radiusKm<5 || radiusKm>150) return [];
  const results:DarkArea[]=[];
  for(let radius=5;radius<=radiusKm;radius+=5) {
    const samples=Math.ceil(2*Math.PI*radius/5);
    for(let i=0;i<samples;i++) {
      const bearing=i*360/samples,point=destination(latitude,longitude,radius,bearing);
      const estimate=lookupPollution(buffer,point.latitude,point.longitude);
      if(estimate?.level!=='dark' || results.some(p=>distanceKm(p,point)<15)) continue;
      // Reject isolated dark pixels: surrounding samples must also be in the dark group.
      if([0,90,180,270].some(b=>{const p=destination(point.latitude,point.longitude,3,b);return lookupPollution(buffer,p.latitude,p.longitude)?.level!=='dark';})) continue;
      results.push({...estimate,distanceKm:radius,direction:['N','NE','E','SE','S','SW','W','NW'][Math.round(bearing/45)%8]});
      if(results.length===3) return results;
    }
  }
  return results;
}
export function loadNearbyDarkAreas(latitude:number,longitude:number,radiusKm=100):Promise<DarkArea[]> {
  return loadAtlas().then(buffer=>findNearbyDarkAreas(buffer,latitude,longitude,radiusKm));
}
