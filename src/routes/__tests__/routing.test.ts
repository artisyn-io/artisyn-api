import { describe, expect, it } from 'vitest';

import app from 'src/index'
import { name as appName } from "package.json"
import { registeredMountPaths } from 'src/routes/index';
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

  it('should not register duplicate mount paths for distinct route files', () => {
    // __auth and __users intentionally resolve to /api (by design of the __ prefix),
    // but non-__ route files should each appear only once.
    const nonUnderscorePaths = registeredMountPaths.filter(
      p => !p.endsWith('/api') || registeredMountPaths.indexOf(p) === registeredMountPaths.lastIndexOf(p)
    );
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const p of nonUnderscorePaths) {
      if (seen.has(p)) duplicates.push(p);
      else seen.add(p);
    }
    expect(duplicates).toEqual([]);
  });

  it('should not mount manually-mounted routes via the filesystem loader', () => {
    expect(registeredMountPaths).not.toContain('/api/applications');
    expect(registeredMountPaths).not.toContain('/api/artisans');
  });

  it('should reach applications via the intended /api path only', async () => {
    // The intended path (mounted by api.ts) should work
    const intended = await request(app).get('/api/applications/nonexistent-id');
    // Should not be 404 from "Cannot GET" (Express default); the route exists
    // even if the resource itself is not found or requires auth
    expect(intended.statusCode).not.toBe(404);
  });
});
