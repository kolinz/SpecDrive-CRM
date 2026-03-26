const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * ENCRYPTION_KEY を 32 バイトに正規化する
 * 環境変数が短い場合は sha256 でハッシュ化して 32 バイトを確保する
 */
function getKey() {
  const raw = process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production!!';
  return crypto.createHash('sha256').update(raw).digest(); // 32 bytes
}

/**
 * テキストを AES-256-CBC で暗号化する
 * @param {string} text - 平文
 * @returns {string} "iv:encryptedHex" 形式の文字列
 */
function encrypt(text) {
  if (!text) return text;
  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * 暗号化済み文字列を復号する
 * @param {string} encryptedText - "iv:encryptedHex" 形式の文字列
 * @returns {string} 平文
 */
function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;
  // 暗号化されていない（移行前の）平文をそのまま返す
  if (!encryptedText.includes(':')) return encryptedText;
  const [ivHex, encHex] = encryptedText.split(':');
  const iv       = Buffer.from(ivHex, 'hex');
  const enc      = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
