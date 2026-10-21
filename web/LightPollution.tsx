import {useEffect,useState} from 'react';
import {loadPollution,pollutionLabels,pollutionAdvice,type PollutionLevel,type PollutionEstimate} from './light-pollution';
import {NearbyDarkSky} from './NearbyDarkSky';
import type {DarkArea} from './light-pollution';
export function LightPollution({latitude,longitude,onChange,onSelectArea}:{latitude:number;longitude:number;onChange:(level:PollutionLevel|null,source:'map'|'manual'|'unknown')=>void;onSelectArea:(area:DarkArea)=>void}) {
  const [estimate,setEstimate]=useState<PollutionEstimate|null>(null);
  const [override,setOverride]=useState<PollutionLevel|''>('');
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;setStatus('loading');setEstimate(null);setOverride('');onChange(null,'unknown');
    loadPollution(latitude,longitude).then(result=>{if(active){setEstimate(result);setStatus('ready');onChange(result?.level??null,result?'map':'unknown');}}).catch(()=>{if(active)setStatus('error');});
    return()=>{active=false;};
  },[latitude,longitude,attempt,onChange]);
  const level=override || estimate?.level;
  return <div className="pollution-card"><div className="weather-heading"><strong>Light pollution</strong><span className="pollution-tag">Sky baseline</span></div>
    {status==='loading' && <p className="weather-note" role="status">Checking this location’s light-pollution map…</p>}
    {level && <><p className="pollution-level">{pollutionLabels[level]} <small>{override?'Your local assessment':'Map estimate'}</small></p><p className="weather-note">{pollutionAdvice[level]}</p></>}
    {!override && status==='ready' && !estimate && <p className="weather-note">This location is outside the map coverage (65°S–75°N). You can enter a local assessment below.</p>}
    {status==='error' && <p className="weather-note" role="status">The light-pollution map could not load. Weather still works. <button className="back" type="button" onClick={()=>setAttempt(n=>n+1)}>Try map again</button></p>}
    <label>Nearby lights / local assessment<select value={override} onChange={e=>{const next=e.target.value as PollutionLevel|'';setOverride(next);onChange(next||estimate?.level||null,next?'manual':estimate?'map':'unknown');}}><option value="">Use map estimate</option>{Object.entries(pollutionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><small>Choose a local assessment if streetlights or your exact shooting spot differ from the town center.</small></label>
    <p className="weather-note">{estimate && <>Atlas zone {estimate.zone} · </>}2025 satellite-based model by <a href="https://djlorenz.github.io/astronomy/lp/" target="_blank" rel="noreferrer">David Lorenz</a>. Approx. 0.025° map cells (up to 2.8 km north–south). These broad app categories describe modeled overhead skyglow, not measured conditions or a Bortle class. Moonlight is separate and is not included yet.</p>
    {status==='ready' && estimate && <NearbyDarkSky key={`${latitude},${longitude}`} latitude={latitude} longitude={longitude} onSelect={onSelectArea}/>}
  </div>;
}
