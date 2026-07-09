/**
 * Base64 <-> bytes helpers with zero dependencies. `btoa`/`atob` are global in
 * both Node ≥ 20 and modern browsers, keeping the package network- and
 * dependency-free.
 */

/** Encode raw bytes as a standard base64 string. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Decode a standard base64 string back to raw bytes. */
export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
