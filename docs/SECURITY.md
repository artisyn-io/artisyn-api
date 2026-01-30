# Security & Rate Limiting Documentation

## Overview

This document outlines the comprehensive security measures and rate limiting mechanisms implemented in the Artisyn API. These features are designed to protect the platform from abuse, ensure fair resource allocation, and comply with OWASP security best practices.

## Table of Contents

1. [Rate Limiting](#rate-limiting)
2. [IP-Based Blocking](#ip-based-blocking)
3. [Security Headers](#security-headers)
4. [API Key Management](#api-key-management)
5. [Monitoring & Alerting](#monitoring--alerting)
6. [Security Logging](#security-logging)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Rate Limiting

### Overview

Rate limiting restricts the number of API requests a user or IP can make within a specific time window. The Artisyn API implements tiered rate limiting based on user authentication status and account type.

### Tier Configuration

#### Public Users (Unauthenticated)
- **Window**: 15 minutes
- **Limit**: 50 requests
- **Use Case**: Anonymous API access

#### Authenticated Users
- **Window**: 15 minutes
- **Limit**: 200 requests
- **Use Case**: Logged-in users with standard accounts

#### Premium Users
- **Window**: 15 minutes
- **Limit**: 1000 requests
- **Use Case**: Premium subscription holders

#### Auth Endpoints
- **Window**: 15 minutes
- **Limit**: 5 requests
- **Use Case**: Protection against brute force attacks
- **Endpoints**: `/auth/login`, `/auth/register`

#### Search Endpoints
- **Window**: 1 minute
- **Limit**: 30 requests
- **Use Case**: Search operation protection
- **Endpoints**: `/search`, `/artisans`

#### Suspicious/Blocked IPs
- **Window**: 1 hour
- **Limit**: 10 requests
- **Use Case**: Accounts flagged for suspicious behavior

### Response Headers

All rate-limited endpoints return the following headers:

```
X-RateLimit-Limit: 50           # Maximum requests per window
X-RateLimit-Remaining: 45        # Remaining requests in current window
X-RateLimit-Reset: <timestamp>   # ISO timestamp when limit resets
Retry-After: 300                 # Seconds to wait before retrying (on 429)
```

### Status Codes

- **200 OK**: Request successful and within rate limit
- **429 Too Many Requests**: Rate limit exceeded
  - Response includes `Retry-After` header with seconds to wait
  - Response body contains retry information

### Implementation Example

```typescript
// Rate limit is applied automatically via middleware
// No code changes required for protected endpoints

// For custom rate limiting on specific routes:
import { createRateLimiter, rateLimitConfigs } from 'src/middleware/rateLimiter';

const customLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,      // 5 minutes
  maxRequests: 100,              // 100 requests
  keyGenerator: (req) => req.user?.id || req.ip,
});

app.get('/custom-endpoint', customLimiter, (req, res) => {
  // Your endpoint logic
});
```

### Monitoring Rate Limits

```typescript
import { checkRateLimit } from 'src/middleware/rateLimiter';

const result = checkRateLimit('user-123', {
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
});

console.log(result);
// { allowed: true, remaining: 99, retryAfter: 0 }
```

## IP-Based Blocking

### Overview

The IP blocking system automatically detects and blocks IPs exhibiting suspicious or abusive behavior.

### Auto-Blocking Rules

#### Failed Authentication Attempts
- **Threshold**: 5 failed login attempts within 15 minutes
- **Action**: IP automatically blocked for 1 hour
- **Endpoints Monitored**: `/auth/login`, `/auth/register`

### Manual IP Blocking

```typescript
import { blockIP, unblockIP, isIPBlocked, getBlockedIPs } from 'src/middleware/ipBlocking';

// Block an IP
blockIP('192.168.1.100', 'Suspicious activity detected', 60 * 60 * 1000);

// Check if IP is blocked
const status = isIPBlocked('192.168.1.100');
if (status.blocked) {
  console.log(`IP blocked until: ${new Date(status.unblockTime)}`);
}

// Unblock an IP
unblockIP('192.168.1.100');

// Get all blocked IPs
const blocked = getBlockedIPs();
console.log(blocked); // Array of blocked IPs with reasons
```

### Response Handling

When a blocked IP attempts to access the API, they receive:

```json
{
  "success": false,
  "message": "Your IP has been blocked due to suspicious activity.",
  "reason": "Exceeded failed attempts threshold (5 attempts)",
  "unblockTime": "2026-01-30T14:30:00Z"
}
```

### Monitoring Blocked IPs

```typescript
import { getBlockedIPs, recordFailedAttempt } from 'src/middleware/ipBlocking';

// Get current blocked IPs
const blocked = getBlockedIPs();
blocked.forEach(entry => {
  console.log(`${entry.ip}: ${entry.reason}`);
});
```

## Security Headers

### Implemented Headers

#### Content Security Policy (CSP)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
```
- Prevents XSS attacks
- Restricts resource loading sources
- Inline policy adjustable based on requirements

#### X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
- Prevents MIME type sniffing
- Forces browser to respect declared content type

#### X-Frame-Options
```
X-Frame-Options: DENY
```
- Prevents clickjacking attacks
- Disallows framing of API responses

#### X-XSS-Protection
```
X-XSS-Protection: 1; mode=block
```
- Legacy XSS filter enabling
- Blocks page if XSS attack detected

#### Strict-Transport-Security (HSTS)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
- Enforces HTTPS connections
- Prevents downgrade attacks
- Duration: 1 year

#### Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```
- Controls referrer information in requests
- Protects user privacy

#### Permissions-Policy
```
Permissions-Policy: geolocation=(), microphone=(), camera=(), ...
```
- Restricts browser API access
- Prevents unauthorized feature use

### Cache Control Headers

All responses include:
```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

This prevents sensitive data from being cached by browsers or proxies.

## API Key Management

### Overview

API keys provide secure authentication for external integrations and third-party services.

### Generating API Keys

```typescript
import { createAPIKey } from 'src/services/apiKeyService';

// Basic API key
const apiKey = await createAPIKey(
  'my-integration',
  'Integration with external service'
);

console.log(apiKey);
// {
//   id: 'uuid',
//   key: 'artisyn_xxxxx...',  // Secret key (only shown once)
//   name: 'my-integration',
//   status: 'active',
//   createdAt: Date,
//   ...
// }

// API key with expiration
const expiringKey = await createAPIKey(
  'temporary-key',
  'Temporary access',
  undefined,
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
);
```

### Using API Keys

Include in request headers:
```bash
curl https://api.artisyn.com/api/endpoint \
  -H "X-API-Key: artisyn_xxxxx..."
```

Or as query parameter (less secure):
```bash
GET https://api.artisyn.com/api/endpoint?apiKey=artisyn_xxxxx...
```

### Verifying API Keys

```typescript
import { verifyAPIKey } from 'src/services/apiKeyService';

const apiKey = await verifyAPIKey('artisyn_xxxxx...');

if (apiKey) {
  console.log(`Valid key: ${apiKey.name}`);
  console.log(`Rate limit: ${apiKey.rateLimit} req/min`);
} else {
  console.log('Invalid or expired key');
}
```

### Revoking API Keys

```typescript
import { revokeAPIKey } from 'src/services/apiKeyService';

const revoked = await revokeAPIKey('key-id-here');
if (revoked) {
  console.log('API key revoked successfully');
}
```

### Security Best Practices for API Keys

1. **Never commit API keys** to version control
2. **Rotate keys regularly** (recommended: every 3-6 months)
3. **Use IP whitelist** to restrict key usage by IP
4. **Scope keys** to specific endpoints only
5. **Monitor key usage** for suspicious activity
6. **Revoke immediately** if compromised
7. **Use environment variables** to store keys

## Monitoring & Alerting

### Overview

The monitoring system tracks API metrics and automatically generates alerts for security events.

### Alert Types

#### Rate Limit Alerts
- Triggered when user exceeds rate limit
- Severity: Medium
- Threshold: 3+ occurrences within 1 hour

#### Blocked IP Alerts
- Triggered when IP is blocked
- Severity: High
- Automatic action taken on block

#### Failed Auth Alerts
- Triggered on authentication failures
- Severity: Medium
- Threshold: 5+ failures within 15 minutes

#### Suspicious Activity Alerts
- Triggered on unusual patterns
- Severity: High
- Examples: SQL injection attempts, XSS payloads

#### API Error Alerts
- Triggered on high error rates
- Severity: High
- Threshold: >5% error rate

### Creating Alerts

```typescript
import { createAlert } from 'src/services/monitoringService';

const alert = createAlert(
  'rate-limit',          // Alert type
  'high',                // Severity: low, medium, high, critical
  'Rate limit exceeded', // Message
  {                      // Additional data
    ip: '192.168.1.1',
    userId: 'user-123',
    limit: 100,
  }
);
```

### Retrieving Alerts

```typescript
import { getRecentAlerts, getAlertsBySeverity } from 'src/services/monitoringService';

// Get recent alerts
const recent = getRecentAlerts(10);
console.log(recent);

// Get critical alerts
const critical = getAlertsBySeverity('critical');
console.log(critical);
```

### Resolving Alerts

```typescript
import { resolveAlert } from 'src/services/monitoringService';

const resolved = resolveAlert('alert-id-here');
```

### Monitoring Dashboard

```typescript
import { getMonitoringDashboard } from 'src/services/monitoringService';

const dashboard = getMonitoringDashboard();
console.log(dashboard);
// {
//   metrics: { /* API metrics */ },
//   alerts: { /* Alert statistics */ },
//   recentAlerts: [ /* Last 10 alerts */ ],
//   highSeverityAlerts: [ /* Critical + High severity */ ],
// }
```

## Security Logging

### Overview

Comprehensive logging system for security events, authentication, and data access for compliance and auditing.

### Log Types

#### Security Events
```typescript
import { logSecurityEvent } from 'src/utils/securityLogging';

logSecurityEvent(
  'AUTH_ATTEMPT',
  'info',
  'User logged in successfully',
  req,
  { userId: 'user-123', email: 'user@example.com' }
);
```

#### Audit Logs
```typescript
import { logAuditEvent } from 'src/utils/securityLogging';

logAuditEvent(
  'UPDATE_PROFILE',
  'user-123',
  'UserProfile',
  'profile-123',
  { name: 'Old Name' -> 'New Name' },
  'success',
  req
);
```

#### Rate Limit Violations
```typescript
import { logRateLimitHit } from 'src/utils/securityLogging';

logRateLimitHit(req, 100, '15 minutes');
```

#### IP Blocks
```typescript
import { logIPBlock } from 'src/utils/securityLogging';

logIPBlock('192.168.1.1', 'Exceeded failed attempts', req);
```

### Querying Logs

```typescript
import {
  getRecentLogs,
  getLogsByEventType,
  getLogsBySeverity,
  getLogsByIP,
  getLogsByUser,
  getLogsForTimeRange,
} from 'src/utils/securityLogging';

// Get recent logs
const recent = getRecentLogs(100);

// Get logs by event type
const authLogs = getLogsByEventType('AUTH_ATTEMPT');

// Get logs by severity
const errors = getLogsBySeverity('error');

// Get logs by IP
const ipLogs = getLogsByIP('192.168.1.1');

// Get logs by user
const userLogs = getLogsByUser('user-123');

// Get logs for time range
const rangeLogs = getLogsForTimeRange(
  new Date('2026-01-01'),
  new Date('2026-01-31')
);
```

### Log Export

```typescript
import { exportLogsToFile } from 'src/utils/securityLogging';

// Export recent logs to file
const logs = getRecentLogs(1000);
exportLogsToFile('logs_export_2026_01_30.log', logs);
```

### Log Files

Logs are persisted to disk in the following locations:

```
logs/
  ├── security.log    # All security events
  └── audit.log       # Compliance and audit trail
```

Each log entry includes:
- Timestamp (ISO format)
- Event type
- Severity level
- User ID
- Client IP
- User agent
- Endpoint
- HTTP method
- Status code
- Message
- Additional details

## Best Practices

### 1. Defense in Depth

- Use rate limiting + IP blocking + API key validation
- Implement multiple layers of security
- Redundant authentication mechanisms

### 2. Regular Monitoring

```typescript
import { getMonitoringDashboard } from 'src/services/monitoringService';

// Check dashboard regularly
setInterval(() => {
  const dashboard = getMonitoringDashboard();
  if (dashboard.highSeverityAlerts.length > 0) {
    // Send notification to security team
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

### 3. Key Rotation

- Rotate API keys every 3-6 months
- Revoke old keys after rotation period
- Maintain key rotation log

### 4. IP Whitelist Management

```typescript
// For premium integrations, use IP whitelist
const apiKey = await createAPIKey('secure-integration', 'Restricted access');
// Set ipWhitelist: ['203.0.113.1', '203.0.113.2']
// Set allowedEndpoints: ['/api/orders', '/api/shipments']
```

### 5. Incident Response

1. **Detect**: Monitor alerts and logs
2. **Investigate**: Review security logs and metrics
3. **Contain**: Block IP, revoke keys, increase rate limits
4. **Remediate**: Patch vulnerabilities, update rules
5. **Review**: Analyze incident, improve rules

### 6. OWASP Compliance

The implementation follows OWASP security principles:
- **A01: Broken Authentication**: Strong API key validation
- **A02: Broken Access Control**: IP blocking, rate limiting
- **A03: Injection**: Input validation, parameter checking
- **A04: Insecure Design**: Security by default
- **A05: Security Misconfiguration**: Secure headers
- **A09: Logging & Monitoring**: Comprehensive logging

## Troubleshooting

### Rate Limit Issues

**Problem**: Users report "429 Too Many Requests"

**Solution**:
1. Check user tier: `SELECT * FROM users WHERE id = 'user-id'`
2. Review recent requests: `getLogsByUser('user-id')`
3. Adjust limits or whitelist if legitimate: `updateRateLimitConfig()`

### IP Blocking Issues

**Problem**: Legitimate IP addresses blocked

**Solution**:
1. Check blocked IPs: `getBlockedIPs()`
2. Verify block reason: Check `ipBlocking` logs
3. Unblock if necessary: `unblockIP('192.168.1.1')`

### API Key Issues

**Problem**: "Invalid or expired API key"

**Solution**:
1. Verify key still active: `verifyAPIKey(key)`
2. Check expiration date: `getAPIKeyInfo(keyId)`
3. Regenerate key if expired: `createAPIKey(name, description)`

### Monitoring Alerts

**Problem**: No alerts being generated

**Solution**:
1. Check alert thresholds in `monitoringService.ts`
2. Verify monitoring scheduler running: `startMonitoringScheduler()`
3. Review alert statistics: `getAlertStatistics()`

## Support

For security concerns or vulnerabilities, please contact the security team:
- Email: security@artisyn.com
- Report: [Security Reporting Process](../SECURITY.md)

## Version History

- **v1.0.0** (2026-01-30): Initial implementation
  - Rate limiting middleware
  - IP blocking system
  - Security headers
  - API key management
  - Monitoring and alerting
  - Security logging
  - Comprehensive tests
