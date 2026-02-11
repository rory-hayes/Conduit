import { beforeEach, describe, expect, it } from 'vitest';
import { decryptFromB64, encryptToB64 } from '../src/crypto';

const KEY_A = Buffer.alloc(32, 1).toString('base64');
const KEY_B = Buffer.alloc(32, 2).toString('base64');

describe('token crypto', () => {
  beforeEach(() => {
    process.env.TOKEN_ENC_KEY_B64 = KEY_A;
  });

  it('roundtrips plaintext', async () => {
    const ciphertext = await encryptToB64('sensitive-token-value');
    expect(ciphertext).not.toContain('sensitive-token-value');

    const plaintext = await decryptFromB64(ciphertext);
    expect(plaintext).toBe('sensitive-token-value');
  });

  it('fails with wrong key', async () => {
    const ciphertext = await encryptToB64('secret');
    process.env.TOKEN_ENC_KEY_B64 = KEY_B;

    await expect(decryptFromB64(ciphertext)).rejects.toThrow();
  });
});
