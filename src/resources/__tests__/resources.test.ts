import Resource, { ApiResource } from 'src/resources/index';
import { beforeAll, describe, expect, it } from 'vitest';

import UserCollection from 'src/resources/UserCollection';
import UserResource from 'src/resources/UserResource';
import app from 'src/index'
import request from 'supertest'

describe('Test dynamic routing system', () => {
  beforeAll(() => {
    app.get('/tester', (req, res) => {
      Resource(req, res, {
        version: '1.0.0',
      }).json()
    });

    app.get('/tester/context', (req, res) => {
      Resource(req, res, {
        version: '1.0.0',
      }).json().additional({
        status: 'success',
      })
    });

    app.get('/tester/resource', (req, res) => {
      ApiResource(new UserResource(req, res, {
        id: 1,
      })).json()
    });

    app.get('/tester/resource/collection', (req, res) => {
      ApiResource(new UserCollection(req, res,
        {
          data: [{
            id: 1,
            email: 'as@e.com',
          }, {
            id: 2,
            email: 'as13@e.com',
          }],
        }
      )).json()
    });

    app.get('/tester/resource/collection/paginated', (req, res) => {
      ApiResource(new UserCollection(req, res,
        {
          data: [{
            id: 2,
            email: 'as13@e.com',
          }],
          pagination: {
            from: 1,
            to: 10
          }
        }
      )).json()
    });
  });

  it('should render resource', async () => {
    const response = await request(app).get('/tester');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('data.version', '1.0.0');
  });

  it('should pass context data to rendered resource', async () => {
    const response = await request(app).get('/tester/context');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
  });

  it('should return user resource', async () => {
    const response = await request(app).get('/tester/resource');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('data.id', 1);
  });

  it('should return user collection unpaginated', async () => {
    const response = await request(app).get('/tester/resource/collection');
    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toBeUndefined();
  });

  it('should return user collection paginated', async () => {
    const response = await request(app).get('/tester/resource/collection/paginated');
    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body).toHaveProperty('meta.pagination.to', 10);
    expect(response.body).toHaveProperty('meta.pagination.from', 1);
  });
});
