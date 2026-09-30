import { describe, expect, it } from 'vitest';

import {
    base32Decode,
    base32Encode,
    currentTotpStep,
    decryptSecret,
    encryptSecret,
    generateRecoveryCodes,
    generateTotp,
    hashRecoveryCode,
    verifyTotp,
} from 'src/utils/totp';

describe('totp', () => {
    // RFC 6238 SHA1 test secret "12345678901234567890"
    const secret = base32Encode(Buffer.from('12345678901234567890'));

    it('round-trips base32', () => {
        expect(base32Decode(secret).toString()).toBe('12345678901234567890');
    });

    it('matches RFC 6238 test vectors', () => {
        expect(generateTotp(secret, Math.floor(59 / 30))).toBe('287082');
        expect(generateTotp(secret, Math.floor(1111111109 / 30))).toBe('081804');
    });

    it('accepts a current code and rejects replayed or expired codes', () => {
        const now = Date.now();
        const step = currentTotpStep(now);
        const code = generateTotp(secret, step);

        expect(verifyTotp(secret, code, null, now)).toBe(step);
        expect(verifyTotp(secret, code, step, now)).toBeNull();
        expect(verifyTotp(secret, generateTotp(secret, step - 5), null, now)).toBeNull();
        expect(verifyTotp(secret, 'abcdef', null, now)).toBeNull();
    });

    it('encrypts secrets at rest', () => {
        const encrypted = encryptSecret(secret);

        expect(encrypted).not.toContain(secret);
        expect(decryptSecret(encrypted)).toBe(secret);
    });

    it('generates unique recovery codes with case-insensitive hashes', () => {
        const codes = generateRecoveryCodes();

        expect(new Set(codes).size).toBe(10);
        expect(hashRecoveryCode(codes[0].toLowerCase())).toBe(hashRecoveryCode(codes[0]));
    });
});
