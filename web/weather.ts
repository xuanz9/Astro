export type Place = {id:number;name:string;latitude:number;longitude:number;country?:string;admin1?:string;timezone?:string};
export type Hour = {time:number;label:string;cloud:number|null;rain:number|null;temperature:number|null;humidity:number|null;wind:number|null;night:boolean|null};
export type Forecast = {timezone:string;fetchedAt:number;hours:Hour[]};
export function localStamp(seconds:number, timezone:string) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(seconds*1000));
  const p = Object.fromEntries(parts.map(v => [v.type,v.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
}
export function nightHours(hours:Hour[], date:string, now=Date.now()) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))) return [];
  const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate()+1);
  const end = `${next.toISOString().slice(0,10)}T06:00`;
  return hours.filter(h => h.label >= `${date}T18:00` && h.label <= end && h.time*1000 >= now);
}
async function jsonRequest(url:string, signal:AbortSignal) {
  const response = await fetch(url,{signal});
  if(!response.ok) throw new Error(response.status === 429 ? 'The weather service is busy. Please try again shortly.' : 'The weather service is unavailable. Please try again.');
  return response.json();
}
export async function searchPlaces(query:string, signal:AbortSignal):Promise<Place[]> {
  const params = new URLSearchParams({name:query.trim(),count:'8',language:'en',format:'json'});
  const data = await jsonRequest(`https://geocoding-api.open-meteo.com/v1/search?${params}`,signal);
  return (data.results || []).filter((p:Place) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
}
export async function getForecast(place:Place, signal:AbortSignal):Promise<Forecast> {
  const params = new URLSearchParams({latitude:String(place.latitude),longitude:String(place.longitude),hourly:'cloud_cover,precipitation_probability,temperature_2m,relative_humidity_2m,wind_speed_10m,is_day',timezone:'auto',forecast_days:'16',timeformat:'unixtime',wind_speed_unit:'kmh',temperature_unit:'celsius'});
  const data = await jsonRequest(`https://api.open-meteo.com/v1/forecast?${params}`,signal);
  if(!data.timezone || !Array.isArray(data.hourly?.time)) throw new Error('The weather service returned an incomplete forecast. Please try again.');
  const value = (key:string,i:number):number|null => {const v = data.hourly[key]?.[i]; return typeof v === 'number' && Number.isFinite(v) ? v : null;};
  return {timezone:data.timezone,fetchedAt:Date.now(),hours:data.hourly.time.map((time:number,i:number) => ({time,label:localStamp(time,data.timezone),cloud:value('cloud_cover',i),rain:value('precipitation_probability',i),temperature:value('temperature_2m',i),humidity:value('relative_humidity_2m',i),wind:value('wind_speed_10m',i),night:value('is_day',i) === null ? null : value('is_day',i) === 0}))};
}
