

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
