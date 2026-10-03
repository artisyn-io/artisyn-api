import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../index';
import { faker } from '@faker-js/faker';
import { prisma } from 'src/db';
import request from 'supertest';
import argon2 from 'argon2';
import { addMinutes, subMinutes } from 'date-fns';
import { generateAccessToken, hashOtp, secureOtp } from 'src/utils/helpers';

vi.mock('src/mailer/mailer', () => ({
    sendMail: vi.fn().mockResolvedValue(null),
}));

describe('Auth Security and OTP Hardening Tests', () => {
    let testUser: any;
    let userToken: string;
    const email = faker.internet.email().toLowerCase();

    beforeAll(async () => {
        const password = await argon2.hash('Password123#');
        testUser = await prisma.user.create({
            data: {
                email,
                firstName: 'Security',
                lastName: 'Test',
                password,
            },
        });
    });

    beforeEach(async () => {
        await prisma.passwordCodeResets.deleteMany({ where: { email } });
        await prisma.user.update({
            where: { id: testUser.id },
            data: {
                passwordResetResendAt: null,
                emailVerifiedAt: null,
                emailVerificationCode: null,
                emailVerificationExpiresAt: null,
                emailVerificationAttemptCount: 0,
                emailVerificationConsumedAt: null,
                emailVerificationRevokedAt: null,
                emailVerificationResendAt: null,
            },
        });
    });

    afterAll(async () => {
        if (testUser?.id) {
            await prisma.passwordCodeResets.deleteMany({ where: { email } });
            await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
        }
    });

    it('1. Enumeration resistance: password reset for non-existent email returns identical success status and message shape', async () => {
        const nonExistentEmail = 'nonexistent-' + faker.internet.email();

        const resRegistered = await request(app).post('/api/auth/password/reset').send({ email });
        const resNonExistent = await request(app).post('/api/auth/password/reset').send({ email: nonExistentEmail });

        expect(resRegistered.statusCode).toBe(201);
        expect(resNonExistent.statusCode).toBe(201);

        expect(resRegistered.body.status).toBe(resNonExistent.body.status);
        expect(resRegistered.body.message).toBe(resNonExistent.body.message);
        expect(resRegistered.body.code).toBe(resNonExistent.body.code);
        expect(await prisma.passwordCodeResets.count({ where: { email: nonExistentEmail } })).toBe(0);

        const savedCode = await prisma.passwordCodeResets.findFirst({
            where: { email, purpose: 'password_reset' },
            orderBy: { createdAt: 'desc' },
        });
        expect(savedCode?.code).toMatch(/^[a-f0-9]{64}$/);
        expect(savedCode?.code).not.toMatch(/^\d{6}$/);
    });

    it('2. Expiry: expired reset code is rejected', async () => {
        const otp = '123456';
        const codeHash = hashOtp(otp);

        await prisma.passwordCodeResets.create({
            data: {
                email,
                code: codeHash,
                purpose: 'password_reset',
                expiresAt: subMinutes(new Date(), 10), // expired 10 minutes ago
                attemptCount: 0,
            },
        });

        const res = await request(app).put('/api/auth/password/reset').send({
            email,
            code: otp,
            password: 'NewPassword123#',
            password_confirmation: 'NewPassword123#',
        });

        expect(res.statusCode).toBe(422);
        expect(res.body.errors.code).toBeDefined();
        expect(res.body.errors.code[0]).toContain('expired');
    });

    it('3. Replay protection: consumed code cannot be reused', async () => {
        const otp = '654321';
        const codeHash = hashOtp(otp);

        const resetRecord = await prisma.passwordCodeResets.create({
            data: {
                email,
                code: codeHash,
                purpose: 'password_reset',
                expiresAt: addMinutes(new Date(), 15),
                consumedAt: new Date(), // already consumed
                revokedAt: new Date(),
                attemptCount: 0,
            },
        });

        const res = await request(app).put('/api/auth/password/reset').send({
            email,
            code: otp,
            password: 'NewPassword123#',
            password_confirmation: 'NewPassword123#',
        });

        expect(res.statusCode).toBe(422);
        expect(res.body.errors.code).toBeDefined();

        await prisma.passwordCodeResets.delete({ where: { id: resetRecord.id } }).catch(() => {});
    });

    it('4. Attempt lockout: exceeding max failed attempts locks out the code', async () => {
        const otp = '111222';
        const codeHash = hashOtp(otp);

        const resetRecord = await prisma.passwordCodeResets.create({
            data: {
                email,
                code: codeHash,
                purpose: 'password_reset',
                expiresAt: addMinutes(new Date(), 15),
                attemptCount: 5, // reached max attempts
            },
        });

        const res = await request(app).put('/api/auth/password/reset').send({
            email,
            code: otp,
            password: 'NewPassword123#',
            password_confirmation: 'NewPassword123#',
        });

        expect(res.statusCode).toBe(422);
        expect(res.body.errors.code[0]).toContain('invalid or has expired');

        await prisma.passwordCodeResets.delete({ where: { id: resetRecord.id } }).catch(() => {});
    });

    it('4a. Failed guesses increment attempts and the code stops being checked after five', async () => {
        const otp = '112233';
        const resetRecord = await prisma.passwordCodeResets.create({
            data: {
                email,
                code: hashOtp(otp),
                purpose: 'password_reset',
                expiresAt: addMinutes(new Date(), 15),
                attemptCount: 0,
            },
        });

        for (let attempt = 0; attempt < 5; attempt++) {
            const response = await request(app).put('/api/auth/password/reset').send({ email, code: '000000' });
            expect(response.statusCode).toBe(422);
        }

        expect((await prisma.passwordCodeResets.findUniqueOrThrow({ where: { id: resetRecord.id } })).attemptCount).toBe(5);
        const correctAfterLockout = await request(app).put('/api/auth/password/reset').send({ email, code: otp });
        expect(correctAfterLockout.statusCode).toBe(422);
    });

    it('5. Resend invalidation: requesting password reset invalidates prior codes', async () => {
        const otp1 = '999888';
        const codeHash1 = hashOtp(otp1);

        await prisma.passwordCodeResets.create({
            data: {
                email,
                code: codeHash1,
                purpose: 'password_reset',
                expiresAt: addMinutes(new Date(), 15),
            },
        });

        // Request new reset code
        const res = await request(app).post('/api/auth/password/reset').send({ email });
        expect(res.statusCode).toBe(201);

        // Trying first code should now fail because it was revoked/invalidated
        const resVerify = await request(app).put('/api/auth/password/reset').send({
            email,
            code: otp1,
            password: 'NewPassword123#',
            password_confirmation: 'NewPassword123#',
        });

        expect(resVerify.statusCode).toBe(422);
    });

    it('6. Concurrent use: simultaneous submissions consume code exactly once', async () => {
        const otp = '777666';
        const codeHash = hashOtp(otp);

        await prisma.passwordCodeResets.create({
            data: {
                email,
                code: codeHash,
                purpose: 'password_reset',
                expiresAt: addMinutes(new Date(), 15),
                attemptCount: 0,
            },
        });

        // Fire 5 concurrent requests with the correct code
        const promises = Array.from({ length: 5 }, () =>
            request(app).put('/api/auth/password/reset').send({
                email,
                code: otp,
                password: 'NewPassword123#',
                password_confirmation: 'NewPassword123#',
            })
        );

        const results = await Promise.all(promises);
        const successes = results.filter((r) => r.statusCode === 202);
        const failures = results.filter((r) => r.statusCode === 422);

        // Exactly 1 request should succeed (consume code), the rest should fail
        expect(successes.length).toBe(1);
        expect(failures.length).toBe(4);
    });

    it('7. Reset resend cooldown preserves generic success and prevents duplicate issuance', async () => {
        const first = await request(app).post('/api/auth/password/reset').send({ email });
        const second = await request(app).post('/api/auth/password/reset').send({ email });

        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(first.statusCode);
        expect(second.body).toEqual(first.body);
        expect(await prisma.passwordCodeResets.count({ where: { email, purpose: 'password_reset' } })).toBe(1);
    });

    it('8. Verification expiry is independent of User.updatedAt', async () => {
        const otp = '314159';
        await prisma.user.update({
            where: { id: testUser.id },
            data: {
                emailVerificationCode: hashOtp(otp),
                emailVerificationPurpose: 'email_verification',
                emailVerificationExpiresAt: addMinutes(new Date(), 15),
                updatedAt: subMinutes(new Date(), 60),
            },
        });
        const { token } = generateAccessToken({ username: email, id: testUser.id, index: 1 });
        const response = await request(app).put('/api/account/verify/email').set('Authorization', `Bearer ${token}`).send({ code: otp });

        expect(response.statusCode).toBe(202);
        const updated = await prisma.user.findUniqueOrThrow({ where: { id: testUser.id } });
        expect(updated.emailVerifiedAt).not.toBeNull();
        expect(updated.emailVerificationCode).toBeNull();
    });

    it('9. Expired verification OTP is rejected with a recent User.updatedAt', async () => {
        const otp = '271828';
        await prisma.user.update({
            where: { id: testUser.id },
            data: {
                emailVerificationCode: hashOtp(otp),
                emailVerificationPurpose: 'email_verification',
                emailVerificationExpiresAt: subMinutes(new Date(), 1),
                updatedAt: new Date(),
            },
        });
        const { token } = generateAccessToken({ username: email, id: testUser.id, index: 2 });
        const response = await request(app).put('/api/account/verify/email').set('Authorization', `Bearer ${token}`).send({ code: otp });

        expect(response.statusCode).toBe(422);
        expect((await prisma.user.findUniqueOrThrow({ where: { id: testUser.id } })).emailVerifiedAt).toBeNull();
    });

    it('10. Verification resend replaces the old digest and enforces cooldown', async () => {
        const oldOtp = '161803';
        await prisma.user.update({
            where: { id: testUser.id },
            data: {
                emailVerificationCode: hashOtp(oldOtp),
                emailVerificationPurpose: 'email_verification',
                emailVerificationExpiresAt: addMinutes(new Date(), 15),
            },
        });
        const { token } = generateAccessToken({ username: email, id: testUser.id, index: 3 });
        const response = await request(app).put('/api/account/verify/email').set('Authorization', `Bearer ${token}`).send({ resend: true });
        expect(response.statusCode).toBe(202);
        const user = await prisma.user.findUniqueOrThrow({ where: { id: testUser.id } });
        expect(user.emailVerificationCode).not.toBe(hashOtp(oldOtp));
        expect(user.emailVerificationPurpose).toBe('email_verification');

        const secondResponse = await request(app).put('/api/account/verify/email').set('Authorization', `Bearer ${token}`).send({ resend: true });
        expect(secondResponse.statusCode).toBe(422);
    });

    it('11. Concurrent email verification consumes the OTP exactly once', async () => {
        const otp = '424242';
        await prisma.user.update({
            where: { id: testUser.id },
            data: {
                emailVerificationCode: hashOtp(otp),
                emailVerificationPurpose: 'email_verification',
                emailVerificationExpiresAt: addMinutes(new Date(), 15),
            },
        });
        const { token } = generateAccessToken({ username: email, id: testUser.id, index: 4 });
        const responses = await Promise.all(Array.from({ length: 5 }, () =>
            request(app).put('/api/account/verify/email').set('Authorization', `Bearer ${token}`).send({ code: otp })
        ));

        expect(responses.filter((response) => response.statusCode === 202)).toHaveLength(1);
        expect(responses.filter((response) => response.statusCode === 422)).toHaveLength(4);
    });
});
