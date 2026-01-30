# Rate Limits and Security Protocols Documentation

## Table of Contents
1. [Overview](#overview)
2. [Rate Limiting System](#rate-limiting-system)
3. [Security Protocols](#security-protocols)
4. [IP Blocking and Auto-Detection](#ip-blocking-and-auto-detection)
5. [API Key Management](#api-key-management)
6. [Security Headers](#security-headers)
7. [Monitoring and Alerts](#monitoring-and-alerts)
8. [Implementation Guide](#implementation-guide)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Artisyn API implements a comprehensive, multi-layered security framework designed to:
- Protect against brute-force and DDoS attacks
- Prevent common web vulnerabilities (OWASP Top 10)
- Monitor suspicious activity in real-time
- Enforce secure communication protocols
- Manage and audit API access

All security features are implemented as non-breaking additions and can be optionally configured or disabled.

---

## Rate Limiting System

### Purpose
Rate limiting prevents API abuse by controlling the number of requests each client can make within a specified time window.

### Tier-Based Configuration

The Artisyn API uses a tiered rate limiting system based on user authentication status and endpoint type:

#### 1. Public Endpoints (Unauthenticated)
```
Limit:    50 requests
Window:   15 minutes
Response: HTTP 429 Too Many Requests
Headers:  X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

**Affected Endpoints:**
- `GET /api/artisans/search`
- `GET /api/listings/public`
- `GET /api/categories`
- Health checks and public information endpoints

**Example Response (when limited):**
```json
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1643654100
Retry-After: 300

{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 5 minutes.",
  "retryAfter": 300
}
```

#### 2. Authenticated User Endpoints
```
Limit:    200 requests
Window:   15 minutes
Response: HTTP 429 Too Many Requests
Auth:     JWT token required (Authorization: Bearer <token>)
```

**Affected Endpoints:**
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/listings`
- `POST /api/listings`
- User preference and settings endpoints

#### 3. Premium User Endpoints
```
Limit:    1000 requests
Window:   15 minutes
Response: HTTP 429 Too Many Requests
Auth:     JWT token (premium_user role required)
```

**Affected Endpoints:**
- Same as authenticated endpoints, but with higher limit
- Premium analytics endpoints
- Advanced search capabilities

#### 4. Authentication Endpoints (Special Protection)
```
Limit:    5 requests
Window:   15 minutes
Response: HTTP 429 Too Many Requests
Endpoints:
  - POST /auth/login
  - POST /auth/register
  - POST /auth/forgot-password
```

**Purpose:** Prevents brute-force password attacks

**Example Attack Scenario Prevention:**
```
Request 1: POST /auth/login (allowed) ✓
Request 2: POST /auth/login (allowed) ✓
Request 3: POST /auth/login (allowed) ✓
Request 4: POST /auth/login (allowed) ✓
Request 5: POST /auth/login (allowed) ✓
Request 6: POST /auth/login → HTTP 429 (blocked) ✗
         → IP added to block list (auto-block trigger)
```

#### 5. Search Endpoints (Accelerated Rate Limiting)
```
Limit:    30 requests
Window:   1 minute
Response: HTTP 429 Too Many Requests
Endpoints:
  - GET /api/artisans/search
  - GET /api/listings/search
  - GET /api/services/search
```

**Purpose:** Prevents search abuse and resource exhaustion

### Response Headers

All rate-limited responses include these headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Total allowed requests in window | `50` |
| `X-RateLimit-Remaining` | Requests remaining in current window | `12` |
| `X-RateLimit-Reset` | Unix timestamp when limit resets | `1643654100` |
| `Retry-After` | Seconds to wait before retrying | `300` |

### Client Implementation Examples

#### JavaScript/Node.js
```javascript
// Fetch with rate limit handling
async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  // Check rate limit status
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After'));
    console.warn(`Rate limited. Retry after ${retryAfter} seconds`);
    
    // Exponential backoff
    await new Promise(resolve => 
      setTimeout(resolve, retryAfter * 1000)
    );
    
    return makeRequest(url, options); // Retry
  }

  // Log rate limit info
  console.log('Remaining requests:', 
    response.headers.get('X-RateLimit-Remaining')
  );

  return response.json();
}
```

#### Python
```python
import requests
import time

def make_request_with_rate_limit(url, headers=None):
    while True:
        response = requests.get(url, headers=headers)
        
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            print(f"Rate limited. Waiting {retry_after} seconds...")
            time.sleep(retry_after)
            continue
        
        # Log remaining requests
        remaining = response.headers.get('X-RateLimit-Remaining')
        print(f"Requests remaining: {remaining}")
        
        return response.json()
```

#### cURL
```bash
# Basic request
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.artisyn.com/api/profile

# Check rate limit headers
curl -i -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.artisyn.com/api/profile

# Response headers include:
# X-RateLimit-Limit: 200
# X-RateLimit-Remaining: 195
# X-RateLimit-Reset: 1643654100
```

### Configuration

Rate limiting configuration in `src/middleware/rateLimiter.ts`:

```typescript
export const rateLimitConfigs = {
  public: {
    windowMs: 15 * 60 * 1000,      // 15 minutes
    maxRequests: 50,
    keyGenerator: (req) => getClientIP(req)
  },
  
  authenticated: {
    windowMs: 15 * 60 * 1000,       // 15 minutes
    maxRequests: 200,
    keyGenerator: (req) => req.user?.id || getClientIP(req)
  },
  
  premium: {
    windowMs: 15 * 60 * 1000,       // 15 minutes
    maxRequests: 1000,
    keyGenerator: (req) => req.user?.id || getClientIP(req)
  },
  
  auth: {
    windowMs: 15 * 60 * 1000,       // 15 minutes
    maxRequests: 5,
    keyGenerator: (req) => getClientIP(req)
  },
  
  search: {
    windowMs: 1 * 60 * 1000,        // 1 minute
    maxRequests: 30,
    keyGenerator: (req) => getClientIP(req)
  }
};
```

### Best Practices

1. **Respect Rate Limits** - Implement proper retry logic with exponential backoff
2. **Monitor Headers** - Always check `X-RateLimit-Remaining` to anticipate limits
3. **Batch Requests** - Group related API calls to reduce total request count
4. **Cache Results** - Store frequently-accessed data client-side
5. **Use Webhooks** - For real-time updates instead of polling

---

## Security Protocols

### Multi-Layer Security Architecture

```
Request → Security Headers → Rate Limiting → IP Blocking → 
Authentication → Authorization → Business Logic → Logging
```

### Layer 1: Security Headers

#### Content Security Policy (CSP)
Restricts what content can be loaded and where scripts can execute.

```
Content-Security-Policy: default-src 'self'; 
  script-src 'self' 'unsafe-inline'; 
  style-src 'self' 'unsafe-inline'; 
  img-src * data: https:; 
  font-src 'self' data:; 
  connect-src 'self' api.artisyn.com;
```

**Protection:** Prevents XSS attacks, unauthorized script injection

#### HTTP Strict Transport Security (HSTS)
Enforces HTTPS for all communications.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

**Protection:** Prevents man-in-the-middle attacks, SSL stripping

#### X-Frame-Options
Prevents clickjacking attacks.

```
X-Frame-Options: DENY
```

**Protection:** Prevents API from being embedded in malicious frames

#### X-Content-Type-Options
Prevents MIME type sniffing.

```
X-Content-Type-Options: nosniff
```

**Protection:** Stops browsers from guessing content types

#### Referrer-Policy
Controls how much referrer information is shared.

```
Referrer-Policy: strict-origin-when-cross-origin
```

**Protection:** Prevents sensitive information leakage in HTTP headers

### Layer 2: Request Validation

All incoming requests are validated for:

- **HTTP Method Validation**: Only allows GET, POST, PUT, DELETE, PATCH
- **Content Type Validation**: Validates Content-Type headers match payload
- **Parameter Pollution Detection**: Prevents duplicate parameter attacks
- **Header Sanitization**: Removes potentially malicious headers
- **Body Size Limits**: Prevents large payload DoS attacks

```typescript
// Example: Parameter pollution prevention
// If request contains: ?id=1&id=2&id=3
// System uses first occurrence and logs warning
```

### Layer 3: Authentication & Authorization

All protected endpoints require:

```
Authorization: Bearer <JWT_TOKEN>
```

**Token Structure:**
```json
{
  "id": "user_123",
  "email": "user@artisyn.com",
  "role": "user|curator|admin",
  "iat": 1643654100,
  "exp": 1643740500
}
```

**Permissions:**
- `user` - Access own data, public listings
- `curator` - Manage own profile, create listings
- `admin` - Full system access, security management

---

## IP Blocking and Auto-Detection

### Automatic IP Blocking

The system automatically blocks IPs after suspicious activity is detected.

#### Trigger: Failed Authentication Attempts

```
Failed Login Attempts (15-minute window):
├─ 1-4 attempts: Allowed (with logging)
└─ 5+ attempts: IP automatically blocked for 1 hour
```

**Example Timeline:**
```
14:00:00 - Failed login (IP: 192.168.1.100) - Count: 1
14:02:15 - Failed login (IP: 192.168.1.100) - Count: 2
14:04:30 - Failed login (IP: 192.168.1.100) - Count: 3
14:06:45 - Failed login (IP: 192.168.1.100) - Count: 4
14:09:00 - Failed login (IP: 192.168.1.100) - Count: 5
14:09:01 - BLOCKED! (Unblock time: 15:09:01)
14:09:02 - Request from blocked IP → HTTP 403 Forbidden
```

### Response When Blocked

```json
HTTP/1.1 403 Forbidden

{
  "error": "Access Denied",
  "message": "Your IP address has been blocked due to suspicious activity",
  "blockedUntil": "2026-01-30T15:09:01Z",
  "reason": "Multiple failed authentication attempts",
  "contact": "support@artisyn.com"
}
```

### Admin IP Management

#### Manual Block
```bash
POST /api/security/blocked-ips
Content-Type: application/json
Authorization: Bearer <ADMIN_TOKEN>

{
  "ip": "192.168.1.50",
  "reason": "Suspicious scanning activity detected",
  "durationMs": 86400000  // 24 hours (optional)
}
```

#### List Blocked IPs
```bash
GET /api/security/blocked-ips
Authorization: Bearer <ADMIN_TOKEN>

Response:
{
  "success": true,
  "data": [
    {
      "ip": "192.168.1.100",
      "reason": "Multiple failed authentication attempts",
      "blockedAt": "2026-01-30T14:09:01Z",
      "unblockAt": "2026-01-30T15:09:01Z"
    }
  ]
}
```

#### Unblock IP
```bash
DELETE /api/security/blocked-ips/192.168.1.100
Authorization: Bearer <ADMIN_TOKEN>
```

### Whitelist Configuration

IPs can be whitelisted to bypass rate limiting and IP blocking:

```typescript
// In src/middleware/ipBlocking.ts
const WHITELIST_IPS = [
  '127.0.0.1',           // Localhost
  '::1',                 // IPv6 Localhost
  '203.0.113.0/24',      // Partner IPs (CIDR notation)
  '198.51.100.5'         // Trusted service
];
```

---

## API Key Management

### Generating API Keys

API keys are used for server-to-server authentication and integrations.

#### Create API Key

```bash
POST /api/security/api-keys
Content-Type: application/json
Authorization: Bearer <ADMIN_TOKEN>

{
  "name": "Integration Service",
  "description": "Key for backend service integration",
  "expiresIn": "90d",  // Optional: 1d, 7d, 30d, 90d, 1y
  "ipWhitelist": [     // Optional
    "203.0.113.0/24"
  ],
  "allowedEndpoints": [  // Optional: restrict to specific endpoints
    "/api/artisans/*",
    "/api/listings/*"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "key_abc123",
    "key": "artisyn_sk_7f8g9h0i1j2k3l4m",
    "secret": "secret_xyz789",
    "name": "Integration Service",
    "createdAt": "2026-01-30T12:00:00Z",
    "expiresAt": "2026-04-30T12:00:00Z",
    "status": "active"
  }
}
```

**⚠️ IMPORTANT:** Store the `secret` securely. It will not be shown again.

### Using API Keys

#### Basic Authentication
```bash
curl -H "Authorization: ApiKey artisyn_sk_7f8g9h0i1j2k3l4m" \
  https://api.artisyn.com/api/artisans
```

#### With Secret (for sensitive operations)
```bash
curl -H "Authorization: Bearer artisyn_sk_7f8g9h0i1j2k3l4m" \
  -H "X-API-Secret: secret_xyz789" \
  https://api.artisyn.com/api/artisans
```

### API Key Security Features

- **PBKDF2 Hashing**: Keys are hashed with 10,000 iterations, not stored plaintext
- **Expiration Support**: Keys can be set to auto-expire
- **IP Whitelisting**: Restrict key usage to specific IP addresses
- **Endpoint Restrictions**: Limit key to specific API endpoints
- **Revocation**: Keys can be revoked immediately

### Rotating API Keys

Best practice: Rotate keys every 90 days

```bash
# Create new key
POST /api/security/api-keys (as above)

# Use new key in your application
# Monitor old key still works during transition period

# Revoke old key
POST /api/security/api-keys/{OLD_KEY_ID}/revoke
```

---

## Security Headers

### Complete Headers Sent

Every response from the API includes these security headers:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * data: https:; font-src 'self' data:; connect-src 'self' api.artisyn.com
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

### Header Explanation Table

| Header | Purpose | Protection |
|--------|---------|-----------|
| CSP | Control resource loading | XSS attacks |
| HSTS | Enforce HTTPS | SSL stripping |
| X-Content-Type-Options | Prevent MIME guessing | Content type attacks |
| X-Frame-Options | Prevent clickjacking | Clickjacking attacks |
| X-XSS-Protection | Enable browser XSS filters | XSS attacks |
| Referrer-Policy | Control referrer info | Information leakage |
| Permissions-Policy | Disable APIs | Abuse of browser features |
| Cache-Control | Prevent caching | Sensitive data exposure |

---

## Monitoring and Alerts

### Alert System

The system automatically creates alerts for security events:

#### Alert Types

| Type | Trigger | Severity |
|------|---------|----------|
| `rate-limit` | Rate limit exceeded | Medium |
| `blocked-ip` | IP blocked due to attempts | High |
| `failed-auth` | Failed authentication attempt | Low |
| `api-error` | Unexpected API error | Medium |
| `suspicious-activity` | Unusual behavior detected | High |

#### Alert Severities

- **Low**: 1-2 failed logins, minor issues
- **Medium**: 3-4 failed logins, rate limit hits
- **High**: 5+ failed logins, IP blocks, large payloads
- **Critical**: Repeated blocked IPs, multiple high-severity alerts

### Accessing Alerts

#### Get Recent Alerts
```bash
GET /api/security/alerts?limit=50
Authorization: Bearer <ADMIN_TOKEN>

Response:
{
  "success": true,
  "data": [
    {
      "id": "alert_123",
      "type": "blocked-ip",
      "severity": "high",
      "message": "IP 192.168.1.100 blocked after 5 failed auth attempts",
      "metadata": {
        "ip": "192.168.1.100",
        "failedAttempts": 5
      },
      "createdAt": "2026-01-30T14:09:01Z",
      "resolved": false
    }
  ],
  "count": 1
}
```

#### Resolve Alert
```bash
PUT /api/security/alerts/{ALERT_ID}/resolve
Authorization: Bearer <ADMIN_TOKEN>

{
  "notes": "Investigated - false positive from partner IP"
}
```

### Security Dashboard

Access real-time security overview:

```bash
GET /api/security/dashboard
Authorization: Bearer <ADMIN_TOKEN>

Response:
{
  "success": true,
  "data": {
    "monitoring": {
      "totalRequests": 15234,
      "blockedRequests": 12,
      "failedAuth": 3,
      "rateLimitHits": 8,
      "avgResponseTime": 45,
      "criticalAlerts": 1,
      "period": "last-24-hours"
    },
    "blockedIPs": [
      {
        "ip": "192.168.1.100",
        "reason": "Multiple failed authentication attempts",
        "blockedAt": "2026-01-30T14:09:01Z"
      }
    ],
    "logStatistics": {
      "totalEvents": 523,
      "byType": {
        "auth_attempt": 245,
        "rate_limit": 156,
        "ip_blocked": 89,
        "suspicious_activity": 33
      },
      "byIPTopAttackers": [
        { "ip": "192.168.1.100", "count": 45 }
      ]
    },
    "timestamp": "2026-01-30T15:00:00Z"
  }
}
```

---

## Implementation Guide

### Integration Steps

#### 1. Enable Security Middleware

The security middleware is automatically enabled in `src/utils/initialize.ts`:

```typescript
// Already configured - no action needed
import { securityHeadersMiddleware } from '../middleware/securityHeaders';
import { ipBlockingMiddleware } from '../middleware/ipBlocking';
import { createRateLimiter, rateLimitConfigs } from '../middleware/rateLimiter';

app.use(securityHeadersMiddleware);
app.use(ipBlockingMiddleware);
app.use(createRateLimiter(rateLimitConfigs.public));
```

#### 2. Configure Environment Variables

Create `.env` file:

```bash
# API Key Security
API_KEY_SALT="your-secure-random-string-min-32-chars"

# IP Blocking
IP_BLOCK_THRESHOLD=5              # Failed attempts to trigger block
IP_BLOCK_WINDOW_MS=900000          # 15 minutes
IP_BLOCK_DURATION_MS=3600000       # 1 hour

# Security Logging
SECURITY_LOG_RETENTION_DAYS=30
SECURITY_LOG_PATH="./logs"

# Monitoring
ALERT_CRITICAL_WEBHOOK=""          # Optional: webhook for critical alerts
ENABLE_MONITORING=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
```

#### 3. Test Security Features

```bash
# Test rate limiting
for i in {1..60}; do
  curl https://api.artisyn.com/api/artisans/search
  echo "Request $i"
done

# Should get HTTP 429 after 50 requests

# Test IP blocking
for i in {1..10}; do
  curl -X POST https://api.artisyn.com/auth/login \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -H "Content-Type: application/json"
done

# IP should be blocked after 5 attempts

# Check security headers
curl -i https://api.artisyn.com/api/artisans
# Should see Content-Security-Policy, HSTS, etc.
```

#### 4. Monitor Security Events

Set up log monitoring:

```bash
# Real-time log monitoring
tail -f ./logs/security.log | grep "BLOCKED\|RATE_LIMIT\|ALERT"

# Export logs for analysis
curl -X POST https://api.artisyn.com/api/security/logs/export \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"fileName":"security_audit_2026-01.log"}'
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Rate limit exceeded" errors

**Symptoms:** Getting HTTP 429 responses frequently

**Solutions:**
1. Check your request rate - implement exponential backoff
2. Verify you're using JWT token (authenticated tier should have higher limits)
3. Check `X-RateLimit-Remaining` header before rate limit is hit
4. Batch requests to reduce total count

```javascript
// Good: Batch multiple requests
const userIds = [1, 2, 3, 4, 5];
const users = await Promise.all(
  userIds.map(id => fetch(`/api/users/${id}`))
);

// Bad: Many sequential requests
for (let id of userIds) {
  await fetch(`/api/users/${id}`);
}
```

#### Issue 2: IP blocked unexpectedly

**Symptoms:** Getting "Your IP address has been blocked" responses

**Solutions:**
1. Wait for block to expire (default 1 hour)
2. Contact admin to unblock IP
3. Check if you're behind a proxy/VPN using shared IP
4. Request IP whitelist for your organization

```bash
# Check if you're blocked
curl https://api.artisyn.com/api/health

# If blocked, contact support
# Email: security@artisyn.com
# Include: IP address, timestamp, reason
```

#### Issue 3: API key not working

**Symptoms:** Getting "Invalid API key" or "Unauthorized"

**Solutions:**
1. Verify correct API key format (starts with `artisyn_sk_`)
2. Check key has not expired
3. Verify IP whitelist (if configured)
4. Ensure Authorization header format is correct

```bash
# Correct format
Authorization: ApiKey artisyn_sk_7f8g9h0i1j2k3l4m

# Check key status
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://api.artisyn.com/api/security/api-keys/{KEY_ID}
```

#### Issue 4: CSP violations

**Symptoms:** Console errors about Content Security Policy

**Solutions:**
1. Load all resources from allowed origins (see CSP header)
2. Avoid inline scripts (use `script` tags instead)
3. Use correct image and font sources
4. Contact API team if legitimate resource is blocked

```javascript
// Bad: Inline script
<script>alert('XSS')</script>

// Good: External script
<script src="https://api.artisyn.com/scripts/app.js"></script>
```

### Getting Help

- **Security Issues**: security@artisyn.com
- **API Support**: support@artisyn.com
- **Emergency**: +1-XXX-XXX-XXXX (on-call)
- **Documentation**: https://docs.artisyn.com/security

---

## Summary Checklist

Before deploying to production, ensure:

- [ ] All rate limit tiers are configured
- [ ] API_KEY_SALT environment variable is set
- [ ] IP blocking threshold is appropriate (5 attempts)
- [ ] Security headers are being sent (verify with curl -i)
- [ ] Monitoring alerts are configured
- [ ] Admin users have access to security dashboard
- [ ] Logs are being stored and rotated
- [ ] Backup/disaster recovery plan for blocked IPs list
- [ ] Team trained on security protocols
- [ ] Security documentation reviewed by security team

---

**Last Updated:** January 30, 2026  
**Version:** 1.0  
**Status:** Production Ready ✅
