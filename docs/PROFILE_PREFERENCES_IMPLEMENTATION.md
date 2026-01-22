# User Profile & Preferences Feature Implementation

This document describes the implementation of the User Profile & Preferences API feature for Artisyn.io.

## Overview

This feature provides comprehensive profile management, user preferences, privacy controls, account linking, and GDPR-compliant data export functionality. All operations are secured with proper authorization checks and comprehensive audit logging.

## Implementation Summary

### Database Models (Prisma)

1. **UserProfile** - Stores extended user profile information
   - Bio, profile pictures, website links, social links
   - Professional details (occupation, company)
   - Timezone and language preferences
   - Profile completion tracking
   - Public/private status and verification badge

2. **UserPreferences** - Manages user settings
   - Notification preferences (email, push, SMS)
   - Display preferences (theme, language, currency)
   - Two-factor authentication toggle
   - Data collection and analytics consent

3. **PrivacySettings** - Fine-grained privacy controls
   - Profile visibility levels (PUBLIC, PRIVATE, FRIENDS_ONLY, CUSTOM)
   - Field-level visibility controls (email, phone, location)
   - Block list and restricted list management
   - Search engine indexing control
   - Data retention policies
   - Custom privacy rules

4. **AccountLink** - Social account linking
   - Supports: Google, Facebook, GitHub, Apple, Twitter, LinkedIn
   - Stores OAuth tokens (encrypted)
   - Provider metadata and verification status
   - Link/unlink tracking

5. **AuditLog** - GDPR compliance and security auditing
   - Tracks all sensitive operations
   - Records IP address and user agent
   - Stores old and new values for changes
   - Supports various audit action types

6. **DataExportRequest** - GDPR right to data portability
   - Export request tracking
   - Multiple format support (JSON, CSV)
   - Download URL generation
   - Expiration and retry handling

### Controllers

#### ProfileController
**File:** `src/controllers/ProfileController.ts`

Methods:
- `getProfile()` - Retrieve current user's profile
- `updateProfile()` - Update profile with validation
- `getProfileCompletion()` - Get completion percentage
- `getPublicProfile()` - Get another user's public profile
- `deleteProfile()` - Delete profile data

Features:
- Automatic profile creation on first access
- Profile completion percentage calculation
- Public/private profile visibility
- Audit logging for all operations

#### PreferencesController
**File:** `src/controllers/PreferencesController.ts`

Methods:
- `getPreferences()` - Get all preferences
- `updatePreferences()` - Update all or selected preferences
- `updateNotifications()` - Update notification settings only
- `toggleTwoFactor()` - Enable/disable 2FA
- `resetPreferences()` - Reset to default values

Features:
- Default preference initialization
- Granular update control
- 2FA toggle with audit logging
- Preference validation

#### PrivacySettingsController
**File:** `src/controllers/PrivacySettingsController.ts`

Methods:
- `getPrivacySettings()` - Get privacy configuration
- `updatePrivacySettings()` - Update all privacy settings
- `updateProfileVisibility()` - Change visibility level
- `blockUser()` - Add user to block list
- `unblockUser()` - Remove user from block list
- `getBlockList()` - Get list of blocked users
- `updateDataRetention()` - Set data retention policy

Features:
- Multiple privacy levels
- User blocking/unblocking
- Block list management with user details
- Data retention policy enforcement
- Last privacy review date tracking

#### AccountLinkingController
**File:** `src/controllers/AccountLinkingController.ts`

Methods:
- `getLinkedAccounts()` - List all linked social accounts
- `linkAccount()` - Link new social account
- `unlinkAccount()` - Remove linked account
- `getAccountLink()` - Get specific linked account
- `checkProviderAvailability()` - Check if provider can be linked
- `verifyAccountLink()` - Verify account ownership

Features:
- Support for 6 major social platforms
- OAuth token management
- Provider availability checking
- Link verification with codes
- Automatic token refresh handling

#### DataExportController
**File:** `src/controllers/DataExportController.ts`

Methods:
- `requestDataExport()` - Initiate GDPR data export
- `getExportRequests()` - List export requests
- `getExportStatus()` - Check specific export status
- `downloadExport()` - Download exported data
- `cancelExport()` - Cancel pending export
- `requestAccountDeletion()` - Request account deletion
- `cancelAccountDeletion()` - Cancel deletion request

Features:
- 24-hour rate limiting
- Multiple export formats (JSON, CSV)
- Expiring download links
- 30-day account deletion grace period
- GDPR compliance

### Resources (Serializers)

- `UserProfileResource.ts` - Single profile serialization
- `UserProfileCollection.ts` - Profile collection serialization
- `UserPreferencesResource.ts` - Preferences serialization
- `UserPreferencesCollection.ts` - Preferences collection serialization
- `PrivacySettingsResource.ts` - Privacy settings serialization
- `PrivacySettingsCollection.ts` - Privacy settings collection
- `AccountLinkResource.ts` - Account link with token masking
- `AccountLinkCollection.ts` - Collection with token sanitization

Token sanitization is performed in account link resources to prevent accidental exposure of OAuth tokens in API responses.

### Utilities

#### auditLogger.ts
**File:** `src/utils/auditLogger.ts`

Functions:
- `logAuditEvent()` - Log security and operational events
- `getUserAuditLogs()` - Retrieve user's audit history

Features:
- Comprehensive event logging
- IP address tracking
- User agent recording
- Error logging
- Metadata support
- Pagination support

#### profileValidators.ts
**File:** `src/utils/profileValidators.ts`

Validation rules:
- `profileValidationRules` - Profile field validation
- `preferencesValidationRules` - Preferences validation
- `privacySettingsValidationRules` - Privacy settings validation
- `accountLinkValidationRules` - Account linking validation
- `dataExportValidationRules` - Export format validation

Features:
- String length limits
- URL validation
- Enum validation
- Range validation
- Multi-language support

### API Routes

**File:** `src/routes/api.ts`

All endpoints are organized by feature:
- Profile management: 5 endpoints
- Preferences: 5 endpoints
- Privacy settings: 7 endpoints
- Account linking: 6 endpoints
- Data export: 7 endpoints

Total: **30 new API endpoints**

### Tests

Comprehensive test coverage in `src/controllers/__tests__/`:

1. **profile.controller.test.ts** - Profile CRUD operations
2. **preferences.controller.test.ts** - Preferences management
3. **privacy.controller.test.ts** - Privacy controls
4. **account-linking.controller.test.ts** - Account linking
5. **data-export.controller.test.ts** - Data export functionality

Each test suite covers:
- Basic CRUD operations
- Validation rules
- Enum support
- Edge cases
- Error handling
- Data integrity

### Documentation

1. **USER_PROFILE_PREFERENCES_API.md** - Comprehensive API documentation
   - All endpoints with examples
   - Request/response formats
   - Error handling
   - GDPR compliance notes
   - Security considerations

2. **ENDPOINTS.md** - Updated with new feature endpoints
   - Quick reference for all endpoints
   - Link to detailed documentation

## Security Features

### Authorization & Authentication
- JWT-based authentication required for all user-specific endpoints
- Public endpoints properly protected (read-only for public profiles)
- No cross-user data access

### Data Protection
- Sensitive tokens masked in API responses
- SQL injection prevention via Prisma ORM
- Input validation and sanitization
- XSS protection via type validation

### Audit & Compliance
- Comprehensive audit logging for all sensitive operations
- GDPR-compliant data export
- 30-day account deletion grace period
- Configurable data retention policies
- Right to access, rectify, restrict, and erase data

### Rate Limiting
- Data export: 1 per 24 hours
- Account linking: 10 per hour
- Privacy updates: 20 per hour

## Database Schema Extensions

The migration adds 6 new tables:
- `user_profiles` - User profile information
- `user_preferences` - Preference settings
- `privacy_settings` - Privacy controls
- `account_links` - Linked social accounts
- `audit_logs` - Audit trail
- `data_export_requests` - GDPR export tracking

Plus 4 new enums:
- `AccountLinkProvider` - OAuth providers
- `PrivacyLevel` - Privacy levels
- `AuditAction` - Audit action types

## Feature Highlights

### 1. Profile Management
- Automatic profile creation
- Profile completion tracking
- Public/private profiles
- Verified badge support
- Professional profile mode

### 2. User Preferences
- Granular notification control
- Display preferences
- Two-factor authentication
- Custom preference storage
- Default value support

### 3. Privacy Controls
- Profile visibility levels
- Field-level visibility controls
- User blocking/unblocking
- Search engine control
- Data retention policies

### 4. Account Linking
- Support for 6 OAuth providers
- Automatic token refresh
- Provider availability checking
- Link verification
- Metadata storage

### 5. GDPR Compliance
- Full data export (JSON/CSV)
- Right to be forgotten (30-day deletion)
- Audit trail for all operations
- Configurable data retention
- Data portability support

## Usage Examples

### Get User Profile
```bash
curl -X GET https://api.artisyn.io/api/profile \
  -H "Authorization: Bearer <token>"
```

### Update Profile
```bash
curl -X POST https://api.artisyn.io/api/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d {
    "bio": "I love art",
    "occupation": "Designer"
  }
```

### Link Social Account
```bash
curl -X POST https://api.artisyn.io/api/account-links \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d {
    "provider": "GOOGLE",
    "providerUserId": "google-id-123",
    "accessToken": "access-token"
  }
```

### Request Data Export
```bash
curl -X POST https://api.artisyn.io/api/data-export/request \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d {
    "format": "json"
  }
```

## File Structure

```
src/
├── controllers/
│   ├── ProfileController.ts
│   ├── PreferencesController.ts
│   ├── PrivacySettingsController.ts
│   ├── AccountLinkingController.ts
│   ├── DataExportController.ts
│   └── __tests__/
│       ├── profile.controller.test.ts
│       ├── preferences.controller.test.ts
│       ├── privacy.controller.test.ts
│       ├── account-linking.controller.test.ts
│       └── data-export.controller.test.ts
├── resources/
│   ├── UserProfileResource.ts
│   ├── UserProfileCollection.ts
│   ├── UserPreferencesResource.ts
│   ├── UserPreferencesCollection.ts
│   ├── PrivacySettingsResource.ts
│   ├── PrivacySettingsCollection.ts
│   ├── AccountLinkResource.ts
│   └── AccountLinkCollection.ts
├── utils/
│   ├── auditLogger.ts
│   └── profileValidators.ts
└── routes/
    └── api.ts (updated)

prisma/
├── schema.prisma (updated)
└── migrations/
    └── 20260122120000_add_user_profile_preferences_privacy/
        └── migration.sql

docs/
├── USER_PROFILE_PREFERENCES_API.md (new)
└── ENDPOINTS.md (updated)
```

## Testing

Run tests with:
```bash
pnpm test
```

Run specific test:
```bash
pnpm test profile.controller.test.ts
```

Run with coverage:
```bash
pnpm test --coverage
```

## Performance Considerations

1. **Indexing**: All frequently queried fields are indexed
   - userId on all user-related tables
   - provider on account links
   - status on export requests
   - action on audit logs

2. **Query Optimization**: Uses Prisma's select for field-level queries
3. **Pagination**: Implemented on all list endpoints
4. **Caching**: Suitable for Redis caching of preferences

## Future Enhancements

1. **Activity Timeline**: User activity feed
2. **Analytics Dashboard**: Privacy-friendly analytics
3. **Bulk Operations**: Batch profile updates
4. **Webhooks**: Real-time event notifications
5. **Advanced Privacy**: Granular permission rules
6. **Profile Recommendations**: Completion suggestions
7. **Data Sync**: Cross-device preference sync
8. **Export Scheduling**: Automatic periodic exports

## Deployment Notes

1. **Database Migration**: Run `pnpm migrate` before deployment
2. **Environment Variables**: No new env vars required
3. **Dependencies**: No new npm packages added
4. **Backwards Compatibility**: Existing endpoints unchanged
5. **API Versioning**: Endpoints use /api/* prefix

## Support & Troubleshooting

### Common Issues

1. **Profile not created on first access**
   - Ensure CreateProfile middleware is called
   - Check database migrations have run

2. **Audit logs not appearing**
   - Verify logAuditEvent is called in controller methods
   - Check database write permissions

3. **Token masking not working**
   - Ensure AccountLinkResource.data() is called
   - Verify resource classes are used in API responses

## Contributors

- Implementation: Artisyn Development Team
- GDPR Compliance: Legal & Privacy Team
- Testing: QA Team

## References

- [GDPR Compliance Guide](https://gdpr-info.eu/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)

