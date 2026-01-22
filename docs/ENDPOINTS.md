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

### 🔍 Search API

```
GET    /api/search             → Search listings with filters
GET    /api/search/suggestions → Get search suggestions
```

---

### 📝 Reviews API

```
GET    /api/reviews            → Get all reviews (with pagination)
GET    /api/reviews/:id        → Get a specific review
POST   /api/reviews            → Create a review
PUT    /api/reviews/:id        → Update review (author only)
DELETE /api/reviews/:id        → Delete review (author or admin only)
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
