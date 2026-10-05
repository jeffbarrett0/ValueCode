import json,re,os,base64,io,sys
sys.path.insert(0,'.')
from PIL import Image
from data_docx import DX
from data_extra import EX
S='/tmp/claude-0/-home-user-ValueCode/06a1c114-a2b6-5b84-8597-d40e4ac7dc7a/scratchpad/'
WC=S+'signs/wc/'; UN=S+'wd/un'
rows=json.load(open(S+'signs/rows.json')); left=json.load(open(S+'signs/left.json'))
dxs=json.load(open(S+'signs/docx_signs.json')); mp={int(k):v for k,v in json.load(open(S+'signs/docx2code.json')).items()}
code_img={o['code']:os.path.basename(o['imgs'][0]) for o in rows}
code_nl={o['code']:o['nl'].split(' | ')[0] for o in rows}
def datauri(path,maxh=140):
    im=Image.open(path).convert('RGBA')
    bg=Image.new('RGBA',im.size,(255,255,255,255)); bg.alpha_composite(im); im=bg.convert('RGB')
    if im.height>maxh: im=im.resize((max(1,round(im.width*maxh/im.height)),maxh),Image.LANCZOS)
    b=io.BytesIO(); im.quantize(colors=48,method=Image.MEDIANCUT).save(b,'PNG',optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
ENO={9:"Junction where priority from the right applies",11:"Priority junction: side road on the left",12:"Priority junction: sharp side road on the left",13:"Priority junction: side road on the right",14:"Priority junction: sharp side road on the right",15:"Priority junction: side roads on both sides",
 45:"Cyclists and mopeds prohibited",51:"All motor vehicles (cars, motorcycles, mopeds) prohibited",100:"Direction sign at a crossroad (destinations)",106:"Begin of a bicycle zone (fietsstraat / fietszone)",107:"End of a bicycle zone (fietsstraat / fietszone)",109:"Lane ends: merge (zipper)",124:"Priority road turns (bend of the priority road)",
 205:"Panel: school street",89:"Divided path for pedestrians and cyclists",92:"Shared path for pedestrians and cyclists",37:"Level crossing, single track (St Andrew's cross)",38:"Level crossing, two or more tracks (St Andrew's cross)"}
NOTE={57:"C35: Bir sonraki kavşağa kadar at arabası veya ikiden fazla tekerlekli araçları SOLDAN sollamak yasak (iki tekerlekliler sollanabilir).",
 59:"C39: Bir sonraki kavşağa kadar yük taşıyan ağır araçlar (>3,5 t) için sollama yasağı.",
 106:"F111: Bölgede en çok 30 km/h; bisikletlileri sollama yasak. Tek yönlü yolda bisikletliler tüm genişliği, çift yönlüde sağ yarıyı kullanır. Motorlu araçlar girebilir. (Eski adı: fietsstraat.)",
 107:"F113: Bisiklet bölgesi sona erdi.",
 51:"Otomobil, motosiklet ve moped dahil tüm motorlu araçlar giremez.",
 89:"Yaya ve bisikletli yolu çizgiyle ayrılmış: her biri kendi tarafını kullanır (D9/D10 ayrık).",
 92:"D10: Yaya ve bisikletliler ortak kullanır. Bu bölümlerde hız en çok 30 km/h'tır.",
 109:"Şerit sona eriyor: fermuar sistemiyle sırayla birleş. Birleşmeyi geç yapan değil, sırası gelen geçer.",
 124:"Öncelikli yol kavşakta dönüyor; yön tabelasından önce nerede önceliğin olduğuna dikkat et.",
 11:"B15: Kalın çizgi senin yolun (öncelik sende), ince çizgi yan yol. Yan yoldan gelenler sana yol verir.",
 12:"B15: Sol açılı yan yol; öncelik ana yolda (sende).",13:"B15: Sağdan yan yol; öncelik ana yolda (sende).",14:"B15: Sağ açılı yan yol; öncelik ana yolda (sende).",15:"B15: Her iki yandan yan yollar; öncelik ana yolda (sende)."}
PRI2=re.compile(r"^F(23[abcd]|29|31|33[abc]|34a|35|37|39|41|43|53|55|56|57|59|60|61|62|65|67|69|71|73|75|77|93)$")
items=[]
for i,o in enumerate(dxs,1):
    tr,cat,note=DX[i]; en=ENO.get(i,o['cells'][1].split('Meaning:')[0].strip())
    note=NOTE.get(i,note)
    m=re.match(r'^([A-Z]\d+[a-z]*(?:bis)?)\b',note or '')
    code=m.group(1) if m else (mp.get(i-1) or '')
    items.append(dict(id=f'd{i}',img=datauri(UN+o['img'][0]),cat=cat,en=en,tr=tr,note=re.sub(r'^[A-Z]\d+[a-z]*(?:bis)?(?: \S+)?: ?','',note) if m and ':' in note else note,code=code,nl=code_nl.get(mp.get(i-1,''),''),pri=1))
for key,(en,tr,cat,note,nl) in EX.items():
    kind,k=key
    if kind=='row': f=code_img[k]; code=k
    else: f=left[k][0]; code=''
    m=re.match(r'^([A-Z]\d+[a-z]*(?:bis)?)\b',note or '')
    if not code and m: code=m.group(1)
    if m and ':' in note: note=re.sub(r'^[A-Z]\d+[a-z]*(?:bis)?: ?','',note)
    elif m and note==m.group(1): note=''
    pri=2 if (kind=='left' and k in range(82,118) and cat=='I') or (kind=='row' and PRI2.match(k)) else 1
    if k==76 : note="1–15'i tek numaralı ev tarafında, 16–ay sonu çift numaralı ev tarafında park et; taraf değişimi ayın son günü 19:30–20:00."
    if k=='F85': en="Roadworks: traffic allowed in both directions on part of a one-way carriageway"; tr="Yol çalışması: tek yönlü yolun bir kısmında çift yönlü trafik"
    items.append(dict(id=f'x{k}',img=datauri(WC+f),cat=cat,en=en,tr=tr,note=note,code=code,nl=nl,pri=pri))
import re as _re
for it in items:
    if _re.match(r'^[A-Z]\d+[a-z]* \+ M levha\.?$',it['note'] or ''): it['note']='Ana levha + alt levha: alt levha kuralın kimlere (ör. bisiklet, moped) ve nasıl uygulandığını belirler; resme dikkatli bak.'
print(len(items), sum(len(i['img']) for i in items)/1e6)
json.dump(items,open('items.json','w'),ensure_ascii=False)
