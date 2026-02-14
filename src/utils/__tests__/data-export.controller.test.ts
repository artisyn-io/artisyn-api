import { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DataExportController from 'src/controllers/DataExportController';
import app from '../..';
import argon2 from 'argon2';
import { env } from '../helpers';
import { prisma } from 'src/db';
import request from 'supertest';

describe('Data Export Controller', () => {
  let testUserId: string;
  let testUser: any;
  let userToken: string;

  beforeEach(async () => {
    // Create a test user before each test
    testUser = await prisma.user.create({
      data: {
        email: `test-user-${Date.now()}@test.com`,
        password: await argon2.hash('password'),
        firstName: 'Test',
        lastName: 'User',
      }
    });
    testUserId = testUser.id

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'password'
      });

    userToken = res.body.token;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.dataExportRequest.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  describe('requestDataExport', () => {
    it('should create a data export request in CSV format', async () => {

      const res = await request(app)
        .post('/api/data-export/request')
        .set({ 'Authorization': `Bearer ${userToken}`, 'Advance-Token': env('JWT_SECRET') })
        .expect(201)
        .send({ format: 'csv' });

      expect(res.body).toMatchObject(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            format: 'csv',
            userId: testUser.id,
          }),
        })
      );
    });

    it('should create a data export request in JSON format', async () => {
      const res = await request(app)
        .post('/api/data-export/request')
        .set({ 'Authorization': `Bearer ${userToken}`, 'Advance-Token': env('JWT_SECRET') })
        .expect(201)//
        .send({ format: 'json' });

      expect(res.body).toMatchObject(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            format: 'json',
            userId: testUser.id,
          }),
        })
      );
    });

    it('should reject invalid format', async () => {
      const res = await request(app)
        .post('/api/data-export/request')
        .set({ 'Authorization': `Bearer ${userToken}`, 'Advance-Token': env('JWT_SECRET') })
        .expect(422)
        .send({ format: 'xml' });

      expect(res.body).toMatchObject(
        expect.objectContaining({
          status: 'error',
        })
      );
    });
  });

  describe('getDataExportStatus', () => {
    it('should return the status of a data export request', async () => {
      const exportRequest = await prisma.dataExportRequest.create({
        data: {
          userId: testUserId,
          format: 'csv',
          status: 'pending',
        },
      });

      const res = await request(app)
        .get(`/api/data-export/${exportRequest.id}/status`)
        .set({ 'Authorization': `Bearer ${userToken}`, 'Advance-Token': env('JWT_SECRET') })
        .expect(200)
        .send();

      expect(res.body).toMatchObject(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            id: exportRequest.id,
            status: 'pending',
          }),
        })
      );
    });

    it('should return 404 for non-existent export request', async () => {
      await request(app)
        .get(`/api/data-export/non-existent-id/status`)
        .set({ 'Authorization': `Bearer ${userToken}`, 'Advance-Token': env('JWT_SECRET') })
        .expect(404)
        .send();
    });
  });

  describe('downloadDataExport', () => {
    it('should download completed export', async () => {
      const exportRequest = await prisma.dataExportRequest.create({
        data: {
          userId: testUserId,
          format: 'csv',
          status: 'ready',
          downloadUrl: 'https://example.com/x.zip'
        },
      });

      const res = await request(app)
        .get(`/api/data-export/${exportRequest.id}/download`)
        .set({ 'Authorization': `Bearer ${userToken}`, 'Advance-Token': env('JWT_SECRET') })
        .expect(302)
        .send();

      expect(res.headers.location).toBe(exportRequest.downloadUrl)
    });

    it('should fail for pending export', async () => {
      const exportRequest = await prisma.dataExportRequest.create({
        data: {
          userId: testUserId,
          format: 'csv',
          status: 'pending',
        },
      });

      const res = await request(app)
        .get(`/api/data-export/${exportRequest.id}/download`)
        .set({ 'Authorization': `Bearer ${userToken}`, 'Advance-Token': env('JWT_SECRET') })
        .expect(400)
        .send();

      expect(res.body).toMatchObject(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('not ready'),
        })
      );
    });
  });
});