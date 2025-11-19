import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "safego-default-encryption-key-32b"; // Must be 32 bytes
const ALGORITHM = "aes-256-cbc";

// Ensure the key is exactly 32 bytes
function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32);
  return Buffer.from(key, "utf-8");
}

/**
 * Encrypts sensitive data (e.g., NID) for secure storage
 * @param text - The plain text to encrypt
 * @returns Encrypted string in format: iv:encryptedData
 */
export function encrypt(text: string): string {
  if (!text) return "";
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  // Return IV and encrypted data separated by ':'
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts encrypted data
 * @param encryptedText - Encrypted string in format: iv:encryptedData
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted format");
    }
    
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return "";
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
