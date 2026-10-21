import {mkdir,writeFile,rename} from 'node:fs/promises';
import {createFlickrClient,collectFlickr} from '../src/flickr.js';

try {
  const query=process.argv[2]??'milky way',limit=Number(process.argv[3]??25);
  const call=createFlickrClient(process.env.FLICKR_API_KEY);
  const sample=await collectFlickr(call,{query,limit});
  const folder=new URL('../local-data/flickr/',import.meta.url);
  await mkdir(folder,{recursive:true});
  const filename=`sample-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  const target=new URL(filename,folder),temp=new URL(`${filename}.tmp`,folder);
  await writeFile(temp,JSON.stringify(sample,null,2)+'\n',{flag:'wx'});
  await rename(temp,target);
  console.log(`Saved ${sample.records.length} metadata records; skipped ${sample.skipped.length}. File: local-data/flickr/${filename}`);
  console.log('These are unreviewed examples, not verified successful exposures. No photo files or GPS metadata downloaded.');
} catch(error) {console.error(error.message);process.exitCode=1;}
