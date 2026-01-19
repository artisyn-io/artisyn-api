import { describe, expect, it } from 'vitest';

import app from 'src/index'
import { name as appName } from "package.json"
import request from 'supertest'

describe('Test dynamic routing system', () => {
  it('should load route in web file', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.text).toBe(`Welcome to ${appName}`);
  });

  it('should load base route', async () => {
    const response = await request(app).get('/api');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
  });

  it('should load route in subdirectory', async () => {
    const response = await request(app).post('/api/auth/login');
    expect(response.statusCode).toBe(422);
  });

  it('should load route in generic file', async () => {
    const response = await request(app).get('/api/users');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
  });
});
