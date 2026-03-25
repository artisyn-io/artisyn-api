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

### 👥 User Profile & Preferences API

**User Profile Endpoints:**
```
GET    /api/profile            → Get current user's profile
POST   /api/profile            → Update user's profile
GET    /api/profile/completion → Get profile completion percentage
GET    /api/profile/:userId/public → Get public profile of another user
DELETE /api/profile            → Delete user's profile
```

**User Preferences Endpoints:**
```
GET    /api/preferences                        → Get user's preferences
POST   /api/preferences                        → Update all preferences
POST   /api/preferences/notifications          → Update notification preferences
POST   /api/preferences/two-factor/toggle      → Toggle 2FA
POST   /api/preferences/reset                  → Reset preferences to defaults
```

**Privacy Settings Endpoints:**
```
GET    /api/privacy                            → Get privacy settings
POST   /api/privacy                            → Update privacy settings
POST   /api/privacy/visibility                 → Update profile visibility
POST   /api/privacy/block                      → Block a user
POST   /api/privacy/unblock                    → Unblock a user
GET    /api/privacy/blocklist                  → Get list of blocked users
POST   /api/privacy/retention                  → Update data retention policy
```

**Account Linking Endpoints:**
```
GET    /api/account-links                      → Get all linked accounts
POST   /api/account-links                      → Link a new social account
GET    /api/account-links/:provider            → Get specific linked account
DELETE /api/account-links/:provider            → Unlink a social account
POST   /api/account-links/check-availability   → Check if provider available
POST   /api/account-links/verify               → Verify account link ownership
```

**GDPR Data Export & Account Deletion:**
```
POST   /api/data-export/request                → Request data export (GDPR)
GET    /api/data-export/requests               → Get all export requests
GET    /api/data-export/:requestId/status      → Get export status
GET    /api/data-export/:requestId/download    → Download exported data
POST   /api/data-export/:requestId/cancel      → Cancel export request
POST   /api/account/deletion-request           → Request account deletion (30-day delay)
POST   /api/account/cancel-deletion            → Cancel pending deletion
```

For detailed API documentation, see [USER_PROFILE_PREFERENCES_API.md](./USER_PROFILE_PREFERENCES_API.md)

---

---

### 📋 Applications API

```
GET    /api/listings/:listingId/applications → Get all applications for a listing (owner only)
POST   /api/applications                     → Submit an application for a listing
GET    /api/applications/:id                 → Get application details (owner or applicant)
PUT    /api/applications/:id/status          → Update application status (owner or applicant)
DELETE /api/applications/:id                 → Withdraw application (applicant only, pending only)
```

**Application Statuses:**
- `PENDING` - Application submitted, awaiting review
- `ACCEPTED` - Application accepted (automatically creates a Job)
- `REJECTED` - Application rejected by listing owner
- `WITHDRAWN` - Application withdrawn by applicant

---

### 💼 Jobs API

```
GET    /api/jobs               → List jobs (role-based filtering)
GET    /api/jobs/:id           → Get job details (involved parties only)
PUT    /api/jobs/:id           → Update job status/notes (involved parties only)
DELETE /api/jobs/:id           → Delete job (admin only, cancelled/disputed only)
```

**Job Lifecycle:**
```
active → in_progress → completed (terminal)
       ↘ cancelled (terminal)

in_progress → completed (terminal)
            ↘ cancelled (terminal)
            ↘ disputed

disputed → completed (terminal)
         ↘ cancelled (terminal)
```

**Job Statuses:**
- `active` - Job created and ready to start
- `in_progress` - Work has begun
- `completed` - Job successfully completed (terminal)
- `cancelled` - Job cancelled by either party (terminal)
- `disputed` - Dispute needs resolution

**Query Parameters for GET /api/jobs:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `status` - Filter by status
- `listingId` - Filter by listing (curators/admins only)

**Authorization:**
- **ADMIN**: Can see all jobs
- **CURATOR**: Can see jobs for their listings
- **USER**: Can see jobs where they are the client

**Note:** Jobs are automatically created when an application is accepted.

For detailed documentation, see [JOBS_API.md](./JOBS_API.md)

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

### ✅ Curator Verification API

#### Curator Endpoints

```
POST   /api/curator/verification/submit    → Submit verification application with documents
GET    /api/curator/verification/status    → Get verification status and history
```

**POST /api/curator/verification/submit:**

- Requires `CURATOR` role
- Content-Type: `multipart/form-data`
- Max file size: 250KB per document
- Allowed file types: PDF, JPEG, PNG, WebP
- Max documents: 10

**Body Parameters:**

- `documents` (form-data, required): Array of files
- `documents` (JSON string, required): Document metadata array

**Example `documents` metadata:**
```json
[
  {
    "document_type": "government_id",
    "document_name": "National ID Card"
  },
  {
    "document_type": "professional_certificate",
    "document_name": "Art Certification"
  }
]
```

**Response:**
```json
{
  "status": "success",
  "message": "Verification application submitted successfully",
  "code": 201,
  "data": {
    "id": "uuid",
    "curatorId": "uuid",
    "status": "PENDING",
    "submittedAt": "2026-01-25T12:00:00Z",
    "documents": [
      {
        "id": "uuid",
        "documentType": "government_id",
        "documentName": "National ID Card",
        "media": { ... }
      }
    ]
  }
}
```

**GET /api/curator/verification/status:**

Returns curator's verification applications and history.

**Response:**
```json
{
  "status": "success",
  "data": {
    "applications": [ ... ],
    "history": [ ... ]
  }
}
```

---

#### Admin Endpoints

```
GET    /api/admin/curator-verifications           → List all verification applications
GET    /api/admin/curator-verifications/:id       → Get single application details
PUT    /api/admin/curator-verifications/:id/approve → Approve verification application
PUT    /api/admin/curator-verifications/:id/reject  → Reject verification application
```

**GET /api/admin/curator-verifications:**

**Query Parameters:**

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 15, max: 100)
- `status` - Filter by status: PENDING, VERIFIED, REJECTED
- `submittedAfter` - Filter applications submitted after date (ISO 8601)
- `submittedBefore` - Filter applications submitted before date (ISO 8601)

**Response:**
```json
{
  "status": "success",
  "data": [ ... ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 15,
    "pages": 3
  }
}
```

**PUT /api/admin/curator-verifications/:id/approve:**

**Body:**
```json
{
  "notes": "Optional approval notes"
}
```

**PUT /api/admin/curator-verifications/:id/reject:**

**Body:**
```json
{
  "reason": "Required rejection reason (min 10 chars)"
}
```

---
