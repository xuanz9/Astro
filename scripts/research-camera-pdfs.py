"""Supplement exact-model HTML evidence with linked manufacturer specification PDFs."""
import concurrent.futures
import importlib.util
import io
import logging
logging.getLogger('pypdf').setLevel(logging.ERROR)
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from pypdf import PdfReader

spec=importlib.util.spec_from_file_location('research',Path(__file__).with_name('research-cameras.py'))
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
ROOT=r.ROOT
CACHE=ROOT/'local-data/research/pdfs';CACHE.mkdir(exist_ok=True)
manuals={v['id']:v.get('documents',[]) for v in json.loads((ROOT/'data/camera-manual-sources.json').read_text(encoding='utf-8'))}
report=json.loads((ROOT/'data/camera-research-review.json').read_text(encoding='utf-8'))

def inspect(item):
    urls=[]
    p=r.CACHE/(item['id']+'.html')
    if item['name'].startswith('Canon') and p.exists():
        s=p.read_text(encoding='utf-8')
        urls=[urllib.parse.urljoin(item['source'],u) for u in re.findall(r'href=["\x27]([^"\x27]+\.pdf)',s,re.I)]
    if item['name'].startswith('Fujifilm') and not item['values']:
        slug=item['name'].replace('Fujifilm ','').lower().replace('-','').replace(' ','')
        urls=[f'https://dl.fujifilm-x.com/support/manual/x/fujifilm_{slug}_manual_en.pdf']
    if item['id'] in manuals and manuals[item['id']]:urls=[manuals[item['id']][0][0]]
    claims=[]
    for url in urls:
        try:
            path=CACHE/(item['id']+'.pdf')
            if not path.exists():path.write_bytes(urllib.request.urlopen(url,timeout=20).read())
            reader=PdfReader(path)
            pages=[]
            for n,page in enumerate(reader.pages):
                if len(reader.pages)>60 and n<len(reader.pages)*.7:continue
                text=page.extract_text() or ''
                if (len(reader.pages)<45 or (n>len(reader.pages)*.6 and 'specifications' in r.norm(text) and len(text)>700)):
                    pages.append((n+1,text))
            if not pages:continue
            combined='\n'.join(t for n,t in pages)
            # Only a document containing this exact model's name is eligible.
            model=item['name'].split(' ',1)[1].split(' / ')[0]
            if r.norm(model.replace('OM-D ','').replace('PEN ','')) not in r.norm(' '.join((p.extract_text() or '') for p in reader.pages[:3])) and not item['name'].startswith('Canon'):continue
            values,evidence={},{}
            def put(k,value,page,text):
                if k not in values:values[k]=value;evidence[k]={'page':page,'text':r.clean(text)[:350]}
            for page,text in pages:
                flat=r.clean(text)
                # First sensor geometry and first full-resolution still pair in specification order.
                m=re.search(r'(?:Screen size|Image sensor size|Image sensor|Image size|Sensor size|Image pickup device)[\s\S]{0,130}?(\d{1,2}(?:\.\d+)?)\s*(?:mm)?\s*(?:\(H\))?\s*[x×]\s*(\d{1,2}(?:\.\d+)?)\s*mm',text,re.I)
                if m:
                    w,h=float(m[1]),float(m[2])
                    if 10<w<60 and 8<h<50:
                        put('sensorWidthMm',w,page,m[0]);put('sensorHeightMm',h,page,m[0])
                m=re.search(r'(?:Effective pixels[^\n]*?|Number of effective pixels[^\n]*?|effective pixels\s*\n)\s*(?:Max\.?\s*)?(?:approx\.?\s*)?(\d+(?:\.\d+)?)\s*(?:megapixels|million)',text,re.I)
                if m and 1<float(m[1])<200:put('effectiveMegapixels',float(m[1]),page,m[0])
                m=re.search(r'No\. of effective pixels\s*:?\s*Approx\.?\s*([\d,]+)\s*pixels',text,re.I)
                if m and ',' in m[1]:put('effectiveMegapixels',int(m[1].replace(',',''))/1e6,page,m[0])
                if re.search(r'(?:Recorded pixels|Pixels recorded|recording pixels|Image size|Still photo pixel|Image dimensions)',text,re.I):
                    start=re.search(r'(?:Recorded pixels|Pixels recorded|recording pixels|Image size|Still photo pixel|Image dimensions)',text,re.I).start()
                    section=text[start:start+8000]
                    m=re.search(r'([1-9]\d{3,4})\s*[x×]\s*([1-9]\d{3,4})',section)
                    if m and 1000<int(m[2])<=int(m[1])<15000 and int(m[1])/int(m[2])<2.2:
                        put('widthPixels',int(m[1]),page,m[0]);put('heightPixels',int(m[2]),page,m[0])
                m=re.search(r'Lens mount\s*:?\s*([^\n]{3,100})',text,re.I)
                if m:put('lensMount',r.clean(m[1]),page,m[0])
            if values:claims.append({'id':item['id'],'source':url,'checkedOn':'2026-10-17','values':values,'evidence':evidence,'documentPages':len(reader.pages)})
        except Exception as e:
            (CACHE/(item['id']+'.error.txt')).write_text(str(e),encoding='utf-8')
    return claims

all_claims=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for i,claims in enumerate(pool.map(inspect,report)):
        all_claims.extend(claims)
        if (i+1)%40==0:print(f'PDF review {i+1}/320; {len(all_claims)} profiles with extracted PDF facts',flush=True)
(ROOT/'data/camera-pdf-research-review.json').write_text(json.dumps(all_claims,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'{len(all_claims)} PDF profiles',flush=True)
