# Generates src/img/bamboo.svg: original bamboo silhouettes (no external artwork).
# A few tall culms with nodes, leaning slightly, and sprays of long, narrow leaves
# hanging from thin twigs at the nodes.
import math, os, random
random.seed(21)
W,H=1600,1000
f=lambda p:f"{p[0]:.1f} {p[1]:.1f}"
def leaf(x,y,ang,L,w):
    ca,sa=math.cos(ang),math.sin(ang); nx,ny=-sa,ca
    tip=(x+ca*L,y+sa*L)
    m1=(x+ca*L*0.3+nx*w,y+sa*L*0.3+ny*w); m2=(x+ca*L*0.3-nx*w,y+sa*L*0.3-ny*w)
    return f"M{f((x,y))}Q{f(m1)} {f(tip)}Q{f(m2)} {f((x,y))}Z"
paths=[];culms=[];twigs=[]
def spray(x,y,ang,n):
    # a thin twig, then a fan of drooping leaves at its end
    L=random.uniform(40,90)
    ex,ey=x+math.cos(ang)*L,y+math.sin(ang)*L
    twigs.append(f"M{f((x,y))}L{f((ex,ey))}")
    for k in range(n):
        a=ang+math.radians(random.uniform(-35,35))+0.35*(1 if math.cos(ang)>0 else -1)
        a+=0.5 # leaves droop
        Ll=random.uniform(80,125)
        paths.append(leaf(ex,ey,a,Ll,Ll*random.uniform(0.1,0.13)))
def culm(x0,y0,ang,length,width):
    # straight segments between nodes; a small gap marks each node
    seg=random.uniform(110,150); t=0
    while t<length:
        s=min(seg,length-t)
        a=(x0+math.cos(ang)*(t+4),y0+math.sin(ang)*(t+4))
        b=(x0+math.cos(ang)*(t+s-4),y0+math.sin(ang)*(t+s-4))
        culms.append((f"M{f(a)}L{f(b)}",width))
        node=(x0+math.cos(ang)*(t+s),y0+math.sin(ang)*(t+s))
        if t>80 and random.random()<0.75:
            side=random.choice([-1,1])
            spray(node[0],node[1],ang+side*random.uniform(0.6,1.1),random.randint(3,5))
        t+=s; width*=0.97
for (x,y,ang,L,w) in [(-40,1040,-1.38,1150,15),(70,1060,-1.47,1150,12),(1640,1040,-1.76,1150,15),(1530,1070,-1.66,1150,11),(1450,1080,-1.6,700,9)]:
    culm(x,y,ang,L,w)
# a few sprays hanging from above, out of frame
for (x,y,a) in [(600,-20,1.2),(900,-30,1.9),(1150,-10,1.4)]:
    spray(x,y,a,4)
out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMin slice">',
     '<g fill="none" stroke="#000" stroke-linecap="round">'+''.join(f'<path d="{d}" stroke-width="{w:.1f}"/>' for d,w in culms)+'</g>',
     '<g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round">'+''.join(f'<path d="{d}"/>' for d in twigs)+'</g>',
     '<g fill="#000">'+''.join(f'<path d="{p}"/>' for p in paths)+'</g></svg>']
open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','src','img','bamboo.svg'),'w').write(''.join(out))
print(len(paths),"bamboo leaves")
