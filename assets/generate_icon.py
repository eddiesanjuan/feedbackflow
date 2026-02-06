#!/usr/bin/env python3
"""Generate a simple app icon for FeedbackFlow.
Creates a blue gradient circle with a white microphone silhouette.
Uses only Python standard library (no Pillow required).
"""
import struct
import zlib
import math
import os

def create_png(width, height, pixels):
    """Create a PNG file from RGBA pixel data."""
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(chunk) & 0xFFFFFFFF)
        return struct.pack('>I', len(data)) + chunk + crc

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr = make_chunk(b'IHDR', ihdr_data)

    # IDAT chunk - raw pixel data with filter bytes
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter type: None
        for x in range(width):
            idx = (y * width + x) * 4
            raw_data += bytes(pixels[idx:idx+4])

    compressed = zlib.compress(raw_data, 9)
    idat = make_chunk(b'IDAT', compressed)

    # IEND chunk
    iend = make_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend


def draw_icon(size):
    """Draw the FeedbackFlow icon at the given size."""
    pixels = [0] * (size * size * 4)
    cx, cy = size / 2, size / 2
    radius = size * 0.45  # circle radius

    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)

            if dist <= radius:
                # Inside the circle - blue gradient background
                # Gradient from top-left to bottom-right
                t = (dx + dy) / (2 * radius) + 0.5
                t = max(0.0, min(1.0, t))

                # Blue gradient: lighter blue to deeper blue
                r = int(40 + t * 20)
                g = int(120 + t * 30)
                b = int(220 - t * 40)
                a = 255

                # Anti-aliasing at the edge
                edge_dist = radius - dist
                if edge_dist < 1.5:
                    a = int(255 * (edge_dist / 1.5))

                # Check if this pixel is part of the microphone shape
                # Normalize coordinates relative to center
                nx = dx / radius
                ny = dy / radius

                is_mic = False

                # Microphone body (rounded rectangle / capsule)
                mic_width = 0.22
                mic_top = -0.55
                mic_bottom = 0.0
                mic_corner_r = mic_width

                if abs(nx) <= mic_width:
                    if mic_top + mic_corner_r <= ny <= mic_bottom - mic_corner_r:
                        is_mic = True
                    elif ny < mic_top + mic_corner_r:
                        # Top rounded cap
                        cap_dist = math.sqrt(nx * nx + (ny - (mic_top + mic_corner_r)) ** 2)
                        if cap_dist <= mic_corner_r:
                            is_mic = True
                    elif ny > mic_bottom - mic_corner_r:
                        # Bottom rounded cap
                        cap_dist = math.sqrt(nx * nx + (ny - (mic_bottom - mic_corner_r)) ** 2)
                        if cap_dist <= mic_corner_r:
                            is_mic = True

                # Microphone arc (U-shape around the mic body)
                arc_radius = 0.38
                arc_thickness = 0.055
                if -0.1 <= ny <= 0.25:
                    arc_dist = math.sqrt(nx * nx + (ny - (-0.1)) ** 2)
                    if abs(arc_dist - arc_radius) <= arc_thickness and ny >= -0.1:
                        is_mic = True

                # Stand (vertical line below arc)
                stand_width = 0.04
                if abs(nx) <= stand_width and 0.15 <= ny <= 0.45:
                    is_mic = True

                # Base (horizontal line at bottom)
                base_width = 0.2
                base_thickness = 0.04
                if abs(nx) <= base_width and abs(ny - 0.45) <= base_thickness:
                    is_mic = True

                if is_mic:
                    # White microphone
                    r, g, b = 255, 255, 255

                pixels[idx] = r
                pixels[idx + 1] = g
                pixels[idx + 2] = b
                pixels[idx + 3] = a
            else:
                # Outside circle - transparent
                pixels[idx] = 0
                pixels[idx + 1] = 0
                pixels[idx + 2] = 0
                pixels[idx + 3] = 0

    return pixels


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Generate the sizes needed for .iconset
    # Required sizes for iconutil: 16, 32, 128, 256, 512 (and @2x variants)
    iconset_dir = os.path.join(script_dir, 'icon.iconset')
    os.makedirs(iconset_dir, exist_ok=True)

    sizes = {
        'icon_16x16.png': 16,
        'icon_16x16@2x.png': 32,
        'icon_32x32.png': 32,
        'icon_32x32@2x.png': 64,
        'icon_128x128.png': 128,
        'icon_128x128@2x.png': 256,
        'icon_256x256.png': 256,
        'icon_256x256@2x.png': 512,
        'icon_512x512.png': 512,
        'icon_512x512@2x.png': 1024,
    }

    # Cache rendered sizes to avoid re-rendering the same size
    rendered = {}

    for filename, size in sizes.items():
        print(f'Generating {filename} ({size}x{size})...')
        if size not in rendered:
            rendered[size] = draw_icon(size)
        pixels = rendered[size]
        png_data = create_png(size, size, pixels)
        filepath = os.path.join(iconset_dir, filename)
        with open(filepath, 'wb') as f:
            f.write(png_data)

    print(f'Iconset created at {iconset_dir}')
    print('Run: iconutil -c icns icon.iconset -o icon.icns')


if __name__ == '__main__':
    main()
