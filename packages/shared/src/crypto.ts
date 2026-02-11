const decodeBase64 = (value: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }

  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const encodeBase64 = (value: Uint8Array): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value).toString('base64');
  }

  return btoa(String.fromCharCode(...value));
};

const getCrypto = (): Crypto => {
  if (globalThis.crypto?.subtle) {
    return globalThis.crypto;
  }

  throw new Error('WebCrypto not available');
};

const getKeyMaterial = () => {
  const keyB64 = process.env.TOKEN_ENC_KEY_B64 ?? '';
  if (!keyB64) {
    throw new Error('TOKEN_ENC_KEY_B64 is required for token encryption');
  }

  const bytes = decodeBase64(keyB64);
  if (bytes.length !== 32) {
    throw new Error('TOKEN_ENC_KEY_B64 must decode to 32 bytes');
  }

  return bytes;
};

const importAesKey = async (): Promise<CryptoKey> => {
  const crypto = getCrypto();
  const material = getKeyMaterial();

  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

export const encryptToB64 = async (plaintext: string): Promise<string> => {
  const key = await importAesKey();
  const crypto = getCrypto();
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
  const crypto = getCrypto();
  const payload = decodeBase64(ciphertext);

  if (payload.length <= 12) {
    throw new Error('Invalid token ciphertext');
  }

  const iv = payload.slice(0, 12);
  const encrypted = payload.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
};
