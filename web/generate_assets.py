#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont

def get_perfect_font_size(text, font_path, max_w, max_h):
    """Finds the largest font size that fits within the target dimensions"""
    font_size = 10
    while True:
        try:
            font = ImageFont.truetype(font_path, font_size)
        except Exception:
            return ImageFont.load_default()
        
        # Get text bounding box
        bbox = font.getbbox(text)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        
        if w > max_w or h > max_h:
            return ImageFont.truetype(font_path, max(10, font_size - 2))
        font_size += 2

def create_launcher_icon(width, height, filename, font_path):
    """Generates a white background launcher icon with Castify centered in slate blue with rounded corners"""
    # Create RGBA image so we have transparency on the corners
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    
    # Create solid white canvas
    white_bg = Image.new('RGBA', (width, height), '#ffffff')
    draw = ImageDraw.Draw(white_bg)
    
    text = "Castify"
    
    # Calculate sizing: fit within 85% width and 50% height
    font = get_perfect_font_size(text, font_path, int(width * 0.85), int(height * 0.5))
    
    # Bounding box for centering calculation
    bbox = font.getbbox(text)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    
    # Align text center
    x = (width - w) / 2 - bbox[0]
    y = (height - h) / 2 - bbox[1]
    
    draw.text((x, y), text, fill='#33415c', font=font)
    
    # Create rounded corner mask
    mask = Image.new('L', (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    # Radius is 15% of width
    radius = int(width * 0.15)
    mask_draw.rounded_rectangle([(0, 0), (width, height)], radius, fill=255)
    
    # Paste onto transparent canvas using the rounded mask
    img.paste(white_bg, (0, 0), mask=mask)
    img.save(filename)
    print(f"Created launcher icon with rounded corners: {filename} ({width}x{height})")

def create_navbar_logo(filename, font_path):
    """Generates a transparent logo with Castify TV in white/slate blue"""
    width, height = 600, 180
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Font sizes
    castify_text = "Castify"
    tv_text = " TV"
    
    # Bounding boxes for font calculations
    font = ImageFont.truetype(font_path, 80)
    
    c_bbox = font.getbbox(castify_text)
    c_w = c_bbox[2] - c_bbox[0]
    c_h = c_bbox[3] - c_bbox[1]
    
    tv_bbox = font.getbbox(tv_text)
    tv_w = tv_bbox[2] - tv_bbox[0]
    tv_h = tv_bbox[3] - tv_bbox[1]
    
    # Total centering
    total_w = c_w + tv_w
    total_h = max(c_h, tv_h)
    
    start_x = (width - total_w) / 2
    start_y = (height - total_h) / 2
    
    # Draw Castify in off-white (#e9ecef)
    draw.text((start_x - c_bbox[0], start_y - c_bbox[1]), castify_text, fill='#e9ecef', font=font)
    
    # Draw TV in dark slate (#33415c) with a prominent light grey outline for contrast on dark backgrounds
    draw.text((start_x + c_w - tv_bbox[0], start_y - tv_bbox[1]), tv_text, 
              fill='#33415c', font=font, 
              stroke_width=3, stroke_fill='#e9ecef')
    
    img.save(filename)
    print(f"Created navbar logo: {filename}")

def main():
    font_path = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
    if not os.path.exists(font_path):
        # Fallback to Helvetica
        font_path = "/System/Library/Fonts/HelveticaNeue.ttc"
        
    os.makedirs('web', exist_ok=True)
    
    create_launcher_icon(80, 80, 'web/icon.png', font_path)
    create_launcher_icon(130, 130, 'web/largeIcon.png', font_path)
    create_navbar_logo('web/logo.png', font_path)

if __name__ == '__main__':
    main()
