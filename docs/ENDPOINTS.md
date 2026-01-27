---
# Artisyn.io Backend API

## Initial API Endpoints

These are the recommended initial endpoints. Additional endpoints can be added as needed.
---

### 📦 Listings API

```
GET    /api/listings           → Get all listings (with pagination)
GET    /api/listings/:id       → Get a specific listing
POST   /api/listings           → Create a listing (curator only)
PUT    /api/listings/:id       → Update a listing (curator only)
DELETE /api/listings/:id       → Delete a listing (curator only)
```

---

### 🎨 Curators API

```
GET    /api/curators           → Get all curators (with pagination)
GET    /api/curators/:id       → Get a specific curator
POST   /api/curators           → Register as a curator
PUT    /api/curators/:id       → Update curator profile (self only)
DELETE /api/curators/:id       → Delete curator account (self only)
```

---

### 🗂 Categories API

```
GET    /api/categories         → Get all categories (with pagination)
GET    /api/categories/:id     → Get a specific category
POST   /api/categories         → Create a category (admin only)
PUT    /api/categories/:id     → Update a category (admin only)
DELETE /api/categories/:id     → Delete a category (admin only)
```

---

### 👤 Users API

```
GET    /api/users/:id          → Get a specific user
POST   /api/users              → Create a new user
PUT    /api/users/:id          → Update user profile (self only)
DELETE /api/users/:id          → Delete user account (self only)
```

---

### 🔐 Authentication API

```
POST   /api/auth/login         → User login
POST   /api/auth/register      → User registration
POST   /api/auth/logout        → User logout
POST   /api/auth/refresh       → Refresh auth token
POST   /api/auth/forgot-password → Request password reset
POST   /api/auth/reset-password  → Reset password with token
```

---

### 🔍 Search API

```
GET    /api/search             → Search listings with filters
GET    /api/search/suggestions → Get search suggestions
```

---

### 📝 Reviews API

#### Basic CRUD
```
GET    /api/reviews            → Get all reviews (with pagination and filters)
GET    /api/reviews/:id        → Get a specific review
POST   /api/reviews            → Create a review (rate limited: 10/15min)
PUT    /api/reviews/:id        → Update review (author only, while pending)
DELETE /api/reviews/:id        → Delete review (author or admin only)
```

**Query Parameters for GET /api/reviews:**

- `page` - Page number for pagination
- `perPage` - Items per page (max 100)
- `authorId` - Filter by review author
- `targetId` - Filter by reviewed curator
- `artisanId` - Filter by artisan
- `rating` - Filter by exact rating (1-5)
- `status` - Filter by status (admin only): PENDING, APPROVED, REJECTED
- `orderBy` - Sort by: id, rating, createdAt (default)
- `orderDir` - Sort direction: asc, desc (default)

#### Moderation (Admin Only)
```
GET    /api/reviews/moderation-queue    → Get pending reviews for moderation
PUT    /api/reviews/:id/moderate        → Approve or reject a review
```

**Body for PUT /api/reviews/:id/moderate:**
```json
{
  "status": "APPROVED | REJECTED"
}
```

#### Curator Responses
```
POST   /api/reviews/:id/respond → Add response to review (target curator only)
PUT    /api/reviews/:id/respond → Update response (target curator only)
DELETE /api/reviews/:id/respond → Delete response (curator or admin)
```

**Body for POST/PUT /api/reviews/:id/respond:**
```json
{
  "content": "Response text (1-500 chars)"
}
```

#### Abuse Reporting
```
POST   /api/reviews/:id/report      → Report a review (rate limited: 5/hour)
GET    /api/reviews/reports         → Get all reports (admin only)
PUT    /api/reviews/reports/:id     → Resolve a report (admin only)
```

**Body for POST /api/reviews/:id/report:**
```json
{
  "reason": "SPAM | INAPPROPRIATE | FAKE | HARASSMENT | OFF_TOPIC | OTHER",
  "details": "Optional details (max 500 chars)"
}
```

**Body for PUT /api/reviews/reports/:id:**
```json
{
  "status": "DISMISSED | ACTION_TAKEN",
  "resolution": "Optional resolution notes"
}
```

#### Rating Aggregation
```
GET    /api/reviews/aggregation/:targetId → Get rating statistics for a curator
```

**Response for GET /api/reviews/aggregation/:targetId:**
```json
{
  "targetId": "uuid",
  "totalReviews": 42,
  "averageRating": 4.25,
  "ratingDistribution": {
    "1": 2,
    "2": 3,
    "3": 5,
    "4": 12,
    "5": 20
  }
}
```

#### Resource-Specific Reviews
```
GET    /api/artisans/:id/reviews  → Get reviews for a specific artisan
GET    /api/curators/:id/reviews  → Get reviews for a specific curator
```

---

### 💸 Tips API

```
GET    /api/tips               → Get all tips (self only, with pagination)
GET    /api/tips/:id           → Get a specific tip (sender/recipient only)
POST   /api/tips               → Send a new tip
PUT    /api/tips/:id           → Update tip status (admin only)
DELETE /api/tips/:id           → Cancel a tip (sender only, if unclaimed)
```

---

### 📊 Analytics API (Admin Only)

```
GET    /api/admin/analytics                → Get analytics events (with filtering & pagination)
GET    /api/admin/analytics/summary        → Get analytics dashboard summary
GET    /api/admin/analytics/aggregations   → Get aggregated reports
GET    /api/admin/analytics/event-types    → Get available event types for filtering
POST   /api/admin/analytics/aggregate      → Trigger aggregation report generation
DELETE /api/admin/analytics/cleanup        → Clean up old analytics data (GDPR)
```

**Query Parameters for GET /api/admin/analytics:**

- `eventType` - Filter by event type (API_CALL, USER_SIGNUP, etc.)
- `startDate` - Filter events after this date (ISO 8601)
- `endDate` - Filter events before this date (ISO 8601)
- `endpoint` - Filter by API endpoint path
- `page` - Page number for pagination
- `limit` - Items per page

**Query Parameters for DELETE /api/admin/analytics/cleanup:**

- `retentionDays` - Keep data for this many days (default: 90)

---
