# Analytics System Documentation

## Overview

The Artisyn Analytics System provides comprehensive tracking, aggregation, and reporting capabilities for curator listings. It captures user interactions, API usage metrics, and business-relevant events while ensuring GDPR compliance through data anonymization.

---

## Event Types

The analytics subsystem also serves as the **activity logging** system. Event types capture both usage analytics and security-/activity-related events.

| Event Type                  | Description                          | Tracked Data                            |
| --------------------------- | ------------------------------------ | --------------------------------------- |
| `API_CALL`                  | All API endpoint requests            | endpoint, method, status, response time |
| `USER_SIGNUP`               | New user registration                | anonymized user ID                      |
| `USER_LOGIN`                | Successful user authentication       | anonymized user ID                      |
| `ARTISAN_CREATED`           | New artisan listing created          | artisan ID, category ID                 |
| `ARTISAN_UPDATED`           | Artisan listing modified             | artisan ID, category ID                 |
| `ARTISAN_VIEWED`            | Artisan listing viewed               | artisan ID, category ID                 |
| `CONTACT_INFO_ACCESSED`     | Contact details accessed             | artisan ID, accessed fields             |
| `LISTING_ENGAGEMENT`        | User engagement metrics              | artisan ID, engagement type             |
| `REVIEW_CREATED`            | New review submitted                 | review ID, artisan ID                   |
| `TIP_SENT`                  | Payment tip sent                     | tip ID, amount                          |
| `CATEGORY_VIEWED`           | Category browsed                     | category ID                             |
| `SEARCH_PERFORMED`          | Search query executed                | query terms                             |
| `ERROR_OCCURRED`            | Error events                         | error type, stack trace                 |
| `LOGIN_FAILED`              | Failed authentication attempt        | anonymized user ID, IP hash             |
| `PASSWORD_RESET_REQUESTED`  | Password reset flow initiated        | anonymized user ID                      |
| `ADMIN_ACTION`              | Privileged/admin action performed    | action type, target entity              |

---

## Data Anonymization (GDPR Compliance)

All personal data is anonymized before storage:

| Field      | Anonymization Method                       |
| ---------- | ------------------------------------------ |
| User ID    | SHA-256 hash (32 chars)                    |
| IP Address | SHA-256 hash (16 chars)                    |
| User Agent | Simplified (first 3 tokens, max 100 chars) |
| Referrer   | Domain only (no path/query)                |

### Data Retention

- Default retention: **90 days**
- Configurable via `ANALYTICS_RETENTION_DAYS` environment variable
- Automatic cleanup runs daily via scheduler
- Manual cleanup available via `/api/admin/analytics/cleanup`

---

## API Endpoints

All analytics (activity logging) endpoints require authentication and are mounted at `/api/admin/analytics`.

### GET /api/admin/analytics

Retrieve analytics events with filtering and pagination.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `eventType` | string | Filter by event type (e.g., `API_CALL`, `ARTISAN_VIEWED`) |
| `startDate` | ISO 8601 | Filter events after this date |
| `endDate` | ISO 8601 | Filter events before this date |
| `endpoint` | string | Filter by API endpoint path |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 15) |

**Response:**

```json
{
  "data": [...],
  "meta": {
    "pagination": {
      "perPage": 15,
      "total": 100,
      "from": 1,
      "to": 15
    }
  },
  "status": "success",
  "message": "Analytics events retrieved successfully",
  "code": 200
}
```

### GET /api/admin/analytics/summary

Get aggregated analytics dashboard data.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | ISO 8601 | Start of date range |
| `endDate` | ISO 8601 | End of date range |

**Response includes:**

- Event counts by type
- API metrics (avg/max/min response time)
- Unique users count
- Top endpoints
- Error rate percentage
- Total events count

### GET /api/admin/analytics/aggregations

Retrieve stored aggregation reports.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `periodType` | string | Filter by period: `hourly`, `daily`, `weekly`, `monthly` |
| `eventType` | string | Filter by event type |
| `startDate` | ISO 8601 | Start of date range |
| `endDate` | ISO 8601 | End of date range |

### GET /api/admin/analytics/event-types

Get list of available event types for filtering UI.

### POST /api/admin/analytics/aggregate

Manually trigger aggregation report generation.

**Request Body:**

```json
{
  "periodType": "daily"
}
```

**Valid period types:** `hourly`, `daily`, `weekly`, `monthly`

### DELETE /api/admin/analytics/cleanup

Clean up old analytics/activity data (GDPR compliance).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `retentionDays` | integer | 90 | Keep data for this many days |

### GET /api/admin/analytics/export

Export filtered analytics/activity events for offline analysis.

**Query Parameters (subset):**
| Parameter   | Type    | Description                                              |
|------------|---------|----------------------------------------------------------|
| `eventType`| string  | Filter by event type (e.g., `API_CALL`, `LOGIN_FAILED`)  |
| `startDate`| ISO 8601| Filter events after this date                            |
| `endDate`  | ISO 8601| Filter events before this date                           |
| `endpoint` | string  | Filter by API endpoint path                              |
| `userId`   | string  | Filter by logical user ID (mapped to anonymized value)   |
| `limit`    | integer | Max number of events to export (bounded server-side)     |
| `format`   | string  | `json` (default) or `csv`                                |

### GET /api/admin/analytics/anomalies

Retrieve detected security/reliability anomalies over a recent time window.

**Query Parameters:**
| Parameter       | Type    | Default | Description                                           |
|----------------|---------|---------|-------------------------------------------------------|
| `windowMinutes`| integer | 60      | Look-back window for anomaly detection (in minutes)   |

The response contains a list of anomaly descriptors, including type, severity, and context.

---

## Automatic Scheduling

The analytics system includes automatic scheduled tasks:

| Task                | Interval       | Description                 |
| ------------------- | -------------- | --------------------------- |
| Hourly Aggregation  | Every hour     | Compiles hourly metrics     |
| Daily Aggregation   | Every 24 hours | Compiles daily metrics      |
| Weekly Aggregation  | Every 7 days   | Compiles weekly metrics     |
| Monthly Aggregation | Every 30 days  | Compiles monthly metrics    |
| Data Cleanup        | Every 24 hours | Removes expired data (GDPR) |

The scheduler starts automatically when the server boots (except in test environment).

---

## Database Schema

### AnalyticsEvent

Stores individual tracked events.

| Column           | Type      | Description           |
| ---------------- | --------- | --------------------- |
| id               | UUID      | Primary key           |
| eventType        | EventType | Event category        |
| anonymizedUserId | String    | Hashed user ID        |
| endpoint         | String    | API endpoint path     |
| method           | String    | HTTP method           |
| statusCode       | Int       | Response status       |
| responseTime     | Int       | Response time (ms)    |
| userAgent        | String    | Anonymized user agent |
| ipHash           | String    | Hashed IP address     |
| referrer         | String    | Referrer domain       |
| metadata         | JSON      | Additional event data |
| createdAt        | DateTime  | Event timestamp       |

**Indexes:** eventType, createdAt, anonymizedUserId, endpoint

### AnalyticsAggregation

Stores compiled reports.

| Column          | Type      | Description                  |
| --------------- | --------- | ---------------------------- |
| id              | UUID      | Primary key                  |
| periodType      | String    | Report period type           |
| periodStart     | DateTime  | Period start                 |
| periodEnd       | DateTime  | Period end                   |
| eventType       | EventType | Event category               |
| eventCount      | Int       | Count of events              |
| avgResponseTime | Float     | Average response (API calls) |
| uniqueUsers     | Int       | Unique user count            |
| metadata        | JSON      | Additional metrics           |

**Unique Constraint:** (periodType, periodStart, eventType)

---

## Performance Considerations

1. **Efficient Indexing**: All frequently queried columns are indexed
2. **Async Tracking**: Events are tracked asynchronously to avoid blocking API responses
3. **Aggregation**: Pre-computed aggregations reduce query load for dashboards
4. **Pagination**: All list endpoints support pagination to limit response size

### Performance Benchmarks

| Operation          | Target   | Notes               |
| ------------------ | -------- | ------------------- |
| Event tracking     | < 50ms   | Async, non-blocking |
| Event retrieval    | < 100ms  | With indexes        |
| Summary generation | < 200ms  | Aggregated queries  |
| Hourly aggregation | < 500ms  | Batch processing    |
| Daily aggregation  | < 1000ms | Batch processing    |

---

## Integration

### Tracking in Controllers

```typescript
import { trackBusinessEvent } from "src/utils/analyticsMiddleware";
import { EventType } from "@prisma/client";

// Track a business event
trackBusinessEvent(EventType.ARTISAN_VIEWED, req.user?.id, {
  artisanId: artisan.id,
  categoryId: artisan.categoryId,
});
```

### Environment Variables

| Variable                   | Default | Description                        |
| -------------------------- | ------- | ---------------------------------- |
| `ANALYTICS_RETENTION_DAYS` | 90      | Data retention period in days      |
| `NODE_ENV`                 | -       | Set to `test` to disable scheduler |
