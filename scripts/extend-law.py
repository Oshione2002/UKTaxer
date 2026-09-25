"""Refresh the pinned local corpus from official legislation.gov.uk XML."""
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from lxml import etree

ROOT=Path(__file__).resolve().parents[1]/'dist'/'law'
MANIFEST=ROOT/'manifest.json'
DOCS=[
 ('ukpga/1986/41','Finance Act 1986 — Stamp Duty Reserve Tax','transaction'),
 ('ukpga/1994/9','Finance Act 1994 — Air Passenger Duty','specialist'),
 ('ukpga/1996/8','Finance Act 1996 — Landfill Tax','specialist'),
 ('anaw/2017/3','Landfill Disposals Tax (Wales) Act 2017','specialist'),
 ('asp/2014/2','Landfill Tax (Scotland) Act 2014','specialist'),
 ('asp/2024/14','Aggregates Tax and Devolved Taxes Administration (Scotland) Act 2024','specialist'),
 ('ukpga/2001/9','Finance Act 2001 — Aggregates Levy','specialist'),
 ('ukpga/1988/41','Local Government Finance Act 1988','business'),
 ('ukpga/1975/30','Local Government (Scotland) Act 1975','business'),
 ('ukpga/2022/40','Energy (Oil and Gas) Profits Levy Act 2022','specialist'),
 ('ukpga/2023/30','Finance (No. 2) Act 2023 — Multinational Top-up Tax','business'),
 ('ukpga/2024/3','Finance Act 2024 — R&D Credit','relief'),
]
def name(node):
 return etree.QName(node).localname if isinstance(node.tag,str) else ''
def readable(node):
 def walk(item):
  content=item.text or ''
  for child in item:
   part=walk(child)
   tag=name(child)
   if tag in ('Text','Title','Pnumber'):part=' '+part+' '
   elif tag in ('P1','P2','P3','P4','P5','Row','ListItem'):part='\n'+part
   content+=part+(child.tail or '')
  return content
 text=walk(node)
 return re.sub(r'\n{3,}','\n\n',re.sub(r' *\n *','\n',re.sub(r'[ \t]+',' ',text))).strip()
data=json.loads(MANIFEST.read_text(encoding='utf-8'))
seen={doc['id'] for doc in data['documents']}
for doc_id,title,area in DOCS:
 if doc_id in seen:data['documents']=[doc for doc in data['documents'] if doc['id']!=doc_id]
 source='https://www.legislation.gov.uk/'+doc_id
 request=urllib.request.Request(source+'/data.xml',headers={'User-Agent':'UKTaxer/1.0 (public legal reference)'})
 with urllib.request.urlopen(request,timeout=150) as response:xml=response.read()
 if b'<Legislation' not in xml[:500]:raise RuntimeError('Unexpected XML for '+doc_id)
 root=etree.fromstring(xml)
 entries=[]
 for index,node in enumerate(root.iter()):
  if name(node)!='P1':continue
  url=node.get('DocumentURI')
  if not url:continue
  parent=node.getparent()
  heading=next((n.text for n in parent.iter() if name(n)=='Title' and n.text and n.text.strip()),None) if parent is not None else None
  text=readable(node)
  if text:entries.append({'heading':re.sub(r'\s+',' ',heading or node.get('id') or f'Provision {index+1}').strip() or f'Provision {index+1}','text':text,'url':url.replace('http://','https://')})
 if not entries:raise RuntimeError('No provisions extracted for '+doc_id)
 slug=doc_id.replace('/','-')
 now=datetime.now(timezone.utc).isoformat()
 meta={'id':doc_id,'title':title,'area':area,'source':source,'revision':'latest available revised text at ingestion','retrieved':now,'sha256':hashlib.sha256(xml).hexdigest(),'bytes':len(xml),'provisions':len(entries),'text':'/law/'+slug+'.txt','index':'/law/'+slug+'.json'}
 (ROOT/(slug+'.json')).write_text(json.dumps(entries,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 lines=[title,'Official source: '+source,'Revision: '+meta['revision'],'Retrieved: '+now,'Official XML SHA-256: '+meta['sha256'],'']
 for i,entry in enumerate(entries,1):lines.extend([f'{i}. {entry["heading"]}',entry['text'],'Official provision: '+entry['url'],''])
 (ROOT/(slug+'.txt')).write_text('\n'.join(lines),encoding='utf-8')
 data['documents'].append(meta)
 MANIFEST.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 print(title+': '+str(len(entries))+' provisions',flush=True)
data['ruleset']='UK-2026.1'
data['retrieved']=datetime.now(timezone.utc).isoformat()
MANIFEST.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
