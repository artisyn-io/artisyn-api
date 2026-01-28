# User Profile & Preferences API - Quick Start Guide

## 🚀 Getting Started

This guide helps you quickly understand and use the new User Profile & Preferences API endpoints.

---

## 📌 Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Artisyn API running on `http://localhost:3000`
- Valid JWT authentication token

---

## 🔐 Authentication

All requests (except public profiles) require a JWT token:

```bash
Authorization: Bearer your_jwt_token_here
```

Example:
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." https://api.artisyn.io/api/profile
```

---

## 📖 Quick API Reference

### 1. Profile Management

#### Get Your Profile
```bash
curl -X GET https://api.artisyn.io/api/profile \
  -H "Authorization: Bearer <token>"
```

#### Update Profile
```bash
curl -X POST https://api.artisyn.io/api/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "I love art and design",
    "occupation": "Graphic Designer",
    "companyName": "Design Studio",
    "website": "https://myportfolio.com"
  }'
```

#### Check Profile Completion
```bash
curl -X GET https://api.artisyn.io/api/profile/completion \
  -H "Authorization: Bearer <token>"
```

#### View Public Profile
```bash
# Replace <userId> with the target user's ID
curl -X GET https://api.artisyn.io/api/profile/<userId>/public
```

---

### 2. Preferences Management

#### Get Your Preferences
```bash
curl -X GET https://api.artisyn.io/api/preferences \
  -H "Authorization: Bearer <token>"
```

#### Update Preferences
```bash
curl -X POST https://api.artisyn.io/api/preferences \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "emailNotifications": true,
    "pushNotifications": false,
    "digestFrequency": "weekly",
    "theme": "dark",
    "twoFactorEnabled": true
  }'
```

#### Update Notifications Only
```bash
curl -X POST https://api.artisyn.io/api/preferences/notifications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "emailNotifications": false,
    "marketingEmails": false,
    "digestFrequency": "monthly"
  }'
```

#### Enable Two-Factor Authentication
```bash
curl -X POST https://api.artisyn.io/api/preferences/two-factor/toggle \
  -H "Authorization: Bearer <token>"
```

---

### 3. Privacy Settings

#### Get Privacy Settings
```bash
curl -X GET https://api.artisyn.io/api/privacy \
  -H "Authorization: Bearer <token>"
```

#### Update Privacy Settings
```bash
curl -X POST https://api.artisyn.io/api/privacy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "profileVisibility": "PRIVATE",
    "showEmail": false,
    "showPhone": false,
    "showLocation": true,
    "allowDirectMessages": false,
    "searchEngineIndexing": false,
    "dataRetentionMonths": 12
  }'
```

#### Change Profile Visibility
```bash
curl -X POST https://api.artisyn.io/api/privacy/visibility \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "profileVisibility": "FRIENDS_ONLY"
  }'
```

#### Block a User
```bash
# Replace <userId> with the ID of user to block
curl -X POST https://api.artisyn.io/api/privacy/block \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "blockedUserId": "<userId>"
  }'
```

#### Unblock a User
```bash
curl -X POST https://api.artisyn.io/api/privacy/unblock \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "blockedUserId": "<userId>"
  }'
```

#### Get Your Block List
```bash
curl -X GET https://api.artisyn.io/api/privacy/blocklist \
  -H "Authorization: Bearer <token>"
```

---

### 4. Account Linking

#### Get All Linked Accounts
```bash
curl -X GET https://api.artisyn.io/api/account-links \
  -H "Authorization: Bearer <token>"
```

#### Link a Social Account
```bash
curl -X POST https://api.artisyn.io/api/account-links \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "GOOGLE",
    "providerUserId": "google-user-id-123",
    "accessToken": "google-access-token",
    "refreshToken": "google-refresh-token",
    "expiresAt": "2024-01-29T10:00:00Z",
    "providerName": "John Doe",
    "providerEmail": "john@gmail.com"
  }'
```

**Supported Providers:**
- GOOGLE
- FACEBOOK
- GITHUB
- APPLE
- TWITTER
- LINKEDIN

#### Check if Provider is Available
```bash
curl -X POST https://api.artisyn.io/api/account-links/check-availability \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "GOOGLE",
    "providerUserId": "google-user-123"
  }'
```

#### Unlink a Social Account
```bash
curl -X DELETE https://api.artisyn.io/api/account-links/GOOGLE \
  -H "Authorization: Bearer <token>"
```

---

### 5. Data Export (GDPR)

#### Request Data Export
```bash
curl -X POST https://api.artisyn.io/api/data-export/request \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json"
  }'
```

**Supported Formats:**
- `json` - Structured JSON format
- `csv` - Comma-separated values

#### Check Export Status
```bash
# Get all your export requests
curl -X GET https://api.artisyn.io/api/data-export/requests \
  -H "Authorization: Bearer <token>"

# Check specific export
curl -X GET https://api.artisyn.io/api/data-export/<requestId>/status \
  -H "Authorization: Bearer <token>"
```

#### Download Your Data
```bash
curl -X GET https://api.artisyn.io/api/data-export/<requestId>/download \
  -H "Authorization: Bearer <token>"
```

#### Cancel Export
```bash
curl -X POST https://api.artisyn.io/api/data-export/<requestId>/cancel \
  -H "Authorization: Bearer <token>"
```

#### Request Account Deletion
```bash
curl -X POST https://api.artisyn.io/api/account/deletion-request \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "your-password"
  }'
```

**Note:** Account will be deleted after 30 days. You can cancel during this period.

#### Cancel Account Deletion
```bash
curl -X POST https://api.artisyn.io/api/account/cancel-deletion \
  -H "Authorization: Bearer <token>"
```

---

## 📊 Response Examples

### Success Response (200)
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "bio": "I love art",
    "occupation": "Designer",
    "profileCompletionPercentage": 75,
    "isPublic": true,
    "createdAt": "2024-01-22T10:00:00Z",
    "updatedAt": "2024-01-22T10:00:00Z"
  },
  "status": "success",
  "message": "User profile retrieved",
  "code": 200
}
```

### Error Response (422)
```json
{
  "status": "error",
  "message": "Validation failed",
  "code": 422,
  "errors": {
    "bio": ["Must be less than 500 characters"],
    "website": ["Invalid URL format"]
  }
}
```

### Collection Response (200)
```json
{
  "data": [
    { /* item 1 */ },
    { /* item 2 */ }
  ],
  "meta": {
    "pagination": {
      "perPage": 15,
      "total": 42,
      "from": 1,
      "to": 15
    }
  },
  "status": "success",
  "message": "Linked accounts retrieved",
  "code": 200
}
```

---

## 🎯 Common Use Cases

### Complete Your Profile
```bash
# 1. Get current profile
curl -X GET https://api.artisyn.io/api/profile \
  -H "Authorization: Bearer <token>"

# 2. Add missing information
curl -X POST https://api.artisyn.io/api/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Professional photographer",
    "profilePictureUrl": "https://...",
    "website": "https://portfolio.com",
    "occupation": "Photographer",
    "companyName": "My Studio",
    "location": "San Francisco, CA"
  }'

# 3. Check completion
curl -X GET https://api.artisyn.io/api/profile/completion \
  -H "Authorization: Bearer <token>"
```

### Enhance Privacy
```bash
# 1. Make profile private
curl -X POST https://api.artisyn.io/api/privacy/visibility \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"profileVisibility": "PRIVATE"}'

# 2. Hide contact info
curl -X POST https://api.artisyn.io/api/privacy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "showEmail": false,
    "showPhone": false,
    "showLocation": false
  }'

# 3. Block specific users
curl -X POST https://api.artisyn.io/api/privacy/block \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"blockedUserId": "user-to-block"}'
```

### Disable All Notifications
```bash
curl -X POST https://api.artisyn.io/api/preferences/notifications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "emailNotifications": false,
    "pushNotifications": false,
    "smsNotifications": false,
    "marketingEmails": false,
    "activityEmails": false,
    "digestFrequency": "never"
  }'
```

### Export Your Data (GDPR)
```bash
# 1. Request export
export_response=$(curl -X POST https://api.artisyn.io/api/data-export/request \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"format": "json"}')

# 2. Extract request ID
request_id=$(echo $export_response | jq -r '.data.id')

# 3. Check status
curl -X GET https://api.artisyn.io/api/data-export/$request_id/status \
  -H "Authorization: Bearer <token>"

# 4. Download when ready
curl -X GET https://api.artisyn.io/api/data-export/$request_id/download \
  -H "Authorization: Bearer <token>" \
  -o my-data.json
```

---

## ⚠️ Error Handling

### Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check your request body format |
| 401 | Unauthorized | Verify your JWT token is valid |
| 403 | Forbidden | You don't have permission for this action |
| 404 | Not Found | Resource doesn't exist |
| 422 | Validation Failed | Check field values against rules |
| 429 | Too Many Requests | Wait before retrying (rate limit) |
| 500 | Server Error | Contact support |

### Example Error Response
```bash
curl -X POST https://api.artisyn.io/api/privacy/block \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"blockedUserId": "invalid"}'

# Response:
# {
#   "status": "error",
#   "message": "User not found",
#   "code": 404
# }
```

---

## 📋 API Limits

- **Data Export**: 1 request per 24 hours
- **Account Linking**: 10 attempts per hour
- **Privacy Updates**: 20 updates per hour
- **General Rate Limit**: 100 requests per minute per IP

---

## 🔐 Security Tips

1. **Never share your JWT token**
   ```bash
   # ❌ DON'T
   export TOKEN="your-token-here"
   
   # ✅ DO
   read -s TOKEN  # Prompts for input without echoing
   ```

2. **Keep sensitive tokens secure**
   ```bash
   # When storing OAuth tokens, use environment variables
   export GOOGLE_TOKEN="secure-token"
   ```

3. **Use HTTPS in production**
   ```bash
   # ❌ DON'T
   curl http://api.artisyn.io/api/profile
   
   # ✅ DO
   curl https://api.artisyn.io/api/profile
   ```

4. **Rotate your tokens regularly**
   - Request new tokens periodically
   - Store in secure environment

---

## 📚 Complete Documentation

For detailed information, see:
- **Full API Reference**: `docs/USER_PROFILE_PREFERENCES_API.md`
- **Implementation Guide**: `docs/PROFILE_PREFERENCES_IMPLEMENTATION.md`
- **Endpoint Summary**: `docs/ENDPOINTS.md`

---

## 💡 Tips & Tricks

### Using jq for JSON Parsing
```bash
# Extract specific field from response
curl -X GET https://api.artisyn.io/api/profile \
  -H "Authorization: Bearer <token>" | jq '.data.profileCompletionPercentage'

# Extract all profile IDs
curl -X GET https://api.artisyn.io/api/privacy/blocklist \
  -H "Authorization: Bearer <token>" | jq '.data[].id'
```

### Pagination
```bash
# Get page 2 with 10 items per page
curl -X GET "https://api.artisyn.io/api/account-links?page=2&limit=10" \
  -H "Authorization: Bearer <token>"
```

### Filter Responses
```bash
# Get only essential profile fields
curl -X GET https://api.artisyn.io/api/profile \
  -H "Authorization: Bearer <token>" | \
  jq '.data | {bio, occupation, profileCompletionPercentage}'
```

---

## 🆘 Troubleshooting

### "Unauthorized" Error
```
Cause: Invalid or expired JWT token
Solution: Generate a new authentication token
```

### "Validation failed" Error
```
Cause: Invalid field value
Solution: Check the error details in the response
Example: bio must be less than 500 characters
```

### "Too Many Requests" Error
```
Cause: Rate limit exceeded
Solution: Wait before retrying
Limits: Data export (1/24h), Account links (10/h), Privacy (20/h)
```

### "Profile not found" Error
```
Cause: Profile doesn't exist yet
Solution: POST /api/profile to create one
```

---

## 🆘 Need Help?

1. Check `docs/USER_PROFILE_PREFERENCES_API.md` for detailed endpoint docs
2. Review test files in `src/controllers/__tests__/` for examples
3. Check implementation guide for architecture details
4. Contact support with error details

---

## ✅ Next Steps

1. Get your JWT authentication token
2. Start with `GET /api/profile` to test connectivity
3. Update your profile with `POST /api/profile`
4. Configure preferences and privacy settings
5. Link social accounts if needed
6. Request data export for GDPR compliance

---

**Happy coding! 🚀**

