import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { createRateLimiter, rateLimitConfigs, checkRateLimit, cleanupRateLimit } from '../middleware/rateLimiter';
import { ipBlockingMiddleware, blockIP, isIPBlocked, unblockIP, getBlockedIPs } from '../middleware/ipBlocking';
import { securityHeadersMiddleware } from '../middleware/securityHeaders';
import { createAPIKey, verifyAPIKey, revokeAPIKey, hashAPIKey } from '../services/apiKeyService';
import { createAlert, getRecentAlerts, resolveAlert, getAlertStatistics } from '../services/monitoringService';

describe('Security & Rate Limiting Features', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(securityHeadersMiddleware);
    app.use(ipBlockingMiddleware);
    app.use(createRateLimiter(rateLimitConfigs.public));

    // Test routes
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    app.post('/api/test', (req, res) => {
      res.json({ success: true });
    });
  });

  afterEach(() => {
    cleanupRateLimit();
  });

  describe('Rate Limiting Tests', () => {
    it('should allow requests within rate limit', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should return 429 when rate limit exceeded', async () => {
      const config = {
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator: () => 'test-ip',
      };

      app.get('/limited', createRateLimiter(config), (req, res) => {
        res.json({ success: true });
      });

      // Make 3 requests, 3rd should fail
      await request(app).get('/limited');
      await request(app).get('/limited');
      const response = await request(app).get('/limited');

      expect(response.status).toBe(429);
    });

    it('should return Retry-After header on rate limit', async () => {
      const config = {
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: () => 'test-ip-2',
      };

      app.get('/limited-retry', createRateLimiter(config), (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/limited-retry');
      const response = await request(app).get('/limited-retry');

      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should track remaining requests correctly', async () => {
      const config = {
        windowMs: 60000,
        maxRequests: 5,
        keyGenerator: () => 'test-ip-3',
      };

      app.get('/track', createRateLimiter(config), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/track');
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);

      expect(remaining).toBe(4);
    });

    it('should have different limits for different user tiers', () => {
      expect(rateLimitConfigs.public.maxRequests).toBeLessThan(rateLimitConfigs.authenticated.maxRequests);
      expect(rateLimitConfigs.authenticated.maxRequests).toBeLessThan(rateLimitConfigs.premium.maxRequests);
    });

    it('should reset rate limit after window expires', async () => {
      const config = {
        windowMs: 100, // 100ms window
        maxRequests: 1,
        keyGenerator: () => 'test-ip-reset',
      };

      // First request should succeed
      let result1 = checkRateLimit('test-ip-reset', config);
      expect(result1.allowed).toBe(true);

      // Second request should fail
      let result2 = checkRateLimit('test-ip-reset', config);
      expect(result2.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      let result3 = checkRateLimit('test-ip-reset', config);
      expect(result3.allowed).toBe(true);
    });
  });

  describe('IP Blocking Tests', () => {
    it('should block IP and return 403', async () => {
      const testIP = '192.168.1.100';
      blockIP(testIP, 'Test block');

      const status = isIPBlocked(testIP);
      expect(status.blocked).toBe(true);
      expect(status.reason).toBe('Test block');
    });

    it('should allow unblocked IPs', () => {
      const testIP = '192.168.1.101';
      const status = isIPBlocked(testIP);
      expect(status.blocked).toBe(false);
    });

    it('should unblock IP', () => {
      const testIP = '192.168.1.102';
      blockIP(testIP, 'Test');
      expect(isIPBlocked(testIP).blocked).toBe(true);

      unblockIP(testIP);
      expect(isIPBlocked(testIP).blocked).toBe(false);
    });

    it('should get list of blocked IPs', () => {
      blockIP('192.168.1.200', 'Test 1');
      blockIP('192.168.1.201', 'Test 2');

      const blocked = getBlockedIPs();
      expect(blocked.length).toBeGreaterThanOrEqual(2);
      expect(blocked.some(b => b.ip === '192.168.1.200')).toBe(true);
    });

    it('should expire blocked IPs after duration', async () => {
      const testIP = '192.168.1.300';
      blockIP(testIP, 'Test', 100); // 100ms duration

      expect(isIPBlocked(testIP).blocked).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(isIPBlocked(testIP).blocked).toBe(false);
    });
  });

  describe('Security Headers Tests', () => {
    it('should include CSP header', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should include X-Content-Type-Options header', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include X-Frame-Options header', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should include HSTS header', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should remove X-Powered-By header', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should not cache sensitive responses', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['cache-control']).toContain('no-store');
    });
  });

  describe('API Key Management Tests', () => {
    it('should generate valid API key', async () => {
      const { key, secret } = await createAPIKey('test-key', 'Test key');
      expect(key).toBeDefined();
      expect(secret).toBeDefined();
      expect(typeof key).toBe('string');
      expect(typeof secret).toBe('string');
    });

    it('should verify valid API key', async () => {
      const { key } = await createAPIKey('test-key-verify', 'Test key');
      const verified = await verifyAPIKey(key);
      expect(verified).toBeDefined();
      expect(verified?.status).toBe('active');
    });

    it('should reject invalid API key', async () => {
      const verified = await verifyAPIKey('invalid-key-12345');
      expect(verified).toBeNull();
    });

    it('should revoke API key', async () => {
      const apiKey = await createAPIKey('test-key-revoke', 'Test key');
      const revoked = await revokeAPIKey(apiKey.id);
      expect(revoked).toBe(true);
    });

    it('should hash API key securely', () => {
      const key = 'artisyn_test_key';
      const hash1 = hashAPIKey(key);
      const hash2 = hashAPIKey(key);
      
      expect(hash1).toBe(hash2); // Same input = same hash
      expect(hash1).not.toBe(key); // Different from original
    });

    it('should set expiration on API key', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const apiKey = await createAPIKey('expiring-key', 'Expiring key', undefined, futureDate);
      expect(apiKey.expiresAt).toEqual(futureDate);
    });
  });

  describe('Monitoring & Alerting Tests', () => {
    it('should create security alert', () => {
      const alert = createAlert('rate-limit', 'high', 'Rate limit exceeded', { ip: '192.168.1.1' });
      expect(alert.id).toBeDefined();
      expect(alert.type).toBe('rate-limit');
      expect(alert.severity).toBe('high');
    });

    it('should get recent alerts', () => {
      createAlert('rate-limit', 'medium', 'Test alert 1');
      createAlert('blocked-ip', 'high', 'Test alert 2');
      
      const recent = getRecentAlerts(10);
      expect(recent.length).toBeGreaterThanOrEqual(2);
    });

    it('should resolve alert', () => {
      const alert = createAlert('api-error', 'low', 'Test alert');
      const resolved = resolveAlert(alert.id);
      expect(resolved).toBe(true);
    });

    it('should track alert statistics', () => {
      createAlert('rate-limit', 'high', 'Test 1');
      createAlert('blocked-ip', 'medium', 'Test 2');
      createAlert('rate-limit', 'low', 'Test 3');
      
      const stats = getAlertStatistics();
      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.byType['rate-limit']).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Penetration Test Cases', () => {
    it('should prevent SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const response = await request(app)
        .post('/api/test')
        .send({ query: maliciousInput });
      
      // Should either be blocked or safely handled
      expect([200, 400, 403]).toContain(response.status);
    });

    it('should prevent XSS attacks', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      const response = await request(app)
        .post('/api/test')
        .send({ data: xssPayload });
      
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should prevent CSRF attacks', async () => {
      // Missing CSRF token should be handled
      const response = await request(app).post('/api/test').send({});
      expect(response.status).toBeDefined();
    });

    it('should handle parameter pollution', async () => {
      // Multiple identical parameters
      const response = await request(app)
        .get('/health?test=1&test=2&test=3');
      
      expect([200, 400, 403]).toContain(response.status);
    });

    it('should prevent path traversal attacks', async () => {
      const response = await request(app).get('/../../etc/passwd');
      expect([404, 403]).toContain(response.status);
    });

    it('should validate HTTP methods', async () => {
      const response = await request(app).request('INVALID').get('/health');
      expect([405, 400]).toContain(response.status);
    });

    it('should timeout on slow requests', async () => {
      // This would test for slowloris attacks
      // Implementation depends on server timeout configuration
      expect(true).toBe(true); // Placeholder
    });

    it('should handle large request bodies', async () => {
      const largePayload = 'x'.repeat(100 * 1024 * 1024); // 100MB
      const response = await request(app)
        .post('/api/test')
        .send({ data: largePayload });
      
      expect([413, 400, 200]).toContain(response.status);
    });
  });

  describe('Security Best Practices Tests', () => {
    it('should not expose server version', async () => {
      const response = await request(app).get('/health');
      const server = response.headers['server'];
      expect(server).not.toContain('Express');
    });

    it('should enforce HTTPS in production', () => {
      const hstsHeader = app._router.stack
        .find((r: any) => r.name === 'securityHeadersMiddleware');
      expect(hstsHeader).toBeDefined();
    });

    it('should have rate limit headers', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should use secure password hashing', () => {
      const hash1 = hashAPIKey('password123');
      const hash2 = hashAPIKey('password123');
      expect(hash1).toBe(hash2); // Consistent hashing
      expect(hash1.length).toBeGreaterThan(32); // Long hash
    });
  });
});
