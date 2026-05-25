import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function nanoid(size = 21): string {
  const bytes = randomBytes(size);
  let id = '';
  for (let i = 0; i < size; i++) {
    // biome-ignore lint/style/noNonNullAssertion: index is always in bounds
    id += ALPHABET[bytes[i]! % 62];
  }
  return id;
}
