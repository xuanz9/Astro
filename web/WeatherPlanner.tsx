import {useCallback,useEffect,useRef,useState} from 'react';
import {getForecast,searchPlaces,nightHours,type Place,type Forecast} from './weather';
import {LightPollution} from './LightPollution';
import type {PollutionLevel} from './light-pollution';
export type PollutionAssessment={level:PollutionLevel|null;source:'map'|'manual'|'unknown';latitude:number;longitude:number;atlasYear:2025};
export function WeatherPlanner({date,onPlace,onPollution}:{date:string;onPlace:(name:string)=>void;onPollution:(assessment:PollutionAssessment|null)=>void}) {
  const [query,setQuery] = useState('');
  const [results,setResults] = useState<Place[]>([]);
  const [selected,setSelected] = useState<Place|null>(null);
  const [forecast,setForecast] = useState<Forecast|null>(null);
  const [searching,setSearching] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [refresh,setRefresh] = useState(0);
  const searchRef = useRef<AbortController|null>(null);
  useEffect(() => () => searchRef.current?.abort(),[]);
  useEffect(() => {
    setForecast(null); setError('');setLoading(false);
    if(!selected) return;
    const controller = new AbortController(); let active = true;
    const timer = setTimeout(() => controller.abort(),20000);
    setLoading(true);
    getForecast(selected,controller.signal).then(data => {if(active) setForecast(data);}).catch(e => {if(active) setError(e.name === 'AbortError' ? 'The forecast request timed out. Try again.' : 'Unable to load the forecast. Check your connection and try again.');}).finally(() => {clearTimeout(timer);if(active) setLoading(false);});
    return () => {active=false;clearTimeout(timer);controller.abort();};
  },[selected,refresh]);
  async function search() {
    searchRef.current?.abort(); const controller = new AbortController(); searchRef.current=controller;
    setSearching(true);setError('');setNotice('');setResults([]);
    const timer = setTimeout(() => controller.abort(),15000);
    try {const places = await searchPlaces(query,controller.signal);if(searchRef.current === controller) {setResults(places);setNotice(places.length ? 'Choose your observing location below.' : 'No matching places. Try a nearby town or a postal code.');}}
    catch(e) {if(searchRef.current === controller) setError('Place search could not connect. Please try again.');}
    finally {clearTimeout(timer);if(searchRef.current === controller) setSearching(false);}
  }
  const updatePollution=useCallback((level:PollutionLevel|null,source:'map'|'manual'|'unknown')=>{if(selected)onPollution({level,source,latitude:selected.latitude,longitude:selected.longitude,atlasYear:2025});},[selected,onPollution]);
  const hours = forecast ? nightHours(forecast.hours,date) : [];
  const label = (p:Place) => [...new Set([p.name,p.admin1,p.country].filter(Boolean))].join(', ');
  const show = (value:number|null,unit='') => value === null ? '—' : `${Math.round(value)}${unit}`;
  return <section className="weather-planner" aria-label="Observing weather"><label htmlFor="place-search">Town or observing location</label><div className="place-search"><input id="place-search" value={query} placeholder="Search a town or postal code" onKeyDown={e => {if(e.key === 'Enter') {e.preventDefault();if(query.trim().length >= 2) void search();}}} onChange={e => {searchRef.current?.abort();searchRef.current=null;setSearching(false);setQuery(e.target.value);setSelected(null);setForecast(null);setResults([]);setError('');setNotice('');onPlace('');onPollution(null);}}/><button type="button" className="primary" disabled={searching || query.trim().length < 2} onClick={search}>{searching ? 'Searching…' : 'Find place'}</button></div><p className="weather-note">Searches and selected coordinates are sent to Open-Meteo to get your forecast.</p>
    {notice && <p className="weather-note" role="status">{notice}</p>}{results.length > 0 && <ul className="place-results">{results.map(p => <li key={p.id}><button type="button" onClick={() => {setSelected(p);onPlace(label(p));setResults([]);setNotice('');setQuery(label(p));}}>{label(p)}</button></li>)}</ul>}
    {selected && <div className="weather-card"><div className="weather-heading"><strong>{label(selected)}</strong><button type="button" className="back" disabled={loading} onClick={() => setRefresh(n => n+1)}>Refresh forecast</button></div><LightPollution latitude={selected.latitude} longitude={selected.longitude} onChange={updatePollution} onSelectArea={area=>{const name=`Dark-sky area (${area.latitude.toFixed(4)}, ${area.longitude.toFixed(4)})`;setSelected({id:-1,name,latitude:area.latitude,longitude:area.longitude});setQuery(name);onPlace(name);onPollution(null);setResults([]);setNotice('Forecast location changed to the selected map area.');}}/>{loading && <p role="status">Loading live forecast…</p>}{forecast && <><p className="weather-note">Evening of {date} → next morning, 06:00 · {forecast.timezone}<br/>Retrieved {new Intl.DateTimeFormat(undefined,{timeZone:forecast.timezone,dateStyle:'medium',timeStyle:'short'}).format(forecast.fetchedAt)}. Times below are local to the observing location.</p>{hours.length ? <><div className="weather-table"><table><thead><tr><th>Local time</th><th>Cloud</th><th>Rain chance</th><th>Temp.</th><th>Humidity</th><th>Wind</th></tr></thead><tbody>{hours.map(h => <tr key={h.time}><th scope="row">{h.label.slice(5).replace('T',' ')}{h.night === false ? ' · daylight' : ''}</th><td>{show(h.cloud,'%')}</td><td>{show(h.rain,'%')}</td><td>{show(h.temperature,'°C')}</td><td>{show(h.humidity,'%')}</td><td>{show(h.wind,' km/h')}</td></tr>)}</tbody></table></div><p className="weather-note">Lower cloud cover leaves more sky visible. High humidity can mean dew on your lens. These are forecasts, not guaranteed conditions; “night” here does not mean astronomical darkness.</p></> : <p role="status">No upcoming evening hours are available for this date. Choose a night within the forecast range ({forecast.hours[0]?.label.slice(0,10)} to {forecast.hours.at(-1)?.label.slice(0,10)}). Past hours are excluded.</p>}{hours.length > 0 && hours.at(-1)!.label < `${new Date(new Date(`${date}T12:00:00Z`).getTime()+86400000).toISOString().slice(0,10)}T06:00` && <p className="weather-note">Only part of this night is available at the end of the forecast range.</p>}</> }</div>}
    {error && <p className="weather-error" role="alert">{error}</p>}<p className="weather-note">Weather: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Place data: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>. Moon and target visibility are not included yet. Light pollution is a separate map baseline, not an hourly forecast. You can continue without a forecast.</p>
  </section>;
}
