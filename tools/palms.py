# Generates src/img/palms.svg: original palm-frond silhouettes (no external artwork).
import math, os, random
random.seed(11)
W,H=1600,1000
f=lambda x,y:f"{x:.1f} {y:.1f}"
def leaflet(x,y,ang,L,w,droop):
    ca,sa=math.cos(ang),math.sin(ang); nx,ny=-sa,ca
    tip=(x+ca*L+nx*droop, y+sa*L+ny*droop)
    m1=(x+ca*L*0.45+nx*(w+droop*0.5), y+sa*L*0.45+ny*(w+droop*0.5))
    m2=(x+ca*L*0.45-nx*(w-droop*0.5), y+sa*L*0.45-ny*(w-droop*0.5))
    return f"M{f(x,y)}Q{f(*m1)} {f(*tip)}Q{f(*m2)} {f(x,y)}Z"
def frond(x,y,ang,length,bend,paths,stems):
    pts=[(x,y)]; seg=14; n=int(length/seg); a=ang
    for i in range(n):
        a+=bend; x+=math.cos(a)*seg; y+=math.sin(a)*seg; pts.append((x,y))
        t=i/n
        if i>3 and i%2==0:
            L=(1-t)**0.6*random.uniform(150,200)+25
            for side in (1,-1):
                la=a+side*random.uniform(0.75,0.95)
                paths.append(leaflet(x,y,la,L,random.uniform(9,13),side*L*0.12))
    stems.append(pts)
paths=[];stems=[]
for (x,y,ang,L,b) in [(1680,-60,2.35,980,0.012),(1560,-80,1.95,760,0.018),(1700,320,3.0,700,-0.01),(-80,-40,0.75,760,-0.012),(250,-90,1.35,520,-0.02)]:
    frond(x,y,ang,L,b,paths,stems)
out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMin slice"><g fill="#000">',''.join(f'<path d="{p}"/>' for p in paths),'</g><g fill="none" stroke="#000" stroke-width="5" stroke-linecap="round">']
for pts in stems: out.append('<path d="M'+" L".join(f(*p) for p in pts)+'"/>')
out.append('</g></svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','src','img','palms.svg'),'w').write(''.join(out)); print(len(paths))
