#!/usr/bin/env python3
import struct
import zlib

def create_simple_png(width, height, filename):
    """Create a simple solid color PNG file"""
    # PNG signature
    png_sig = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk (image header)
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
    ihdr_chunk = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT chunk (image data) - create a simple red square
    pixel_data = b''
    for y in range(height):
        pixel_data += b'\x00'  # Filter type
        for x in range(width):
            # Red channel
            pixel_data += b'\xff'
            # Green channel  
            pixel_data += b'\x00'
            # Blue channel
            pixel_data += b'\x00'
    
    compressed = zlib.compress(pixel_data, 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed) & 0xffffffff
    idat_chunk = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
    
    # IEND chunk (image end)
    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    iend_chunk = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    # Write PNG file
    with open(filename, 'wb') as f:
        f.write(png_sig + ihdr_chunk + idat_chunk + iend_chunk)
    
    print(f"Created {filename} ({width}x{height})")

# Create the icons
create_simple_png(80, 80, 'icon.png')
create_simple_png(256, 256, 'largeIcon.png')
