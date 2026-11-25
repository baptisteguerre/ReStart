# Generates src/img/monstera.svg: original split-leaf silhouettes (no external artwork).
# Large heart-shaped leaves (a cardioid around the stem joint) with wedge slits from the
# edge toward the midrib and a few long holes, on long stems coming in from the edges.
import math, os, random
random.seed(5)
W,H=1600,1000
f=lambda p:f"{p[0]:.1f} {p[1]:.1f}"
def radius(phi,L):
    c=(1+math.cos(phi))/2
    return L*(c**0.85)*(1+0.08*math.cos(2*phi))
def leaf(L,slit_angles):
    # Local frame: stem joint at the origin, the tip along +x.
    pts=[]; n=320; d=0.035
    phis=[-math.pi+0.02+(2*math.pi-0.04)*k/n for k in range(n+1)]
    for phi in phis:
        hit=next((s for s in slit_angles if abs(phi-s)<d),None)
        if hit is not None:
            # replace the edge around the slit by a wedge reaching toward the midrib
            if not pts or pts[-1][2]!=hit:
                # along a lateral vein: from the edge back toward the midrib, leaning to the base
                r=radius(hit,L); ex,ey=r*math.cos(hit),r*math.sin(hit)
                k=random.uniform(0.72,0.8)
                pts.append((ex-abs(ey)*0.55*k, ey*(1-k),hit))
            continue
        r=radius(phi,L)
        pts.append((r*math.cos(phi),r*math.sin(phi),None))
    return [(x,y) for x,y,_ in pts]
def holes(L,slit_angles):
    hs=[]
    s=sorted(slit_angles)
    for a,b in zip(s,s[1:]):
        if a*b<=0 or random.random()<0.45: continue   # not across the midrib, and not everywhere
        m=(a+b)/2; r=radius(m,L); ex,ey=r*math.cos(m),r*math.sin(m)
        # a long hole on the vein, near the midrib
        hx,hy=ex-abs(ey)*0.42,ey*0.4
        hs.append((hx,hy,math.atan2(ey-hy*0.2,ex-hx)*0+math.atan2(ey*0.6,abs(ey)*0.55),r*0.1,L*0.02))
    return hs
def tr(p,ox,oy,ang):
    ca,sa=math.cos(ang),math.sin(ang); x,y=p
    return (ox+x*ca-y*sa, oy+x*sa+y*ca)
paths=[];stems=[]
leaves=[ # stem base, joint, leaf direction, size
  ((1720,-60),(1420,90),2.45,330),
  ((1720,620),(1500,520),3.4,250),
  ((-90,-60),(170,80),0.85,310),
  ((-100,660),(90,560),-0.4,220),
  ((820,-120),(760,10),1.6,190),
]
for (sb,jt,ang,L) in leaves:
    k=[0.45,0.8,1.15,1.5,1.85]
    sl=[a+random.uniform(-0.06,0.06) for a in k]+[-a+random.uniform(-0.06,0.06) for a in k]
    pts=[tr(p,jt[0],jt[1],ang) for p in leaf(L,sl)]
    d="M"+" L".join(f(p) for p in pts)+"Z"
    for (hx,hy,m,rx,ry) in holes(L,sl):
        cx,cy=tr((hx,hy),jt[0],jt[1],ang); a=m+ang
        dx,dy=rx*math.cos(a),rx*math.sin(a); deg=math.degrees(a)
        d+=f"M{cx-dx:.1f} {cy-dy:.1f}A{rx:.1f} {ry:.1f} {deg:.1f} 1 0 {cx+dx:.1f} {cy+dy:.1f}A{rx:.1f} {ry:.1f} {deg:.1f} 1 0 {cx-dx:.1f} {cy-dy:.1f}Z"
    paths.append(d)
    # the stem arrives at the joint from behind the leaf
    bx,by=jt[0]-math.cos(ang)*120,jt[1]-math.sin(ang)*120
    stems.append(f"M{sb[0]} {sb[1]}Q{bx:.1f} {by:.1f} {jt[0]} {jt[1]}")
out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMin slice">',
     '<g fill="none" stroke="#000" stroke-width="8" stroke-linecap="round">'+''.join(f'<path d="{s}"/>' for s in stems)+'</g>',
     '<g fill="#000" fill-rule="evenodd">'+''.join(f'<path d="{p}"/>' for p in paths)+'</g></svg>']
open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','src','img','monstera.svg'),'w').write(''.join(out))
print(len(paths),"monstera leaves")
