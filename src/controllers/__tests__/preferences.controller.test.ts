import { beforeAll, describe, expect, it, afterEach } from 'vitest';
import { prisma } from 'src/db';
import PreferencesController from '../PreferencesController';

describe('PreferencesController', () => {
    let testUserId: string;

    beforeAll(async () => {
        // Create test user
        const user = await prisma.user.create({
            data: {
                email: `test-prefs-${Date.now()}@example.com`,
                password: 'hashed_password',
                firstName: 'Test',
                lastName: 'User',
            },
        });
        testUserId = user.id;
    });

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
                    userId: `test-${freq}-${Date.now()}`,
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
                    userId: `test-theme-${theme}-${Date.now()}`,
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
                userId: `test-custom-${Date.now()}`,
                customPreferences: customPrefs,
            },
        });

        expect(prefs.customPreferences).toEqual(customPrefs);
    });
});
