import gzip
import json
import sys
from io import BytesIO

try:
    from PIL import Image
except Exception:
    sys.exit(2)


def main():
    image_bytes = sys.stdin.buffer.read()
    if not image_bytes:
        print("null")
        return

    image = Image.open(BytesIO(image_bytes)).convert("RGBA")
    width, height = image.size
    data = image.tobytes()
    magics = ("stealth_pngcomp", "stealth_pnginfo")

    def read_bit(bit_index):
        x = bit_index // height
        y = bit_index % height
        if x >= width:
            raise ValueError("Stealth metadata is truncated.")
        return data[(y * width + x) * 4 + 3] & 1

    def read_bytes(bit_offset, byte_length):
        output = bytearray(byte_length)
        for byte_index in range(byte_length):
            value = 0
            for bit in range(8):
                value = (value << 1) | read_bit(bit_offset + byte_index * 8 + bit)
            output[byte_index] = value
        return bytes(output)

    magic = None
    for candidate in magics:
        if read_bytes(0, len(candidate)).decode("utf-8", "ignore") == candidate:
            magic = candidate
            break

    if not magic:
        print("null")
        return

    payload_bit_length = int.from_bytes(read_bytes(len(magic) * 8, 4), "big")
    payload_byte_length = (payload_bit_length + 7) // 8
    payload_bit_offset = len(magic) * 8 + 32
    if payload_bit_offset + payload_bit_length > width * height:
        print("null")
        return

    payload_bytes = read_bytes(payload_bit_offset, payload_byte_length)
    if magic == "stealth_pngcomp":
        payload_bytes = gzip.decompress(payload_bytes)

    payload = payload_bytes.decode("utf-8", "replace").rstrip("\0")
    print(json.dumps({"format": magic, "text": payload}, ensure_ascii=True))


if __name__ == "__main__":
    main()
