import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import app from '../../index'
import argon2 from 'argon2';
import { prisma } from 'src/db';
import request from 'supertest';

let userToken: string;
let testUserId: string;

beforeAll(async () => {

    const user = await prisma.user.create({
        data: {
            email: `test-prefs-${Date.now()}@example.com`,
            password: await argon2.hash('password'),
            firstName: 'Test',
            lastName: 'User',
        },
    });

    const receiverResponse = await request(app)
        .post("/api/auth/login")
        .send({
            email: user.email,
            password: "password",
        });

    userToken = receiverResponse.body.token;
    testUserId = receiverResponse.body.data.id;
});


afterAll(async () => {
    // Clean up test data
    await prisma.userPreferences.deleteMany({
        where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
        where: { id: testUserId },
    });
});

describe('Preferences', () => {
    afterEach(async () => {
        await prisma.userPreferences.deleteMany({
            where: { userId: testUserId },
        });
    });

    it('should create default user preferences', async () => {
        const prefs = await prisma.userPreferences.create({
            data: {
                userId: testUserId,
            },
        });

        expect(prefs.emailNotifications).toBe(true);
        expect(prefs.pushNotifications).toBe(true);
        expect(prefs.digestFrequency).toBe('weekly');
        expect(prefs.theme).toBe('light');
    });

    it('should update notification preferences', async () => {
        const prefs = await prisma.userPreferences.create({
            data: {
                userId: testUserId,
                emailNotifications: true,
                pushNotifications: true,
            },
        });

        const updated = await prisma.userPreferences.update({
            where: { id: prefs.id },
            data: {
                emailNotifications: false,
                pushNotifications: false,
            },
        });

        expect(updated.emailNotifications).toBe(false);
        expect(updated.pushNotifications).toBe(false);
    });

    it('should support all valid digest frequencies', async () => {
        const frequencies = ['daily', 'weekly', 'monthly', 'never'];

        for (const freq of frequencies) {
            const prefs = await prisma.userPreferences.create({
                data: {
                    userId: testUserId,
                    digestFrequency: freq,
                },
            });

            expect(prefs.digestFrequency).toBe(freq);

            await prisma.userPreferences.delete({ where: { id: prefs.id } });
        }
    });

    it('should support all valid themes', async () => {
        const themes = ['light', 'dark', 'system'];

        for (const theme of themes) {
            const prefs = await prisma.userPreferences.create({
                data: {
                    userId: testUserId,
                    theme,
                },
            });

            expect(prefs.theme).toBe(theme);

            await prisma.userPreferences.delete({ where: { id: prefs.id } });
        }
    });

    it('should toggle two-factor authentication', async () => {
        const prefs = await prisma.userPreferences.create({
            data: {
                userId: testUserId,
                twoFactorEnabled: false,
            },
        });

        const updated = await prisma.userPreferences.update({
            where: { id: prefs.id },
            data: { twoFactorEnabled: true },
        });

        expect(updated.twoFactorEnabled).toBe(true);
    });

    it('should store custom preferences as JSON', async () => {
        const customPrefs = {
            customSetting1: 'value1',
            customSetting2: 42,
        };

        const prefs = await prisma.userPreferences.create({
            data: {
                userId: testUserId,
                customPreferences: customPrefs,
            },
        });

        expect(prefs.customPreferences).toEqual(customPrefs);
    });
});


describe('Preferences Controller', () => {

    describe('getPreferences', () => {
        it('should return user preferences', async () => {
            // Create preferences for the user
            await prisma.userPreferences.create({
                data: {
                    userId: testUserId,
                    emailNotifications: true,
                    pushNotifications: false,
                    theme: 'dark',
                    language: 'en',
                },
            });

            const res = await request(app)
                .get('/api/preferences')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200)
                .send({
                    emailNotifications: false,
                    theme: 'dark',
                });

            expect(res.body).toEqual(
                expect.objectContaining({
                    status: 'success',
                    data: expect.objectContaining({
                        userId: testUserId,
                        emailNotifications: true,
                        pushNotifications: false,
                        theme: 'dark',
                        language: 'en',
                    }),
                })
            );

        });

        it('should return default preferences if none exist', async () => {
            await prisma.userPreferences.deleteMany({
                where: { userId: testUserId },
            });

            const res = await request(app)
                .get('/api/preferences')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200)
                .send({
                    emailNotifications: false,
                    theme: 'dark',
                });

            expect(res.body).toEqual(
                expect.objectContaining({
                    status: 'success',
                    data: expect.objectContaining({
                        userId: testUserId,
                        emailNotifications: true,
                        pushNotifications: true,
                        theme: 'light',
                        language: 'en',
                    }),
                })
            );
        });
    });

    describe('updatePreferences', () => {
        it('should update user preferences successfully', async () => {
            const res = await request(app)
                .post('/api/preferences')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(202)
                .send({
                    emailNotifications: false,
                    theme: 'dark',
                });

            expect(res.body).toEqual(
                expect.objectContaining({
                    status: 'success',
                    data: expect.objectContaining({
                        userId: testUserId,
                        emailNotifications: false,
                        theme: 'dark',
                    }),
                })
            );
        });

        it('should toggle two-factor authentication', async () => {
            const res = await request(app)
                .post('/api/preferences/two-factor/toggle')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(202)
                .send({
                    emailNotifications: false,
                    theme: 'dark',
                });

            expect(res.body).toEqual(
                expect.objectContaining({
                    status: 'success',
                    data: expect.objectContaining({
                        twoFactorEnabled: true,
                    }),
                })
            );

            const res1 = await request(app)
                .post('/api/preferences/two-factor/toggle')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(202)
                .send({
                    emailNotifications: false,
                    theme: 'dark',
                });

            expect(res1.body).toEqual(
                expect.objectContaining({
                    status: 'success',
                    data: expect.objectContaining({
                        twoFactorEnabled: false,
                    }),
                })
            );
        });

        it('should validate preference values', async () => {
            const res = await request(app)
                .post('/api/preferences')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(422)
                .send({
                    theme: 'invalid-theme',
                    language: 'invalid-lang',
                });

            expect(res.body).toEqual(
                expect.objectContaining({
                    message: 'The theme must be one of the following light, dark, system. And 1 other error(s).',
                    errors:
                        expect.objectContaining({
                            language: [
                                'The language must be one of the following en, es, fr, de, it, pt, ja, zh, ar.',
                            ],
                            theme: [
                                'The theme must be one of the following light, dark, system.',
                            ],
                        }),
                })
            );

        });
    });

    it('should reset preferences to defaults', async () => {
        // Create custom preferences
        await prisma.userPreferences.upsert({
            where: { userId: testUserId },
            update: {
                userId: testUserId,
                emailNotifications: false,
                theme: 'dark',
                pushNotifications: false,
            },
            create: {
                userId: testUserId,
                emailNotifications: false,
                theme: 'dark',
                pushNotifications: false,
            },
        });

        const res = await request(app)
            .post('/api/preferences/reset')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(202)
            .send();

        expect(res.body).toEqual(
            expect.objectContaining({
                status: 'success',
                data: expect.objectContaining({
                    userId: testUserId,
                    emailNotifications: true,
                    theme: 'light',
                    pushNotifications: true,
                }),
            })
        );
    });
});