// Public metadata only; never retain the complete EXIF response (which can include GPS).
export function exifNumber(value) {
  const text=String(value??'').trim();
  const match=text.match(/^(?:f\/)?(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?(?:\s*(?:mm|s|sec|seconds))?$/i);
  if(!match) return null;
  const n=Number(match[1])/(match[2]?Number(match[2]):1);
  return Number.isFinite(n)&&n>0?n:null;
}
export function normalizeFlickr(photo,response,license,retrievedAt) {
  const tags=new Map((response?.photo?.exif??[]).map(e=>[String(e.tag),e.raw?._content]));
  const get=(...keys)=>keys.map(key=>tags.get(key)).find(value=>value!==undefined)??null;
  const str=value=>typeof value==='string'&&value.trim()?value.trim():null;
  return {
    source:'flickr',photoId:String(photo.id),sourceUrl:`https://www.flickr.com/photos/${encodeURIComponent(photo.owner)}/${encodeURIComponent(photo.id)}/`,
    title:photo.title??'',photographer:photo.ownername??photo.owner,ownerId:photo.owner,
    license:{id:String(license.id),name:license.name,url:license.url},retrievedAt,
    settings:{make:str(get('Make','271')),model:str(get('Model','272')),lens:str(get('LensModel','42036')),
      exposureSeconds:exifNumber(get('ExposureTime','33434')),fNumber:exifNumber(get('FNumber','33437')),
      iso:exifNumber(get('ISO','ISOSpeedRatings','PhotographicSensitivity','34855')),focalLengthMm:exifNumber(get('FocalLength','37386'))},
    context:{target:null,mount:null,frames:null,totalIntegrationSeconds:null,skyCondition:null,weather:null,stacked:null,modified:null},
    reviewRequired:true,outcome:'unknown',
  };
}
export function createFlickrClient(apiKey,{fetchImpl=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  if(!apiKey?.trim()) throw new Error('FLICKR_API_KEY is not configured. Add it to your local .env file.');
  return async function call(method,params={}) {
    const url=new URL('https://api.flickr.com/services/rest/');
    url.search=new URLSearchParams({method,api_key:apiKey,format:'json',nojsoncallback:'1',...params}).toString();
    await pause(500);
    let response;
    try {response=await fetchImpl(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'AstroPrototype/0.1 (public photo metadata research)'}});}
    catch {throw new Error('Flickr connection failed or timed out. No credentials were logged.');}
    if(!response.ok) throw new Error(`Flickr HTTP error ${response.status}.`);
    let data;
    try {data=await response.json();} catch {throw new Error('Flickr returned invalid JSON.');}
    if(data.stat!=='ok') {
      const error=new Error(`Flickr API error ${Number(data.code)||'unknown'} (see Flickr API documentation).`);
      error.code=Number(data.code);throw error;
    }
    return data;
  };
}
export async function collectFlickr(call,{query='milky way',limit=25}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>100) throw new Error('Sample size must be between 1 and 100.');
  if(!query.trim()||query.length>200) throw new Error('Provide a search query of 1–200 characters.');
  const licenseResponse=await call('flickr.photos.licenses.getInfo');
  // Small initial sample: CC BY and public-domain licenses, retaining exact attribution.
  const licenses=new Map(licenseResponse.licenses.license.filter(l=>['4','9','10'].includes(String(l.id))).map(l=>[String(l.id),l]));
  if(!licenses.size) throw new Error('No supported licenses returned by Flickr.');
  const search=await call('flickr.photos.search',{text:query,license:[...licenses.keys()].join(','),safe_search:'1',media:'photos',content_types:'0',sort:'relevance',extras:'license,owner_name',per_page:String(limit),page:'1'});
  const records=[],skipped=[];
  for(const photo of search.photos.photo.slice(0,limit)) {
    const license=licenses.get(String(photo.license));
    if(!license||Number(photo.ispublic)!==1) {skipped.push({photoId:String(photo.id),reason:'Not public or unsupported license'});continue;}
    try {
      const exif=await call('flickr.photos.getExif',{photo_id:String(photo.id)});
      const record=normalizeFlickr(photo,exif,license,new Date().toISOString());
      if(!Object.values(record.settings).some(v=>v!==null)) {skipped.push({photoId:String(photo.id),reason:'No usable capture metadata'});continue;}
      records.push(record);
    } catch(error) {
      if(error.code===1||error.code===2) skipped.push({photoId:String(photo.id),reason:'Photo or EXIF unavailable'});
      else throw error;
    }
  }
  return {schemaVersion:1,source:'flickr',query,fetchedAt:new Date().toISOString(),reviewRequired:true,records,skipped};
}
