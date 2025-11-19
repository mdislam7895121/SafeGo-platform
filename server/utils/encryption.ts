import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard IV length
const AUTH_TAG_LENGTH = 16; // GCM auth tag length

/**
 * Get the encryption key from environment variable
 * CRITICAL: This must be a 32-byte (256-bit) key set in environment
 * Fails fast if not properly configured
 */
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required for NID encryption");
  }
  
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be exactly 32 bytes, got ${key.length} bytes`);
  }
  
  return Buffer.from(key, "utf-8");
}

/**
 * Encrypts sensitive data (e.g., NID) using AES-256-GCM
 * GCM provides both encryption and authentication (AEAD)
 * 
 * @param text - The plain text to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (all hex-encoded)
 */
export function encrypt(text: string): string {
  if (!text) return "";
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    // Get the authentication tag (proves data hasn't been tampered with)
    const authTag = cipher.getAuthTag();
    
    // Return: iv:authTag:ciphertext (all hex-encoded)
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts AES-256-GCM encrypted data
 * Verifies authentication tag to detect tampering
 * 
 * @param encryptedText - Encrypted string in format: iv:authTag:ciphertext
 * @returns Decrypted plain text
 * @throws Error if data has been tampered with or format is invalid
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  
  try {
    const parts = encryptedText.split(":");
    
    // Check format: iv:authTag:ciphertext
    if (parts.length !== 3) {
      // Attempt to handle legacy CBC format (iv:ciphertext) - for backward compatibility
      if (parts.length === 2) {
        console.warn("Legacy CBC encrypted data detected - consider re-encrypting with GCM");
        return decryptLegacyCBC(encryptedText);
      }
      throw new Error("Invalid encrypted format");
    }
    
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    
    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error("Invalid IV length");
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid auth tag length");
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    // Do NOT return empty string - throw error to signal tampering/corruption
    throw new Error("Failed to decrypt data - data may be corrupted or tampered with");
  }
}

/**
 * Legacy CBC decryption for backward compatibility
 * DEPRECATED: Only for migrating old data
 */
function decryptLegacyCBC(encryptedText: string): string {
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid legacy CBC format");
    }
    
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    
    // Use legacy CBC algorithm with padded key (same as old implementation)
    const legacyKey = (process.env.ENCRYPTION_KEY || "safego-default-encryption-key-32b")
      .padEnd(32, "0")
      .slice(0, 32);
    const key = Buffer.from(legacyKey, "utf-8");
    
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Legacy CBC decryption error:", error);
    throw new Error("Failed to decrypt legacy CBC data");
  }
}

/**
 * Validates Bangladesh NID format (10-17 digits)
 */
export function isValidBdNid(nid: string): boolean {
  return /^\d{10,17}$/.test(nid);
}

/**
 * Validates Bangladesh phone number format (01XXXXXXXXX)
 */
export function isValidBdPhone(phone: string): boolean {
  return /^01[0-9]{9}$/.test(phone);
}
