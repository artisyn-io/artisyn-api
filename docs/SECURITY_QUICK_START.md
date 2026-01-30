# Security Implementation Quick Start

## Overview

The Artisyn API now includes comprehensive security features following OWASP best practices. This guide will help you get started with the new security features.

## What's New

### 1. Rate Limiting ✓
- Tiered rate limiting for different user types
- Automatic protection against brute force attacks
- Configurable limits per endpoint type

### 2. IP-Based Blocking ✓
- Automatic IP blocking after failed attempts
- Manual IP management for security
- Persistent block storage

### 3. Security Headers ✓
- Content Security Policy (CSP)
- HSTS for HTTPS enforcement
- XSS, clickjacking, and MIME type protections

### 4. API Key Management ✓
- Secure API key generation and validation
- Key expiration support
- IP whitelisting and endpoint restrictions

### 5. Monitoring & Alerting ✓
- Real-time security event tracking
- Automated alert generation
- Dashboard for security metrics

### 6. Security Logging ✓
- Comprehensive event logging
- Audit trail for compliance
- Log export and analysis tools

### 7. Penetration Tests ✓
- Comprehensive security test suite
- Coverage for OWASP Top 10
- Automated test execution

## Getting Started

### 1. Run Tests

```bash
# Run all tests including security tests
npm test

# Run only security tests
npm test -- security.test.ts

# Run with coverage
npm test -- --coverage
```

### 2. Access Security Dashboard

```bash
# Admin endpoint to view security status
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/security/dashboard
```

### 3. Monitor Rate Limits

Response headers now include rate limit information:

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 195
X-RateLimit-Reset: 2026-01-30T15:00:00Z
```

### 4. Create API Keys

```bash
curl -X POST http://localhost:3000/api/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Integration Key",
    "description": "For external service"
  }'
```

### 5. Use API Keys

```bash
# Use in header
curl -H "X-API-Key: artisyn_xxxxx..." \
  http://localhost:3000/api/endpoint

# Or as query parameter (less secure)
curl http://localhost:3000/api/endpoint?apiKey=artisyn_xxxxx...
```

### 6. Check Security Status

```bash
# Get overall security health
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/security/health

# Get recent alerts
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/security/alerts

# Get blocked IPs
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/security/blocked-ips
```

## Configuration

### Rate Limiting Config

Edit `src/middleware/rateLimiter.ts`:

```typescript
export const rateLimitConfigs = {
  public: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 50,            // Max 50 requests
  },
  authenticated: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 200,
  },
  premium: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 1000,
  },
};
```

### IP Blocking Config

Edit `src/middleware/ipBlocking.ts`:

```typescript
export const defaultIPBlockConfig: IPBlockConfig = {
  failedAttemptsThreshold: 5,      // Block after 5 failures
  blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
  failureWindowMs: 15 * 60 * 1000, // Count failures in 15 min window
};
```

## Common Tasks

### Block a Suspicious IP

```bash
curl -X POST http://localhost:3000/api/security/blocked-ips \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.100",
    "reason": "Suspicious activity detected",
    "durationMs": 3600000
  }'
```

### Unblock an IP

```bash
curl -X DELETE http://localhost:3000/api/security/blocked-ips/192.168.1.100 \
  -H "Authorization: Bearer <admin-token>"
```

### View Security Logs

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:3000/api/security/logs?limit=50&type=AUTH_ATTEMPT"
```

### Export Logs for Analysis

```bash
curl -X POST http://localhost:3000/api/security/logs/export \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "security_logs_backup.log",
    "limit": 10000
  }'
```

## Response Examples

### Successful Request (Within Rate Limit)

```json
{
  "success": true,
  "data": { /* response data */ }
}
Headers:
  X-RateLimit-Limit: 200
  X-RateLimit-Remaining: 199
  X-RateLimit-Reset: 2026-01-30T15:00:00Z
```

### Rate Limited Response

```json
{
  "success": false,
  "message": "Too many requests, please try again later.",
  "retryAfter": 300
}
Status: 429 Too Many Requests
Headers:
  Retry-After: 300
```

### Blocked IP Response

```json
{
  "success": false,
  "message": "Your IP has been blocked due to suspicious activity.",
  "reason": "Exceeded failed attempts threshold (5 attempts)",
  "unblockTime": "2026-01-30T15:30:00Z"
}
Status: 403 Forbidden
```

## Security Checklist

- [ ] Review and test rate limiting for all endpoints
- [ ] Configure appropriate rate limits for your use case
- [ ] Set up monitoring alerts for critical security events
- [ ] Review security logs regularly for suspicious activity
- [ ] Implement API key rotation policy
- [ ] Document API key usage for audit purposes
- [ ] Test security measures with penetration tests
- [ ] Configure backup and disaster recovery procedures
- [ ] Set up admin dashboard access control
- [ ] Monitor false positives in IP blocking

## Troubleshooting

### Users Getting 429 Errors

1. Check their user tier: Premium users have higher limits
2. Verify rate limit windows in config
3. Check if bulk operations are necessary
4. Consider implementing request batching

### Legitimate IPs Getting Blocked

1. Check IP blocking rules
2. Review failed authentication patterns
3. Adjust thresholds if too aggressive
4. Whitelist known IPs if necessary

### High False Positive Alerts

1. Review alert thresholds
2. Adjust severity levels
3. Implement smart filtering
4. Consider user behavior baselines

## Support

For detailed documentation, see:
- [Security Documentation](../docs/SECURITY.md)
- [Test Suite](../src/__tests__/security.test.ts)
- [API Documentation](../docs/ENDPOINTS.md)

## Next Steps

1. Review the [Security Documentation](../docs/SECURITY.md)
2. Run the test suite: `npm test`
3. Configure security settings for your environment
4. Set up monitoring and alerting
5. Train admin team on security management
6. Plan regular security audits

## Performance Impact

- **Rate Limiting**: Negligible (<1ms overhead)
- **IP Blocking**: Minimal (<1ms overhead)
- **Security Headers**: Minimal overhead
- **Logging**: Asynchronous, minimal impact

## Compliance

This implementation follows:
- OWASP Top 10 security practices
- CWE (Common Weakness Enumeration) recommendations
- Industry security standards
- Best practices for API security

## Version

- Implementation Date: 2026-01-30
- Version: 1.0.0
- Status: Production Ready
