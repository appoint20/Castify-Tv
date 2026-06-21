#!/bin/bash

# Create a simple icon using ImageMagick (if available) or just create placeholder PNGs
# For now, let's create minimal PNG files

# Create icon.png (80x80) - WebOS app icon
python3 << 'PYTHON'
from PIL import Image, ImageDraw, ImageFont

# Create 80x80 icon
img = Image.new('RGB', (80, 80), color='#1a1a2e')
draw = ImageDraw.Draw(img)

# Draw a simple "N" logo
draw.rectangle([(10, 10), (70, 70)], outline='#ff0000', width=2)
draw.text((25, 20), "N", fill='#ff0000')

img.save('icon.png')

# Create largeIcon.png (256x256)
img_large = Image.new('RGB', (256, 256), color='#1a1a2e')
draw_large = ImageDraw.Draw(img_large)

# Draw a simple "N" logo
draw_large.rectangle([(20, 20), (236, 236)], outline='#ff0000', width=4)
draw_large.text((100, 100), "N", fill='#ff0000')

img_large.save('largeIcon.png')

print("Icons created successfully!")
PYTHON
