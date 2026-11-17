"""Generate the WordRoots app icon (PNG + ICO) with the standard library only.

Design: deep teal rounded square, a white stem with two branches (word tree)
and an amber node marking the base morpheme.
"""

import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src-tauri", "icons")

BG = (13, 74, 74)
BG2 = (22, 112, 106)
STEM = (247, 250, 249)
NODE = (240, 176, 68)


def mix(c1, c2, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c1, c2))


def inside_round_rect(x, y, s, r):
    if x < r and y < r:
        return (x - r) ** 2 + (y - r) ** 2 <= r * r
    if x > s - r and y < r:
        return (x - (s - r)) ** 2 + (y - r) ** 2 <= r * r
    if x < r and y > s - r:
        return (x - r) ** 2 + (y - (s - r)) ** 2 <= r * r
    if x > s - r and y > s - r:
        return (x - (s - r)) ** 2 + (y - (s - r)) ** 2 <= r * r
    return True


def paint(size):
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]
    r = size * 0.22
    for y in range(size):
        for x in range(size):
            if inside_round_rect(x, y, size - 1, r):
                t = (x / size) * 0.55 + (y / size) * 0.45
                px[y][x] = mix(BG, BG2, t) + (255,)

    def put(x, y, color, alpha=1.0):
        xi, yi = int(x), int(y)
        if 0 <= xi < size and 0 <= yi < size and px[yi][xi][3]:
            px[yi][xi] = mix(px[yi][xi], color, alpha) + (255,)

    cx = size / 2
    stem_w = max(1.6, size * 0.075)
    for y in range(int(size * 0.22), int(size * 0.80)):
        for x in range(size):
            if abs(x - cx) <= stem_w:
                put(x, y, STEM)
    for i in range(int(size * 0.16)):
        yy = size * 0.62 - i * 0.9
        put(cx - i * 0.95, yy, STEM)
        put(cx + i * 0.95, yy, STEM)
    rad = size * 0.085
    for y in range(size):
        for x in range(size):
            if (x - cx) ** 2 + (y - size * 0.62) ** 2 <= rad * rad:
                put(x, y, NODE)
    return px


def png_bytes(px):
    size = len(px)
    raw = b"".join(b"\x00" + b"".join(bytes(px[y][x]) for x in range(size)) for y in range(size))

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def ico_bytes(sizes):
    images = []
    for s in sizes:
        px = paint(s)
        header = struct.pack("<IiiHHIIiiII", 40, s, s * 2, 1, 32, 0, s * s * 4, 0, 0, 0, 0)
        rows = b"".join(
            b"".join(bytes((px[y][x][2], px[y][x][1], px[y][x][0], px[y][x][3])) for x in range(s))
            for y in range(s - 1, -1, -1)
        )
        mask_row = ((s + 31) // 32) * 4
        mask = b"\x00" * (mask_row * s)
        images.append((s, header + rows + mask))

    head = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    directory = b""
    blob = b""
    for s, data in images:
        directory += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32, len(data), offset)
        blob += data
        offset += len(data)
    return head + directory + blob


def main():
    os.makedirs(OUT, exist_ok=True)
    for s in (32, 128, 256, 512):
        with open(os.path.join(OUT, f"{s}x{s}.png"), "wb") as f:
            f.write(png_bytes(paint(s)))
    with open(os.path.join(OUT, "icon.ico"), "wb") as f:
        f.write(ico_bytes([16, 32, 48, 256]))
    print("icons written to", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
