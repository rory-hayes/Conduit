const decodeBase64 = (value: string): Uint8Array => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const encodeBase64 = (value: Uint8Array): string => btoa(String.fromCharCode(...value));

const getKey = () => {
  const keyB64 = Deno.env.get('TOKEN_ENC_KEY_B64') ?? '';
  if (!keyB64) {
    throw new Error('TOKEN_ENC_KEY_B64 is required for token encryption');
  }

  const keyMaterial = decodeBase64(keyB64);
  if (keyMaterial.length !== 32) {
    throw new Error('TOKEN_ENC_KEY_B64 must decode to 32 bytes');
  }

  return keyMaterial;
};

const importAesKey = async (): Promise<CryptoKey> => {
  return crypto.subtle.importKey('raw', getKey(), 'AES-GCM', false, ['encrypt', 'decrypt']);
};

export const encryptToB64 = async (plaintext: string): Promise<string> => {
  const key = await importAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded));
  const payload = new Uint8Array(iv.length + encrypted.length);
  payload.set(iv, 0);
  payload.set(encrypted, iv.length);
  return encodeBase64(payload);
};

export const decryptFromB64 = async (ciphertext: string): Promise<string> => {
  const key = await importAesKey();
  const payload = decodeBase64(ciphertext);
  const iv = payload.slice(0, 12);
  const encrypted = payload.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
};
