import crypto from 'crypto';

import { env } from 'src/utils/helpers';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

export const base32Encode = (buffer: Buffer): string => {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];

    return output;
};

export const base32Decode = (input: string): Buffer => {
    const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (const char of clean) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1) throw new Error('Invalid base32 character');
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return Buffer.from(bytes);
};

export const generateTotpSecret = (): string => base32Encode(crypto.randomBytes(20));

/**
 * Generate an RFC 6238 TOTP code for the given time step.
 */
export const generateTotp = (secret: string, step: number): string => {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));

    const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;

    return code.toString().padStart(DIGITS, '0');
};

export const currentTotpStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/**
 * Verify a TOTP code within a ±1 step window.
 * Returns the matched time step, or null when the code is invalid or was
 * already used (step <= lastUsedStep), preventing replay.
 */
export const verifyTotp = (
    secret: string,
    code: string,
    lastUsedStep?: number | null,
    now = Date.now(),
): number | null => {
    if (!/^\d{6}$/.test(String(code ?? ''))) return null;

    const current = currentTotpStep(now);

    for (const step of [current - 1, current, current + 1]) {
        if (lastUsedStep != null && step <= lastUsedStep) continue;

        const expected = Buffer.from(generateTotp(secret, step));
        if (crypto.timingSafeEqual(expected, Buffer.from(code))) return step;
    }

    return null;
};

export const buildOtpAuthUrl = (secret: string, account: string, issuer = 'Artisyn') =>
    `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}` +
    `&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;

const encryptionKey = () =>
    crypto.createHash('sha256')
        .update(String(env('TWO_FACTOR_ENCRYPTION_KEY', '') || env('JWT_SECRET', '')))
        .digest();

/**
 * Encrypt a TOTP secret at rest using AES-256-GCM.
 */
export const encryptSecret = (plain: string): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

    return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString('base64')).join('.');
};

export const decryptSecret = (payload: string): string => {
    const [iv, tag, encrypted] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

export const generateRecoveryCodes = (count = 10): string[] =>
    Array.from({ length: count }, () => {
        const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
        return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });

export const hashRecoveryCode = (code: string): string =>
    crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
