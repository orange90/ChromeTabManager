#!/usr/bin/env python3
import os
import struct
import zlib

def create_png(width, height, pixels):
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc

    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'
        for x in range(width):
            idx = (y * width + x) * 4
            raw_data += bytes(pixels[idx:idx+4])

    compressed = zlib.compress(raw_data)
    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', compressed)
        + chunk(b'IEND', b'')
    )

def draw_icon(size):
    center = size // 2
    outer_radius = int(size * 0.44)
    inner_size = int(size * 0.28)
    gap = max(1, size // 40)

    pixels = [0] * (size * size * 4)

    def set_pixel(x, y, r, g, b, a=255):
        if 0 <= x < size and 0 <= y < size:
            idx = (y * size + x) * 4
            pixels[idx] = r
            pixels[idx+1] = g
            pixels[idx+2] = b
            pixels[idx+3] = a

    def fill_circle(cx, cy, r, r_color, g_color, b_color, a=255):
        for y in range(max(0, cy - r), min(size, cy + r + 1)):
            for x in range(max(0, cx - r), min(size, cx + r + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2:
                    set_pixel(x, y, r_color, g_color, b_color, a)

    def fill_rect(x1, y1, w, h, r_color, g_color, b_color, a=255):
        for y in range(max(0, y1), min(size, y1 + h)):
            for x in range(max(0, x1), min(size, x1 + w)):
                set_pixel(x, y, r_color, g_color, b_color, a)

    fill_circle(center, center, outer_radius, 255, 149, 0, 255)

    icon_left = center - inner_size // 2
    icon_top = center - inner_size // 2
    fill_rect(icon_left - gap, icon_top - gap, inner_size + gap * 2, gap, 255, 255, 255, 200)
    fill_rect(icon_left - gap, icon_top + inner_size, inner_size + gap * 2, gap, 255, 255, 255, 200)
    fill_rect(icon_left - gap, icon_top - gap, gap, inner_size + gap * 2, 255, 255, 255, 200)
    fill_rect(icon_left + inner_size, icon_top - gap, gap, inner_size + gap * 2, 255, 255, 255, 200)

    fill_rect(icon_left, icon_top, inner_size, inner_size, 255, 255, 255, 255)

    return create_png(size, size, bytes(pixels))

def main():
    icons_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    sizes = [16, 48, 128]
    for size in sizes:
        png_data = draw_icon(size)
        filepath = os.path.join(icons_dir, f'icon{size}.png')
        with open(filepath, 'wb') as f:
            f.write(png_data)
        print(f'Generated icon{size}.png')

    print('All icons generated successfully!')

if __name__ == '__main__':
    main()
