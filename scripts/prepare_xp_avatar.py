"""Prepare one generated avatar with alpha, safe margins and bounded PNG size."""
import sys
from pathlib import Path
from PIL import Image

source, target = map(Path, sys.argv[1:3])
image = Image.open(source).convert('RGBA')
assert image.getchannel('A').getextrema() == (0, 255), 'Source needs actual transparency'
crop = image.crop(image.getchannel('A').getbbox())
crop.thumbnail((820, 820), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (1024, 1024))
canvas.alpha_composite(crop, ((1024-crop.width)//2, (1024-crop.height)//2))
target.parent.mkdir(parents=True, exist_ok=True)
for colours in (256, 192, 128, 96, 64):
    delivery = canvas.quantize(colors=colours, method=Image.Quantize.FASTOCTREE).convert('RGBA')
    delivery.save(target, optimize=True, compress_level=9)
    if target.stat().st_size <= 750000:
        break
assert target.stat().st_size <= 750000, 'Asset exceeds ceiling'
print(target)
