"""Technical alpha-compositing proof: complete hand and immutable card layers.
This is a same-camera registration check, not a new generated image or photograph.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import argparse,json,hashlib
R=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--frames',default='work/hand-rig/frames');a.add_argument('--output',default='reports/hand-rig/final-front-facing');a.add_argument('--behind',action='store_true');a=a.parse_args()
out=R/a.output;out.mkdir(parents=True,exist_ok=True);source=R/a.frames
card_file=R/'public/assets/renders/handheld-relief.webp';card=Image.open(card_file).convert('RGBA').resize((360,480),Image.Resampling.LANCZOS)
sheet=Image.new('RGB',(1080,1000),(6,7,9));draw=ImageDraw.Draw(sheet)
for column,index in enumerate([0,16,31]):
 hand=Image.open(source/f'hand-{index:03}.png').convert('RGBA').resize((360,480),Image.Resampling.LANCZOS)
 bg=Image.new('RGBA',hand.size,(6,7,9,255));only=Image.alpha_composite(bg,hand)
 composite=Image.alpha_composite(only,card) if a.behind else Image.alpha_composite(Image.alpha_composite(bg,card),hand)
 only.save(out/f'hand-{index:03}-on-black.png');composite.save(out/f'composite-{index:03}.png')
 sheet.paste(only.convert('RGB'),(column*360,20));sheet.paste(composite.convert('RGB'),(column*360,520))
 draw.text((column*360+14,5),f'POSE {index:02} - FRONTAL PALM',fill='white')
 draw.text((column*360+14,503),'HAND IN FRONT, LOWERING' if not a.behind else 'UNCHANGED CARD IN FRONT',fill='white')
sheet.save(out/'start-mid-end-contact-sheet.jpg',quality=94)
(out/'composition.json').write_text(json.dumps({'cardSource':str(card_file.relative_to(R)),'cardSha256':hashlib.sha256(card_file.read_bytes()).hexdigest(),'handSource':a.frames,'handInFront':not a.behind,'screenRegistration':'identity; native common 3:4 frame','sourceArtworkEdited':False,'purpose':'Technical alpha-compositing registration proof'},indent=2)+'\n')
