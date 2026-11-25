# Generates src/img/olive.svg: original olive branch silhouettes (no external artwork).
# Thin, arching twigs with narrow, pointed leaves in opposite pairs, sparse and airy.
import math, os, random
random.seed(11)
W,H=1600,1000
def leaf(x,y,ang,length,width):
    ca,sa=math.cos(ang),math.sin(ang)
    tip=(x+ca*length,y+sa*length); nx,ny=-sa,ca
    # lanceolate: widest a little before the middle, long fine tip
    m1=(x+ca*length*0.38+nx*width,y+sa*length*0.38+ny*width)
    m2=(x+ca*length*0.38-nx*width,y+sa*length*0.38-ny*width)
    f=lambda p:f"{p[0]:.1f} {p[1]:.1f}"
    return f"M{f((x,y))}Q{f(m1)} {f(tip)}Q{f(m2)} {f((x,y))}Z"
def twig(x,y,ang,length,depth,paths,stems):
    pts=[(x,y)]; seg=16; n=int(length/seg); a=ang
    for i in range(n):
        a+=random.uniform(-0.05,0.05)+0.018   # arching downward
        x+=math.cos(a)*seg; y+=math.sin(a)*seg; pts.append((x,y))
        if i>1 and i%3==0:
            for side in (1,-1):                 # opposite pairs
                la=a+side*random.uniform(0.45,0.75)
                L=random.uniform(44,66)*(1-0.25*depth)
                paths.append(leaf(x,y,la,L,L*random.uniform(0.11,0.15)))
        if depth<2 and i>3 and random.random()<0.09:
            twig(x,y,a+random.choice([-1,1])*random.uniform(0.4,0.8),length*random.uniform(0.3,0.45),depth+1,paths,stems)
    stems.append((pts,max(1,2.6-1*depth)))
    paths.append(leaf(x,y,a,52*(1-0.25*depth),7))
paths=[];stems=[]
for (x,y,ang,L) in [(1660,-30,2.55,820),(1560,-50,2.15,520),(-50,-20,0.45,640),(-60,240,0.15,420),(820,-60,1.35,300)]:
    twig(x,y,ang,L,0,paths,stems)
out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMin slice">',
     '<g fill="#000">'+''.join(f'<path d="{p}"/>' for p in paths)+'</g>',
     '<g fill="none" stroke="#000" stroke-linecap="round">']
for pts,w in stems:
    out.append(f'<path d="M{" L".join(f"{x:.1f} {y:.1f}" for x,y in pts)}" stroke-width="{w:.1f}"/>')
out.append('</g></svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','src','img','olive.svg'),'w').write(''.join(out))
print(len(paths),"olive leaves")
