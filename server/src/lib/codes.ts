import { customAlphabet, nanoid } from 'nanoid';

// Unambiguous when handwritten/typed: no 0/O, 1/I/L, etc.
const DESKTOP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generatePublicToken(): string {
  // 21 chars of default nanoid alphabet — unguessable, safe to embed in a QR/URL.
  return nanoid();
}

export function generateDesktopCode(length: number): string {
  const generate = customAlphabet(DESKTOP_CODE_ALPHABET, length);
  return generate();
}
