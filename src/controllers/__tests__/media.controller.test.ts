import { beforeAll, describe, expect, it } from 'vitest';
import app from '../../index';
import request from 'supertest';
import path from 'path';
import fs from 'fs';

describe('Media Controller', () => {
    let token: string;
    let mediaId: string;

    beforeAll(async () => {
        // Create a test user and get token
        const email = `test-${Date.now()}@example.com`;
        await request(app).post('/auth/signup').send({
            email,
            lastName: 'Test',
            firstName: 'Media',
            password: 'Password123#',
            password_confirmation: 'Password123#',
        });

        const loginResponse = await request(app).post('/auth/login').send({
            email,
            password: 'Password123#',
        });

        token = loginResponse.body.token;
    });

    it('should upload a file', async () => {
        const testFilePath = path.join(process.cwd(), 'test-image.png');
        // Create a dummy file for testing
        fs.writeFileSync(testFilePath, 'fake-image-content');

        const response = await request(app)
            .post('/api/media/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath)
            .field('tags', ['test', 'upload']);

        expect(response.status).toBe(201);
        expect(response.body.data.originalName).toBe('test-image.png');
        expect(response.body.data.tags).toContain('test');

        mediaId = response.body.data.id;
        fs.unlinkSync(testFilePath);
    });

    it('should list media', async () => {
        const response = await request(app)
            .get('/api/media')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should show media details', async () => {
        const response = await request(app)
            .get(`/api/media/${mediaId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(mediaId);
    });

    it('should update media tags', async () => {
        const response = await request(app)
            .put(`/api/media/${mediaId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                tags: ['updated', 'test'],
            });

        expect(response.status).toBe(200);
        expect(response.body.data.tags).toContain('updated');
    });

    it('should delete media', async () => {
        const response = await request(app)
            .delete(`/api/media/${mediaId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);

        // Verify it's gone from DB
        const checkResponse = await request(app)
            .get(`/api/media/${mediaId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(checkResponse.status).toBe(404);
    });
});
