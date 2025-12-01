import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const keyEnv = process.env.ENCRYPTION_KEY;
  
  if (!keyEnv) {
    throw new Error(
      '[SecureEncryption] CRITICAL: ENCRYPTION_KEY environment variable is not set. ' +
      'This is required for Phase 6B security features. ' +
      'Please set a 64-character hex string (256-bit key) in your secrets.'
    );
  }

  if (keyEnv.length === 64 && /^[0-9a-fA-F]+$/.test(keyEnv)) {
    cachedKey = Buffer.from(keyEnv, 'hex');
  } else if (keyEnv.length === 32) {
    cachedKey = Buffer.from(keyEnv, 'utf8');
  } else if (keyEnv.length >= 32) {
    cachedKey = crypto.createHash('sha256').update(keyEnv).digest();
    console.warn(
      '[SecureEncryption] WARNING: ENCRYPTION_KEY is not in optimal format. ' +
      'For best security, use a 64-character hex string. Key was derived via SHA-256.'
    );
  } else {
    throw new Error(
      '[SecureEncryption] CRITICAL: ENCRYPTION_KEY is too short. ' +
      'Must be at least 32 characters (or 64 hex characters for a proper 256-bit key).'
    );
  }

  if (cachedKey.length !== KEY_LENGTH) {
    throw new Error(
      '[SecureEncryption] CRITICAL: Derived key is not 256 bits. ' +
      'Please provide a valid 64-character hex string or 32-character ASCII string.'
    );
  }

  return cachedKey;
}

export function validateEncryptionKeyOnStartup(): boolean {
  try {
    getEncryptionKey();
    console.log('[SecureEncryption] Encryption key validated successfully');
    return true;
  } catch (error) {
    console.error('[SecureEncryption]', (error as Error).message);
    return false;
  }
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return combined.toString('base64');
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  
  const combined = Buffer.from(encryptedData, 'base64');
  
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('[SecureEncryption] Invalid encrypted data format');
  }
  
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

export function encryptBuffer(data: Buffer): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBuffer(encryptedData: Buffer): Buffer {
  const key = getEncryptionKey();
  
  if (encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('[SecureEncryption] Invalid encrypted data format');
  }
  
  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted;
}

export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function hashDataWithSalt(data: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(data).digest('hex');
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateSecureId(): string {
  return crypto.randomUUID();
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256');
}

export function generateSalt(): Buffer {
  return crypto.randomBytes(16);
}

export const secureEncryption = {
  encrypt,
  decrypt,
  encryptBuffer,
  decryptBuffer,
  hashData,
  hashDataWithSalt,
  generateSecureToken,
  generateSecureId,
  constantTimeCompare,
  deriveKey,
  generateSalt,
  validateEncryptionKeyOnStartup
};

export default secureEncryption;
