import {useEffect,useState} from 'react';
import {loadNearbyDarkAreas,type DarkArea} from './light-pollution';

export function NearbyDarkSky({latitude,longitude,onSelect}:{latitude:number;longitude:number;onSelect:(area:DarkArea)=>void}) {
  const [radius,setRadius]=useState(100);
  const [areas,setAreas]=useState<DarkArea[]>([]);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;setAreas([]);setStatus('loading');
    loadNearbyDarkAreas(latitude,longitude,radius).then(results=>{if(active){setAreas(results);setStatus('ready');}}).catch(()=>{if(active)setStatus('error');});
    return()=>{active=false;};
  },[latitude,longitude,radius,attempt]);
  return <section className="nearby-dark-sky" aria-label="Nearby dark-sky areas">
    <div className="weather-heading"><strong>Nearby dark-sky areas</strong></div>
    <label>Search distance<select value={radius} onChange={e=>setRadius(Number(e.target.value))}><option value={50}>Within 50 km</option><option value={100}>Within 100 km</option><option value={150}>Within 150 km</option></select></label>
    {status==='loading' && <p className="weather-note" role="status">Searching the light-pollution map around your location…</p>}
    {status==='error' && <p className="weather-note" role="status">The dark-sky search could not load. <button className="back" type="button" onClick={()=>setAttempt(n=>n+1)}>Try again</button></p>}
    {status==='ready' && !areas.length && <p className="weather-note" role="status">No dark-sky areas were found in the sampled map within {radius} km. Try a wider search. Locations outside atlas coverage cannot be searched.</p>}
    {areas.length>0 && <><p className="weather-note">Up to three nearby areas in the atlas’s dark-sky group. Distances are straight-line, not driving distances.</p><ol className="dark-area-list">{areas.map(area=><li key={`${area.latitude},${area.longitude}`}>
      <strong>{area.distanceKm} km {area.direction} · Dark-sky estimate</strong>
      <p className="weather-note">{area.latitude.toFixed(4)}, {area.longitude.toFixed(4)} · Atlas zone {area.zone}</p>
      <div className="dark-area-actions"><a href={`https://www.google.com/maps/search/?api=1&query=${area.latitude.toFixed(5)}%2C${area.longitude.toFixed(5)}`} target="_blank" rel="noreferrer">Open in Google Maps ↗</a><button className="back" type="button" onClick={()=>onSelect(area)}>Check weather here</button></div>
    </li>)}</ol></>}
    <p className="weather-note">These are sampled map areas, not verified parks or observing sites. Some may be water, private land, or inaccessible terrain. Check the map, public access, opening hours, and a safe place to stop before traveling. Clouds and Moonlight can still affect the sky.</p>
  </section>;
}
