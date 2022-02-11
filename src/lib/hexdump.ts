export function hexdump(buffer: Buffer) {
  let out = "";
  for (let i = 0; i < buffer.length; i += 16) {
    const bytes = [];
    for (let j = 0; j < 16; ++j) {
      const offset = i + j;
      if (offset >= buffer.length) {
        break;
      }
      const value = buffer.readUInt8(offset);
      bytes.push(value);
    }
    out += i.toString(16).padStart(8, "0") + ": " + hex(bytes) + "  " + printable(bytes) + "\n";
  }
  return out;
}

function hex(bytes: number[]) {
  return bytes
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ")
    .padEnd(16 * 3 - 1, " ");
}

function printable(bytes: number[]) {
  return bytes.map((b) => (0x20 <= b && b <= 0x7e ? String.fromCharCode(b) : ".")).join("");
}
