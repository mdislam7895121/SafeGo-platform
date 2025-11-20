import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }
  
  return keyBuffer;
}

export function encryptSensitive(plaintext: string | null | undefined): string | null {
  if (!plaintext || plaintext.trim() === '') {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    const result = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]).toString('base64');
    
    return result;
  } catch (error) {
    console.error('Encryption failed:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Failed to encrypt sensitive data');
  }
}

export function decryptSensitive(encryptedData: string | null | undefined): string | null {
  if (!encryptedData || encryptedData.trim() === '') {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const buffer = Buffer.from(encryptedData, 'base64');
    
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Failed to decrypt sensitive data');
  }
}

export function maskSensitive(value: string | null | undefined, visibleChars: number = 4): string {
  if (!value || value.trim() === '') {
    return '';
  }
  
  if (value.length <= visibleChars) {
    return '*'.repeat(value.length);
  }
  
  const masked = '*'.repeat(value.length - visibleChars);
  const visible = value.slice(-visibleChars);
  return masked + visible;
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const bcrypt = require('bcrypt');
    bcrypt.hash(password, 10, (err: Error | null, hash: string) => {
      if (err) reject(err);
      else resolve(hash);
    });
  });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const bcrypt = require('bcrypt');
    bcrypt.compare(password, hash, (err: Error | null, result: boolean) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
