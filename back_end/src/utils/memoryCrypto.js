import crypto from 'node:crypto'
import { env } from '../config/env.js'

// Derive a 32-byte (256-bit) buffer key from MEMORY_ENCRYPTION_KEY using SHA-256
function getMasterKey() {
  const secret = env.memoryEncryptionKey || 'default_medai_memory_secret_key_32bytes'
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypts a text string using AES-256-GCM with a 96-bit IV and 128-bit Auth Tag.
 * Output format: "ivHex:authTagHex:encryptedHex"
 * @param {string} text 
 * @param {number} keyVersion 
 * @returns {string}
 */
export function encryptText(text, keyVersion = 1) {
  if (!text || typeof text !== 'string') return text
  try {
    const key = getMasterKey()
    const iv = crypto.randomBytes(12) // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return `${iv.toString('hex')}:${authTag}:${encrypted}`
  } catch (err) {
    console.error('[MemoryCrypto] Encryption error:', err)
    return text
  }
}

/**
 * Decrypts an encrypted text formatted as "ivHex:authTagHex:encryptedHex".
 * Gracefully handles unencrypted legacy text.
 * @param {string} encryptedData 
 * @param {number} keyVersion 
 * @returns {string}
 */
export function decryptText(encryptedData, keyVersion = 1) {
  if (!encryptedData || typeof encryptedData !== 'string') return encryptedData
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    // Plaintext or legacy format
    return encryptedData
  }

  try {
    const [ivHex, authTagHex, encryptedHex] = parts
    const key = getMasterKey()
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('[MemoryCrypto] Decryption error:', err)
    return encryptedData
  }
}
