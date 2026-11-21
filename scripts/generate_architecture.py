#!/usr/bin/env python3
"""Generate the animated architecture diagram in docs/architecture.gif (requires Pillow)."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'architecture.gif'
W, H = 1200, 620
def find_font(*paths):
 return next((path for path in paths if Path(path).is_file()), paths[-1])
FONT = find_font('/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
BOLD = find_font('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
font = lambda size, bold=False: ImageFont.truetype(BOLD if bold else FONT, size)
F = {s: font(s) for s in [14, 16, 18, 20, 22]}
FB = {s: font(s, True) for s in [14, 16, 18, 20, 24, 32, 38]}
ink='#282820'; muted='#6d6a5f'; green='#47703c'; paper='#f3efe6'
stages=[
 ('01  OPEN THE TABLE','Players open the app; each browser keeps its own private seat token.'),
 ('02  SEND A MOVE','The browser sends an action or polls for updates over HTTPS.'),
 ('03  APPLY THE RULES','The Worker routes the request to the Durable Object for that room.'),
 ('04  SHARE THE RESULT','The room saves state and returns a view with only that player’s cards.'),
 ('05  HANDLE TIMEOUTS','Alarms pass unanswered challenges after 15s and clear idle rooms after 10 min.'),
]

def rounded(draw, box, fill, outline='#d3ccbe', radius=18, width=2):
 draw.rounded_rectangle(box,radius=radius,fill=fill,outline=outline,width=width)

def arrow(draw, a, b, color, reverse=False, active=False, progress=0):
 ax,ay=a;bx,by=b
 draw.line((ax,ay,bx,by),fill=color,width=4 if active else 2)
 direction=-1 if reverse else 1
 x=ax if reverse else bx
 draw.polygon([(x,ay),(x-10*direction,ay-6),(x-10*direction,ay+6)],fill=color)
 if active:
  x=bx-(bx-ax)*progress if reverse else ax+(bx-ax)*progress
  draw.ellipse((x-7,ay-7,x+7,ay+7),fill='#85af70',outline='#354f2c',width=2)

def frame(index):
 phase=index//16; progress=(index%16)/15
 im=Image.new('RGB',(W,H),paper); d=ImageDraw.Draw(im)
 for y in range(0,H,24):
  for x in range(0,W,24):d.ellipse((x,y,x+1,y+1),fill='#dcd6c8')
 d.text((56,31),'COUP  /  SYSTEM ARCHITECTURE',font=FB[16],fill=green)
 d.text((56,62),'One table. One trusted game room.',font=FB[38],fill=ink)
 d.text((58,115),'A quick look at how friends play together, without accounts.',font=F[18],fill=muted)
 # Container and three nodes.
 rounded(d,(42,161,1158,458),'#faf8f2','#d8d1c4',20)
 boxes=[(72,213,335,396),(450,213,702,396),(820,196,1122,413)]
 highlights=[phase in (0,1,3),phase in (1,2,3),phase in (2,3,4)]
 for i,b in enumerate(boxes):
  rounded(d,(b[0],b[1]+4,b[2],b[3]+4),'#ded9cd','#ded9cd',14)
  rounded(d,b,['#f7f3eb','#e7f1df','#eee8f3'][i],['#90a785' if highlights[i] else '#cfc8ba','#77976a' if highlights[i] else '#b6c5ae','#8f7ca0' if highlights[i] else '#c7bbce'][i],14,2)
 # client
 d.ellipse((92,233,134,275),fill='#d9eaca',outline='#7e9871',width=2);d.text((104,239),'●',font=FB[20],fill='#527146')
 d.text((148,236),'Players’ browsers',font=FB[20],fill=ink)
 d.text((94,292),'2–6 friends · no login',font=F[18],fill=ink)
 d.text((94,322),'Private seat token',font=F[16],fill=muted)
 d.text((94,348),'Hidden hand + game UI',font=F[16],fill=muted)
 # worker
 d.rounded_rectangle((470,233,512,275),radius=9,fill='#d3e7c6',outline='#84a477',width=2);d.text((479,239),'↔',font=FB[20],fill=green)
 d.text((526,236),'Cloudflare Worker',font=FB[20],fill=ink)
 d.text((472,292),'Serves the frontend',font=F[18],fill=ink)
 d.text((472,322),'Routes API requests',font=F[16],fill=muted)
 d.text((472,348),'to the correct room',font=F[16],fill=muted)
 # room
 d.rounded_rectangle((842,216,884,258),radius=9,fill='#e2d5ea',outline='#a995b6',width=2);d.text((854,223),'R',font=FB[20],fill='#6e587d')
 d.text((898,218),'Durable Object',font=FB[20],fill=ink)
 d.text((842,274),'One room per game',font=F[18],fill=ink)
 d.text((842,304),'Rules + SQLite state',font=F[16],fill=muted)
 d.text((842,330),'Private views per player',font=F[16],fill=muted)
 d.text((842,356),'Alarms: 15s / 10 min',font=F[16],fill=muted)
 # two-way connections
 arrow(d,(335,275),(450,275),'#5e8551' if phase==1 else '#a69f92',active=phase==1,progress=progress)
 arrow(d,(335,330),(450,330),'#5e8551' if phase==3 else '#b9b1a5',reverse=True,active=phase==3,progress=progress)
 arrow(d,(702,275),(820,275),'#5e8551' if phase==2 else '#a69f92',active=phase==2,progress=progress)
 arrow(d,(702,330),(820,330),'#5e8551' if phase==3 else '#b9b1a5',reverse=True,active=phase==3,progress=progress)
 d.text((345,240),'HTTPS',font=FB[14],fill=muted)
 d.text((345,345),'views',font=F[14],fill=muted)
 d.text((727,240),'room',font=FB[14],fill=muted)
 d.text((710,345),'result',font=F[14],fill=muted)
 # footer with stage narrative
 rounded(d,(42,478,1158,570),'#e5efdc','#bbceb0',13)
 d.text((64,494),stages[phase][0],font=FB[14],fill=green)
 d.text((64,520),stages[phase][1],font=F[20],fill=ink)
 for i in range(len(stages)):
  x=1048+i*16;d.ellipse((x,493,x+8,501),fill=green if i==phase else '#bacbb3')
 d.text((58,588),'Browser polling: every 2.5s  •  SQLite-backed game state  •  Server-enforced rules',font=F[14],fill=muted)
 return im
frames=[frame(i) for i in range(80)]
OUT.parent.mkdir(parents=True,exist_ok=True)
frames[0].save(OUT,save_all=True,append_images=frames[1:],duration=125,loop=0,optimize=True,disposal=2)
print(f'Created {OUT} ({len(frames)} frames)')
