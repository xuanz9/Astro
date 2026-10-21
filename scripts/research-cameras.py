"""Collect conservative manufacturer facts. Unknowns remain unknown; no quality scores.
HTML evidence stays in ignored local-data; compact per-field evidence is tracked.
Run with Python 3.11+. Downloads use only named manufacturer hosts.
"""
import concurrent.futures
import hashlib
import html
import json
import re
import time
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'local-data/research/pages'
CACHE.mkdir(parents=True, exist_ok=True)
MODELS = json.loads((ROOT / 'data/camera-models.json').read_text(encoding='utf-8'))
CANON = json.loads((ROOT / 'data/camera-source-index.json').read_text(encoding='utf-8'))
OVERRIDES = json.loads((ROOT / 'data/camera-source-overrides.json').read_text(encoding='utf-8'))

def clean(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', html.unescape(re.sub('<[^>]+>', ' ', text)))).strip()

def norm(text):
    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFKC', text).lower())

def url_for(c):
    b, m = c['brand'], c['model']
    if c['id'] in OVERRIDES:return OVERRIDES[c['id']]
    if b == 'Canon':
        name = m.split(' / ')[0]
        if m == 'EOS Rebel T6 / 1300D': name = 'EOS Rebel T6'
        if ' / ' in m and 'Rebel' in m: name = 'EOS ' + m.split(' / ')[1]
        if m == 'EOS 300D / Digital Rebel': name = 'EOS Digital Rebel'
        if ' / Rebel X' in m: name = 'EOS Digital ' + m.split(' / ')[1]
        if m == 'EOS Rebel T6 / 1300D':name = 'EOS Rebel T6'
        if m in ['EOS 5DS','EOS 5DS R']:name = 'EOS 5DS / EOS 5DS R'
        return next((u for title,u in CANON.items() if norm(title) == norm(name)), None)
    if b == 'Nikon':
        mirror = m.startswith('Z')
        slug = m.lower().replace(' ', '_')
        if slug in ['z5ii','z6ii','z7ii','z50ii']: slug = slug.replace('ii','_2')
        if slug == 'z6iii': slug = 'z6_3'
        if slug == 'zf': slug = 'z_f'
        return f'https://nij.nikon.com/products/lineup/{"mirrorless" if mirror else "slr"}/{slug}/spec.html'
    if b == 'Sony':
        name = m.replace('Alpha ', '')
        codes = {'7':'ILCE-7','7 II':'ILCE-7M2','7 III':'ILCE-7M3','7 IV':'ILCE-7M4',
          '7R':'ILCE-7R','7R II':'ILCE-7RM2','7R III':'ILCE-7RM3','7R IV':'ILCE-7RM4','7R V':'ILCE-7RM5',
          '7S':'ILCE-7S','7S II':'ILCE-7SM2','7S III':'ILCE-7SM3','7C':'ILCE-7C','7C II':'ILCE-7CM2','7CR':'ILCE-7CR',
          '9':'ILCE-9','9 II':'ILCE-9M2','9 III':'ILCE-9M3','1':'ILCE-1','1 II':'ILCE-1M2',
          '55':'SLT-A55V','65':'SLT-A65V','77':'SLT-A77V','99':'SLT-A99V','NEX-3':'NEX-3A','NEX-5':'NEX-5A','77 II':'ILCA-77M2','99 II':'ILCA-99M2','68':'ILCA-68'}
        code = codes.get(name)
        if not code:
            if name.startswith('NEX-'): code = name
            elif name.isdigit(): code = ('ILCE-' if int(name)>=5000 else 'DSLR-A' if int(name)>=100 else 'SLT-A')+name
        return f'https://www.sony.jp/ichigan/products/{code}/spec.html' if code else None
    if b == 'Fujifilm':
        slug = m.lower().replace(' ', '_')
        if m.startswith('GFX'):slug=m.lower().replace(' ','').replace('ii','_ii')
        return f'https://fujifilm-dsc.com/en-int/manual/{slug}/technical_notes/spec/index.html'
    if b == 'Pentax':
        overrides = {'*ist D':'digital/ist-d','*ist DS':'digital/ist-ds','*ist DL':'digital/ist-dl',
          'K100D':'digital/k100d','K100D Super':'digital/k100d-super','K110D':'digital/k110d',
          'K10D':'digital/k10d','K20D':'digital/k20d','K200D':'digital/k200d','K-m / K2000':'digital/k-m',
          'K-7':'digital/k-7','K-1 Mark II':'k-1-2','K-3 II':'k-3-2','K-3 Mark III':'k-3-3',
          'K-5 II':'k-5-2','K-5 IIs':'k-5-2'}
        slug = overrides.get(m,m.lower())
        return f'https://www.ricoh-imaging.co.jp/english/products/{slug}/spec.html' if slug.startswith('digital/') or slug in ['k-5','k-r','k-x','645d'] else f'https://www.ricoh-imaging.co.jp/english/products/{slug}/spec/'
    if b == 'Panasonic':
        name = m.replace('LUMIX ','')
        codes = {'G80 / G85':'DMC-G8','G90 / G95':'DC-G99','GX80 / GX85':'DMC-GX7MK2',
          'GH5 II':'DC-GH5M2','G9':'DC-G9','G9 II':'DC-G9M2','GX9':'DC-GX7MK3','S5 II':'DC-S5M2','S5 IIX':'DC-S5M2X'}
        code = codes.get(name)
        if not code: code = ('DC-' if name.startswith('S') or name in ['GH5','GH5S','GH6','GH7'] else 'DMC-')+name
        return f'https://panasonic.jp/dc/products/{code}/spec.html'
    if b == 'Olympus':
        slug = m.replace('OM-D ','').replace('PEN ','').replace(' Mark II','mk2').replace(' Mark III','mk3').replace(' Mark IV','mk4').replace('-','').replace(' ','').lower()
        return f'https://om-digitalsolutions.cn/product/dslr/{slug}/spec.html'
    if b == 'OM SYSTEM':
        slug = m.lower().replace(' mark ii','mk2').replace('-','')
        return f'https://jp.omsystem.com/product/dslr/om-omd/om/{slug}/spec.html'

def rows_from(text):
    rows=[]
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>',text,re.S|re.I):
        cells = [clean(v) for v in re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>',row,re.S|re.I)]
        cells = [v for v in cells if v]
        if len(cells)>=2: rows.append((cells[-2],cells[-1]))
    return rows

def extract(rows):
    values, evidence = {}, {}
    def put(k,v,key,text):
        if k not in values: values[k]=v; evidence[k]={'heading':key,'text':text[:650]}
    for key,text in rows:
        k=key.lower()
        # Physical sensor dimensions, not overall body measurements or nominal formats.
        if re.search(r'image sensor|sensor size|撮像素子|传感器尺寸|センサーサイズ|撮像画面サイズ|撮像画面|撮像素子サイズ',k):
            match=re.search(r'(\d{1,2}(?:\.\d+)?)\s*(?:mm)?\s*[×x]\s*(\d{1,2}(?:\.\d+)?)\s*(?:\(mm\)|mm)?',text,re.I)
            if match and ('mm' in text.lower() or 'Size:' in text) and 10 < float(match[1]) < 60 and 8 < float(match[2]) < 50:
                put('sensorWidthMm',float(match[1]),key,text);put('sensorHeightMm',float(match[2]),key,text)
            for token in ['CCD','CMOS','Live MOS']:
                if token.lower() in text.lower():put('sensorType',token,key,text);break
        if re.search(r'effective.*pixel|有効画素数|カメラ有効|^像素$',k):
            match=re.search(r'(\d[\d,]*(?:\.\d+)?)\s*(megapixels|million|万)',text,re.I)
            if match:
                n=float(match[1].replace(',',''))/(100 if match[2]=='万' else 1)
                if 1 < n < 200:put('effectiveMegapixels',n,key,text)
        if not re.search(r'movie|動画|视频',k) and re.search(r'recorded pixels|recording pixels|image size|image dimensions|記録画素数|記録サイズ|记录尺寸|画像サイズ',k):
            # Choose a native-resolution still pair, excluding panorama/composite sizes.
            pairs=[(int(m[1].replace(',','')),int(m[2].replace(',',''))) for m in re.finditer(r'([1-9][\d,]{3,5})\s*[×x]\s*([1-9][\d,]{3,5})',text)]
            pairs=[(w,h) for w,h in pairs if 1000<=h<=w<=15000 and w/h<2.2]
            mp=values.get('effectiveMegapixels')
            if mp:pairs=[(w,h) for w,h in pairs if w*h/1e6<=mp*1.06]
            sw,sh=values.get('sensorWidthMm'),values.get('sensorHeightMm')
            if sw and sh:pairs=[(w,h) for w,h in pairs if abs(w/h-sw/sh)/(sw/sh)<.06]
            if pairs:
                w,h=max(pairs,key=lambda p:p[0]*p[1])
                put('widthPixels',w,key,text);put('heightPixels',h,key,text)
        if k == 'type' and re.fullmatch(r'(?:Primary color filter, )?(?:CMOS|CCD)(?: sensor)?\.?',text,re.I): put('sensorType','CCD' if 'CCD' in text else 'CMOS',key,text)
        if re.search(r'^lens mount$|レンズマウント|镜头卡口',k):
            put('lensMount',text[:180],key,text)
        if re.search(r'file format|image type|recording format|画像ファイル形式|記録形式|文件格式',k) and 'RAW' in text and not re.search(r'not supported|非対応',text,re.I):
            put('rawSupport',True,key,text)
            put('rawModes',text[:450],key,text)
            bit=re.search(r'(1[246])\s*(?:-?bit|ビット|位)',text,re.I)
            if bit:put('rawBitDepths',bit[1]+' bits (mode restrictions may apply)',key,text)
        if re.search(r'shutter speed|シャッタースピード|快门速度',k):
            put('exposureModeNotes',text[:600],key,text)
            if re.search(r'bulb|バルブ|B门|B快门',text,re.I):put('bulbSupport',True,key,text)
        if k == 'sensitivity' and 'Standard output sensitivity' in text:
            m=re.search(r'Standard output sensitivity[^;]{0,70}?ISO\s*(\d[\d,]*)\s*[–—-]\s*(\d[\d,]*)',text,re.I)
            if m:
                lo,hi=int(m[1].replace(',','')),int(m[2].replace(',',''))
                if 20<=lo<hi<=1000000:put('isoMin',lo,key,text);put('isoMax',hi,key,text)
        if re.search(r'^live view$|^实时取景$',k) and not re.search(r'not|不可|なし|无',text,re.I):put('liveView',True,key,text)
        if re.search(r'^interval timer$|^interval shooting$|^インターバルタイマー撮影$',k) and re.search(r'possible|settable|yes|interval|可能',text,re.I):put('intervalometer',True,key,text)
    return values,evidence

def research(c):
    url=url_for(c)
    result={'id':c['id'],'name':c['name'],'source':url,'checkedOn':'2026-10-17','values':{},'evidence':{}}
    if not url:result['outcome']='source not located';return result
    path=CACHE/(c['id']+'.html')
    try:
        if path.exists():text=path.read_text(encoding='utf-8');final=url
        else:
            req=urllib.request.Request(url,headers={})
            with urllib.request.urlopen(req,timeout=18) as response:
                data=response.read(5_000_000); final=response.url
                encoding=response.headers.get_content_charset() or ''
                charset=re.search(br'charset\s*=\s*["\x27]?([\w-]+)',data[:10000],re.I)
                encoding=encoding or (charset[1].decode() if charset else 'utf-8')
                text=data.decode(encoding,errors='replace')
            if norm(c['model'].split(' / ')[0].replace('Alpha ','').replace('LUMIX ','').replace('OM-D ','').replace('PEN ','')) not in norm(clean(text)) and c['brand'] not in ['Canon','Sony','Pentax','Panasonic']:
                result['outcome']='model identity needs review';return result
            path.write_text(text,encoding='utf-8')
        result['source']=final
        result['sha256']=hashlib.sha256(text.encode()).hexdigest()
        result['values'],result['evidence']=extract(rows_from(text))
        result['outcome']='extracted for review' if result['values'] else 'no supported table fields'
        result['title']=clean((re.findall(r'<title[^>]*>(.*?)</title>',text,re.S|re.I) or [''])[0])
    except Exception as e:result['outcome']='source unavailable';result['error']=str(e)
    return result

if __name__=='__main__':
    report=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for item in pool.map(research,MODELS):
            report.append(item)
            if len(report)%20==0:
                (ROOT/'local-data/research/progress.json').write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8')
                print(f'Processed {len(report)}/320; extracted {sum(bool(r["values"]) for r in report)}',flush=True)
    (ROOT/'data/camera-research-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'processed':len(report),'withValues':sum(bool(r['values']) for r in report),'fields':sum(len(r['values']) for r in report)}),flush=True)
