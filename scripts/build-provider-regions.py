#!/usr/bin/env python3
"""Rebuild conservative provider-routing polygons from the pinned Natural Earth source."""
import hashlib, json, pathlib, sys, urllib.request
ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_countries.geojson'
source = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '.cache/region-data/countries.geojson'
if not source.exists():
    source.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(SOURCE, timeout=45) as response: source.write_bytes(response.read())
raw = source.read_bytes()
def distance(p, a, b):
    dx,dy=b[0]-a[0],b[1]-a[1]; length=dx*dx+dy*dy
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)) if length else 0
    return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
def simplify(points, tolerance):
    if len(points) <= 4: return points
    keep={0,len(points)-1}; stack=[(0,len(points)-1)]
    while stack:
        a,b=stack.pop()
        if b-a<2: continue
        index=max(range(a+1,b),key=lambda i: distance(points[i],points[a],points[b]))
        if distance(points[index],points[a],points[b])>tolerance**2:
            keep.add(index); stack.extend([(a,index),(index,b)])
    result=[points[i] for i in sorted(keep)]
    return result if len(result)>=4 else points
regions={}
for feature in json.loads(raw)['features']:
    code={'China':'CN','Hong Kong S.A.R.':'HK','Macao S.A.R':'MO','Taiwan':'TW'}.get(feature['properties']['ADMIN'])
    if not code: continue
    geometry=feature['geometry']; polys=geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
    regions[code]=[[[[round(x,5),round(y,5)] for x,y,*_ in simplify(ring, 0.01 if code == "CN" else 0.001)] for ring in poly] for poly in polys]
content='// Natural Earth public-domain data. Provider hints only; not authoritative boundaries.\n// Source: '+SOURCE+'\nexport default '+json.dumps(regions,separators=(',',':'))+';\n'
(ROOT/'src/data').mkdir(exist_ok=True); (ROOT/'src/data/providerRegions.mjs').write_text(content)
metadata={'url':SOURCE,'sourceSHA256':hashlib.sha256(raw).hexdigest(),'license':'Public domain','licenseURL':'https://www.naturalearthdata.com/about/terms-of-use/','providerCodes':list(regions),'simplificationToleranceDegrees':{'CN':0.01,'HK':0.001,'MO':0.001,'TW':0.001},'boundaryExclusionDegrees':{'CN':0.05,'HK':0.01,'MO':0.01,'TW':0.01},'quantizationDegrees':0.00001,'purpose':'Conservative weather-provider routing hints, not authoritative administrative boundaries'}
(ROOT/'docs/provider-regions-source.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps({'bytes':len(content.encode()),'regions':list(regions)}))
