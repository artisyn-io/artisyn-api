# User Profile & Preferences API Endpoints

## Overview

This document describes all endpoints for managing user profiles, preferences, privacy settings, account linking, and GDPR-compliant data operations.

---

## Authentication

All endpoints (except public profile endpoints) require authentication via JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## User Profile Endpoints

### 1. Get Current User Profile
**GET** `/api/profile`

Retrieves the authenticated user's profile. Creates a default profile if it doesn't exist.

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "bio": "string",
    "dateOfBirth": "2000-01-15",
    "gender": "MALE|FEMALE|OTHER|PREFER_NOT_TO_SAY",
    "profilePictureUrl": "https://...",
    "coverPhotoUrl": "https://...",
    "website": "https://...",
    "socialLinks": { "twitter": "@user", "linkedin": "..." },
    "occupation": "Software Engineer",
    "companyName": "Tech Corp",
    "location": "San Francisco, CA",
    "timezone": "America/Los_Angeles",
    "language": "en",
    "profileCompletionPercentage": 75,
    "isPublic": true,
    "isProfessional": false,
    "verifiedBadge": false,
    "createdAt": "2024-01-22T10:00:00Z",
    "updatedAt": "2024-01-22T10:00:00Z"
  },
  "status": "success",
  "message": "User profile retrieved",
  "code": 200
}
```

---

### 2. Update User Profile
**POST** `/api/profile`

Updates the authenticated user's profile. All fields are optional.

**Request Body:**
```json
{
  "bio": "Updated bio",
  "dateOfBirth": "2000-01-15",
  "gender": "MALE",
  "profilePictureUrl": "https://...",
  "website": "https://example.com",
  "occupation": "Senior Engineer",
  "companyName": "Tech Corp",
  "location": "San Francisco"
}
```

**Response (200):**
```json
{
  "data": { /* updated profile object */ },
  "status": "success",
  "message": "User profile updated successfully",
  "code": 200
}
```

**Validation Errors (422):**
- `bio`: max 500 characters
- `profilePictureUrl`, `website`: must be valid URLs
- `gender`: must be one of MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
- `timezone`: valid timezone string

---

### 3. Get Profile Completion Status
**GET** `/api/profile/completion`

Returns profile completion percentage and missing fields.

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "profileCompletionPercentage": 60,
    "bio": "My bio",
    "dateOfBirth": null,
    "profilePictureUrl": null,
    "website": "https://example.com",
    "occupation": "Engineer",
    "companyName": null
  },
  "status": "success",
  "message": "Profile completion retrieved",
  "code": 200
}
```

---

### 4. Get Public Profile
**GET** `/api/profile/:userId/public`

Retrieves another user's public profile (if their profile is public).

**Path Parameters:**
- `userId` (required): The target user's ID

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "bio": "string",
    "profilePictureUrl": "https://...",
    "website": "https://...",
    "occupation": "Engineer",
    "companyName": "Tech Corp",
    "location": "San Francisco",
    "verifiedBadge": true,
    "isProfessional": true,
    "isPublic": true,
    "createdAt": "2024-01-22T10:00:00Z"
  },
  "status": "success",
  "code": 200
}
```

**Error Responses:**
- `404`: Profile not found
- `403`: Profile is private

---

### 5. Delete User Profile
**DELETE** `/api/profile`

Deletes the authenticated user's profile data.

**Response (200):**
```json
{
  "data": {},
  "status": "success",
  "message": "User profile deleted successfully",
  "code": 200
}
```

---

## User Preferences Endpoints

### 1. Get User Preferences
**GET** `/api/preferences`

Retrieves the authenticated user's preferences and notification settings.

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "emailNotifications": true,
    "pushNotifications": true,
    "smsNotifications": false,
    "marketingEmails": true,
    "activityEmails": true,
    "digestFrequency": "weekly",
    "theme": "light",
    "language": "en",
    "currencyPreference": "USD",
    "twoFactorEnabled": false,
    "dataCollectionConsent": false,
    "analyticsTracking": true,
    "customPreferences": {},
    "createdAt": "2024-01-22T10:00:00Z",
    "updatedAt": "2024-01-22T10:00:00Z"
  },
  "status": "success",
  "code": 200
}
```

---

### 2. Update User Preferences
**POST** `/api/preferences`

Updates all user preferences.

**Request Body:**
```json
{
  "emailNotifications": true,
  "pushNotifications": false,
  "digestFrequency": "daily",
  "theme": "dark",
  "language": "es",
  "twoFactorEnabled": true,
  "dataCollectionConsent": true
}
```

**Validation Rules:**
- `digestFrequency`: must be one of `daily`, `weekly`, `monthly`, `never`
- `theme`: must be one of `light`, `dark`, `system`
- `language`: must be valid language code
- `currencyPreference`: must be 3-character currency code

**Response (200):**
```json
{
  "data": { /* updated preferences */ },
  "status": "success",
  "message": "User preferences updated successfully",
  "code": 200
}
```

---

### 3. Update Notification Preferences Only
**POST** `/api/preferences/notifications`

Updates only notification-related settings.

**Request Body:**
```json
{
  "emailNotifications": true,
  "pushNotifications": false,
  "smsNotifications": false,
  "marketingEmails": false,
  "activityEmails": true,
  "digestFrequency": "weekly"
}
```

**Response (200):**
```json
{
  "data": { /* updated preferences */ },
  "status": "success",
  "message": "Notification preferences updated",
  "code": 200
}
```

---

### 4. Toggle Two-Factor Authentication
**POST** `/api/preferences/two-factor/toggle`

Enables or disables two-factor authentication for the user.

**Response (200):**
```json
{
  "data": { /* updated preferences */ },
  "status": "success",
  "message": "Two-factor authentication enabled",
  "code": 200
}
```

---

### 5. Reset Preferences to Defaults
**POST** `/api/preferences/reset`

Resets all preferences to default values.

**Response (200):**
```json
{
  "data": { /* preferences with default values */ },
  "status": "success",
  "message": "Preferences reset to defaults",
  "code": 200
}
```

---

## Privacy Settings Endpoints

### 1. Get Privacy Settings
**GET** `/api/privacy`

Retrieves the authenticated user's privacy settings and controls.

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "profileVisibility": "PUBLIC",
    "showEmail": false,
    "showPhone": false,
    "showLocation": false,
    "showOnlineStatus": true,
    "allowDirectMessages": true,
    "allowProfileComments": true,
    "blockList": ["blocked-user-id-1", "blocked-user-id-2"],
    "restrictedList": ["restricted-user-id-1"],
    "searchEngineIndexing": true,
    "dataRetentionMonths": 24,
    "customPrivacyRules": {},
    "lastPrivacyReviewDate": "2024-01-22T10:00:00Z",
    "createdAt": "2024-01-22T10:00:00Z",
    "updatedAt": "2024-01-22T10:00:00Z"
  },
  "status": "success",
  "code": 200
}
```

---

### 2. Update Privacy Settings
**POST** `/api/privacy`

Updates privacy settings and records the last privacy review date.

**Request Body:**
```json
{
  "profileVisibility": "PRIVATE",
  "showEmail": false,
  "showPhone": false,
  "showLocation": true,
  "allowDirectMessages": false,
  "allowProfileComments": true,
  "searchEngineIndexing": false,
  "dataRetentionMonths": 12
}
```

**Validation Rules:**
- `profileVisibility`: must be one of `PUBLIC`, `PRIVATE`, `FRIENDS_ONLY`, `CUSTOM`
- `dataRetentionMonths`: must be between 1 and 240

**Response (200):**
```json
{
  "data": { /* updated privacy settings */ },
  "status": "success",
  "message": "Privacy settings updated successfully",
  "code": 200
}
```

---

### 3. Update Profile Visibility
**POST** `/api/privacy/visibility`

Changes the profile visibility level.

**Request Body:**
```json
{
  "profileVisibility": "FRIENDS_ONLY"
}
```

**Response (200):**
```json
{
  "data": { /* updated privacy settings */ },
  "status": "success",
  "message": "Profile visibility updated",
  "code": 200
}
```

---

### 4. Block a User
**POST** `/api/privacy/block`

Adds a user to the block list.

**Request Body:**
```json
{
  "blockedUserId": "uuid-of-user-to-block"
}
```

**Response (200):**
```json
{
  "data": { /* updated privacy settings with blocklist */ },
  "status": "success",
  "message": "User blocked successfully",
  "code": 200
}
```

**Error Responses:**
- `400`: Blocked user ID required or cannot block yourself
- `404`: User not found

---

### 5. Unblock a User
**POST** `/api/privacy/unblock`

Removes a user from the block list.

**Request Body:**
```json
{
  "blockedUserId": "uuid-of-user-to-unblock"
}
```

**Response (200):**
```json
{
  "data": { /* updated privacy settings */ },
  "status": "success",
  "message": "User unblocked successfully",
  "code": 200
}
```

---

### 6. Get Block List
**GET** `/api/privacy/blocklist`

Retrieves the list of blocked users.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://..."
    }
  ],
  "status": "success",
  "message": "Block list retrieved",
  "code": 200
}
```

---

### 7. Update Data Retention Policy
**POST** `/api/privacy/retention`

Sets how long user data should be retained.

**Request Body:**
```json
{
  "dataRetentionMonths": 12
}
```

**Validation:**
- Must be between 1 and 240 months

**Response (200):**
```json
{
  "data": { /* updated privacy settings */ },
  "status": "success",
  "message": "Data retention policy updated",
  "code": 200
}
```

---

## Account Linking Endpoints

### 1. Get Linked Accounts
**GET** `/api/account-links`

Retrieves all linked social and external accounts.

**Query Parameters:**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 15

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "provider": "GOOGLE",
      "providerUserId": "google-user-id",
      "providerEmail": "user@gmail.com",
      "providerName": "John Doe",
      "isVerified": true,
      "linkedAt": "2024-01-22T10:00:00Z",
      "unlinkedAt": null,
      "accessToken": "***",
      "refreshToken": "***"
    }
  ],
  "meta": {
    "pagination": {
      "perPage": 15,
      "total": 1,
      "from": 1,
      "to": 1
    }
  },
  "status": "success",
  "code": 200
}
```

---

### 2. Link a Social Account
**POST** `/api/account-links`

Links a new social account to the user's profile.

**Request Body:**
```json
{
  "provider": "GOOGLE",
  "providerUserId": "google-user-id-123",
  "accessToken": "access-token-from-oauth",
  "refreshToken": "refresh-token-from-oauth",
  "expiresAt": "2024-01-29T10:00:00Z",
  "providerName": "John Doe",
  "providerEmail": "user@gmail.com"
}
```

**Supported Providers:**
- `GOOGLE`
- `FACEBOOK`
- `GITHUB`
- `APPLE`
- `TWITTER`
- `LINKEDIN`

**Response (201):**
```json
{
  "data": { /* created account link */ },
  "status": "success",
  "message": "Account linked successfully",
  "code": 201
}
```

**Error Responses:**
- `422`: Validation failed
- `409`: Provider already linked (updates existing)

---

### 3. Get Specific Account Link
**GET** `/api/account-links/:provider`

Retrieves details for a specific linked account.

**Path Parameters:**
- `provider`: Provider name (GOOGLE, FACEBOOK, etc.)

**Response (200):**
```json
{
  "data": { /* account link details */ },
  "status": "success",
  "message": "Account link retrieved",
  "code": 200
}
```

**Error Responses:**
- `404`: Account link not found

---

### 4. Unlink a Social Account
**DELETE** `/api/account-links/:provider`

Removes a linked social account.

**Path Parameters:**
- `provider`: Provider name to unlink

**Response (200):**
```json
{
  "data": {},
  "status": "success",
  "message": "Account unlinked successfully",
  "code": 200
}
```

---

### 5. Check Provider Availability
**POST** `/api/account-links/check-availability`

Checks if a provider account can be linked.

**Request Body:**
```json
{
  "provider": "GOOGLE",
  "providerUserId": "google-user-id"
}
```

**Response (200):**
```json
{
  "data": {
    "provider": "GOOGLE",
    "isAvailable": true,
    "alreadyLinkedToYou": false,
    "linkedByAnother": false
  },
  "status": "success",
  "code": 200
}
```

---

### 6. Verify Account Link
**POST** `/api/account-links/verify`

Verifies account link ownership with a verification code.

**Request Body:**
```json
{
  "linkId": "uuid",
  "verificationCode": "123456"
}
```

**Response (200):**
```json
{
  "data": { /* verified account link */ },
  "status": "success",
  "message": "Account link verified",
  "code": 200
}
```

---

## Data Export & GDPR Endpoints

### 1. Request Data Export
**POST** `/api/data-export/request`

Creates a GDPR data export request.

**Request Body:**
```json
{
  "format": "json"
}
```

**Supported Formats:**
- `json` (default)
- `csv`

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "format": "json",
    "status": "pending",
    "downloadUrl": null,
    "expiresAt": null,
    "fileSize": null,
    "errorMessage": null,
    "createdAt": "2024-01-22T10:00:00Z",
    "updatedAt": "2024-01-22T10:00:00Z"
  },
  "status": "success",
  "message": "Data export request submitted. You will receive a download link via email.",
  "code": 201
}
```

**Error Responses:**
- `429`: Already has active export request (24-hour rate limit)
- `400`: Invalid format

---

### 2. Get Export Requests
**GET** `/api/data-export/requests`

Retrieves all data export requests for the user.

**Query Parameters:**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 15

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "format": "json",
      "status": "ready",
      "downloadUrl": "https://s3.example.com/export-123.json",
      "expiresAt": "2024-01-29T10:00:00Z",
      "fileSize": 102400,
      "createdAt": "2024-01-22T10:00:00Z"
    }
  ],
  "meta": { /* pagination */ },
  "status": "success",
  "code": 200
}
```

---

### 3. Get Export Status
**GET** `/api/data-export/:requestId/status`

Checks the status of a specific export request.

**Path Parameters:**
- `requestId`: Export request ID

**Response (200):**
```json
{
  "data": { /* export request object */ },
  "status": "success",
  "message": "Export status retrieved",
  "code": 200
}
```

**Export Status Values:**
- `pending`: Waiting to be processed
- `processing`: Currently generating export file
- `ready`: Ready for download
- `expired`: Download link expired
- `failed`: Export failed

---

### 4. Download Export
**GET** `/api/data-export/:requestId/download`

Downloads the exported data. Redirects to download URL.

**Path Parameters:**
- `requestId`: Export request ID

**Response:**
- `302`: Redirect to download URL
- `404`: Export request not found
- `410`: Download link expired
- `400`: Export not ready

---

### 5. Cancel Export
**POST** `/api/data-export/:requestId/cancel`

Cancels a pending or processing export request.

**Path Parameters:**
- `requestId`: Export request ID

**Response (200):**
```json
{
  "data": { /* cancelled export request */ },
  "status": "success",
  "message": "Export request cancelled",
  "code": 200
}
```

---

### 6. Request Account Deletion
**POST** `/api/account/deletion-request`

Initiates a 30-day account deletion process (right to be forgotten).

**Request Body:**
```json
{
  "password": "user-password"
}
```

**Response (202):**
```json
{
  "data": { "status": "pending_deletion" },
  "status": "success",
  "message": "Account deletion requested. Check your email to confirm. Account will be deleted in 30 days.",
  "code": 202
}
```

**Error Responses:**
- `400`: Password required
- `401`: Unauthorized

---

### 7. Cancel Account Deletion
**POST** `/api/account/cancel-deletion`

Cancels a pending account deletion request.

**Response (200):**
```json
{
  "data": { "status": "deletion_cancelled" },
  "status": "success",
  "message": "Account deletion cancelled",
  "code": 200
}
```

---

## Audit Logging

All sensitive operations are logged for security and GDPR compliance:

- Profile updates
- Privacy setting changes
- Account linking/unlinking
- Data export requests
- Account deletion requests
- Failed authentication attempts

Audit logs include:
- User ID
- Action type
- Entity type and ID
- Old and new values
- IP address (hashed)
- User agent
- Timestamp

Users can request audit logs via `/audit-logs` endpoint (future implementation).

---

## Error Handling

All endpoints return error responses in this format:

```json
{
  "status": "error",
  "message": "Error message",
  "code": 400,
  "errors": {
    "field_name": ["Validation error message"]
  }
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `202`: Accepted (async operation)
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `422`: Validation Failed
- `429`: Too Many Requests
- `500`: Server Error

---

## Rate Limiting

- Data export requests: 1 per 24 hours
- Account linking: 10 per hour
- Privacy updates: 20 per hour

---

## GDPR Compliance

This API fully supports GDPR requirements:

1. **Right to Access**: Users can export all their data via data export endpoints
2. **Right to Erasure**: Users can request account deletion with confirmation
3. **Right to Rectification**: Users can update their profile and preferences
4. **Right to Restrict Processing**: Fine-grained privacy controls
5. **Right to Data Portability**: Export data in JSON/CSV formats
6. **Audit Trail**: All sensitive operations are logged

---

## Security Notes

- All passwords must be hashed before storage
- Tokens are masked in API responses (`***`)
- Sensitive fields are sanitized in collections
- All operations require proper authorization checks
- HTTPS only (enforced in production)
- CORS configured for allowed origins
- Rate limiting prevents abuse
- SQL injection prevention via parameterized queries
- XSS protection via input validation

---

## Future Enhancements

1. Advanced privacy rules (custom visibility rules)
2. Activity timeline and analytics
3. Social linking with automatic data sync
4. Preference syncing across devices
5. Bulk operations support
6. Webhook notifications for sensitive events
7. Advanced audit log querying
8. Profile recommendations based on completion

