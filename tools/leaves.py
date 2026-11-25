# Generates src/img/leaves.svg: original branch silhouettes (no external artwork).
import math, os, random
random.seed(7)
W,H=1600,1000
def leaf(x,y,ang,length,width):
    # pointed leaf: two quadratic curves from base to tip
    ca,sa=math.cos(ang),math.sin(ang)
    tip=(x+ca*length,y+sa*length)
    nx,ny=-sa,ca
    m1=(x+ca*length*0.45+nx*width,y+sa*length*0.45+ny*width)
    m2=(x+ca*length*0.45-nx*width,y+sa*length*0.45-ny*width)
    f=lambda p:f"{p[0]:.1f} {p[1]:.1f}"
    return f"M{f((x,y))}Q{f(m1)} {f(tip)}Q{f(m2)} {f((x,y))}Z"
def branch(x,y,ang,length,depth,paths,stems):
    pts=[(x,y)]
    seg=18; n=int(length/seg)
    a=ang
    for i in range(n):
        a+=random.uniform(-0.06,0.06)+0.012
        x+=math.cos(a)*seg; y+=math.sin(a)*seg; pts.append((x,y))
        if i>2 and i%2==0:
            side=1 if (i//2)%2 else -1
            la=a+side*random.uniform(0.6,1.1)
            L=random.uniform(46,78)*(1-0.35*depth)
            paths.append(leaf(x,y,la,L,L*random.uniform(0.26,0.34)))
        if depth<2 and i>4 and random.random()<0.10:
            branch(x,y,a+random.choice([-1,1])*random.uniform(0.5,0.9),length*random.uniform(0.35,0.5),depth+1,paths,stems)
    stems.append((pts,max(1.2,4-1.4*depth)))
    paths.append(leaf(x,y,a,60*(1-0.3*depth),17*(1-0.3*depth)))
paths=[];stems=[]
for (x,y,ang,L) in [(1650,-40,2.45,900),(1500,-60,2.0,620),(-60,-30,0.55,700),(1700,260,2.85,560),(300,-60,1.25,380)]:
    branch(x,y,ang,L,0,paths,stems)
out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMin slice">',
     '<g fill="#000">'+''.join(f'<path d="{p}"/>' for p in paths)+'</g>',
     '<g fill="none" stroke="#000" stroke-linecap="round">']
for pts,w in stems:
    d="M"+" L".join(f"{x:.1f} {y:.1f}" for x,y in pts)
    out.append(f'<path d="{d}" stroke-width="{w:.1f}"/>')
out.append('</g></svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','src','img','leaves.svg'),'w').write(''.join(out))
print(len(paths),"leaves")
