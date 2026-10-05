#!/usr/bin/env python3
"""Chat quiz: `python3 ask.py ask` -> round.png + prints questions (A-E, English only).
`python3 ask.py grade 1A 2C ...` -> grades the last round and updates state.json."""
import json,sys,random,re,io,base64,os
from PIL import Image,ImageDraw,ImageFont
D=os.path.dirname(os.path.abspath(__file__))
items=json.load(open(D+'/items.json',encoding='utf8'))
by={i['id']:i for i in items}
SP=D+'/state.json'; RP=D+'/round.json'
st=json.load(open(SP)) if os.path.exists(SP) else {'prog':{},'rounds':0}
STOP=set('a an the of for and or to in on with than all is are begin end panel sign'.split())
def toks(i): return {w for w in re.sub(r'[^a-z0-9 ]',' ',i['en'].lower()).split() if w not in STOP}
def sim(a,b):
    A,B=toks(a),toks(b);n=len(A&B);s=n/max(1,len(A|B))
    if a['cat']==b['cat']:s+=.3
    if a['code'] and b['code'] and a['code'][0]==b['code'][0]:s+=.15
    return s
def weight(i):
    p=st['prog'].get(i['id'])
    if not p:return 4
    return [6,3.5,2,1,.4][min(4,p['box'])]
def pick(n):
    pool=[i for i in items if i['pri']==1 and i['cat']!='S' or (i['cat']=='S' and i['pri']==1)]
    out=[]
    seen_en=set()
    while len(out)<n:
        w=[(i,weight(i)) for i in pool if i['id'] not in {o['id'] for o in out} and i['en'] not in seen_en]
        t=sum(x for _,x in w);r=random.random()*t
        for i,x in w:
            r-=x
            if r<=0:out.append(i);seen_en.add(i['en']);break
    return out
def options(it):
    base=[i for i in items if i['id']!=it['id'] and i['en']!=it['en'] and i['cat']==it['cat']]
    if len(base)<8: base=[i for i in items if i['id']!=it['id'] and i['en']!=it['en']]
    ranked=sorted(base,key=lambda i:-(sim(it,i)+random.random()*.08))
    top=ranked[:8];random.shuffle(top)
    d=[];seen={it['en']}
    for c in top+ranked[8:]:
        if c['en'] not in seen:seen.add(c['en']);d.append(c)
        if len(d)==4:break
    o=[it]+d;random.shuffle(o);return o
def img(i):
    return Image.open(io.BytesIO(base64.b64decode(i['img'].split(',')[1]))).convert('RGB')
def ask():
    qs=pick(10);rnd=[]
    F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',30)
    W,H=330,300;cols=2;rows=5
    sheet=Image.new('RGB',(W*cols,H*rows),'white');dr=ImageDraw.Draw(sheet)
    for k,it in enumerate(qs):
        x,y=(k%cols)*W,(k//cols)*H
        dr.rectangle([x+6,y+6,x+W-6,y+H-6],outline=(190,198,210),width=2)
        im=img(it);s=min(250/im.width,230/im.height);im=im.resize((max(1,int(im.width*s)),max(1,int(im.height*s))),Image.LANCZOS)
        sheet.paste(im,(x+(W-im.width)//2,y+48+(240-im.height)//2))
        dr.text((x+16,y+12),f'Q{k+1}',fill=(10,90,168),font=F)
        o=options(it);rnd.append({'id':it['id'],'opts':[i['id'] for i in o],'ans':'ABCDE'[o.index(it)]})
    sheet.save(D+'/round.png',optimize=True)
    json.dump(rnd,open(RP,'w'))
    lines=[]
    for k,q in enumerate(rnd):
        lines.append(f'Q{k+1}.')
        for L,oid in zip('ABCDE',q['opts']):lines.append(f'  {L}) {by[oid]["en"]}')
    print('\n'.join(lines))
def grade(ans):
    rnd=json.load(open(RP));res=[]
    letters=[a[-1].upper() for a in ans]
    for k,q in enumerate(rnd):
        it=by[q['id']];pk=letters[k] if k<len(letters) else None
        ok=pk==q['ans']
        p=st['prog'].setdefault(it['id'],{'box':0,'r':0,'w':0})
        if pk is None:continue
        if ok:p['r']+=1;p['box']=min(4,p['box']+1)
        else:p['w']+=1;p['box']=0
        picked=by[q['opts']['ABCDE'.index(pk)]] if pk in 'ABCDE' else None
        res.append((k+1,ok,pk,q['ans'],it,picked))
    st['rounds']+=1;json.dump(st,open(SP,'w'))
    score=sum(1 for r in res if r[1])
    print(f'SCORE {score}/10')
    for n,ok,pk,ca,it,pi in res:
        print(f'Q{n} {"OK" if ok else "WRONG"} picked {pk} correct {ca}: {it["en"]} | code {it["code"]} | nl {it["nl"]} | note(tr) {it["note"]}')
        if not ok and pi:print(f'   picked sign means: {pi["en"]} (code {pi["code"]})')
if __name__=='__main__':
    if sys.argv[1]=='ask':ask()
    else:grade(sys.argv[2:])
