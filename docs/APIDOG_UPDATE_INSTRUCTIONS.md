# Apidog Documentation Update Instructions

## Overview

This document provides instructions for updating the Apidog project documentation (`DOCUMENTATION.json`) with the new Jobs API endpoints.

---

## Prerequisites

- Apidog desktop application or web access
- Access to the Artisyn API Apidog project
- Admin/Editor permissions in the project

---

## Jobs API Endpoints to Add

### 1. Create "Jobs" Folder

In the Apidog project, create a new folder called **"Jobs"** under the API collection.

---

### 2. Add Endpoints

#### Endpoint 1: List Jobs

**Method:** `GET`  
**Path:** `/api/jobs`  
**Name:** List Jobs  
**Description:** List jobs for the authenticated user with role-based filtering

**Authentication:**
- Type: Bearer Token
- Required: Yes

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| limit | integer | No | Items per page (default: 10, max: 100) |
| status | string | No | Filter by status: active, in_progress, completed, cancelled, disputed |
| listingId | string | No | Filter by listing ID (curators/admins only) |

**Response Example (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "applicationId": "550e8400-e29b-41d4-a716-446655440001",
      "listingId": "550e8400-e29b-41d4-a716-446655440002",
      "clientId": "550e8400-e29b-41d4-a716-446655440003",
      "curatorId": "550e8400-e29b-41d4-a716-446655440004",
      "status": "active",
      "notes": "Project kickoff scheduled for next week",
      "createdAt": "2026-03-25T14:00:00.000Z",
      "updatedAt": "2026-03-25T14:00:00.000Z",
      "listing": {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "name": "Custom Portrait Painting",
        "description": "Professional portrait painting service"
      },
      "client": {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "https://example.com/avatar.jpg"
      },
      "curator": {
        "id": "550e8400-e29b-41d4-a716-446655440004",
        "firstName": "Jane",
        "lastName": "Smith",
        "avatar": "https://example.com/avatar2.jpg"
      }
    }
  ],
  "status": "success",
  "message": "Jobs retrieved successfully",
  "code": 200,
  "meta": {
    "pagination": {
      "from": 1,
      "to": 10,
      "perPage": 10,
      "total": 25
    }
  }
}
```

---

#### Endpoint 2: Get Job Details

**Method:** `GET`  
**Path:** `/api/jobs/:id`  
**Name:** Get Job Details  
**Description:** Get detailed information about a specific job (involved parties only)

**Authentication:**
- Type: Bearer Token
- Required: Yes

**Path Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string (UUID) | Yes | Job ID |

**Response Example (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "applicationId": "550e8400-e29b-41d4-a716-446655440001",
    "listingId": "550e8400-e29b-41d4-a716-446655440002",
    "clientId": "550e8400-e29b-41d4-a716-446655440003",
    "curatorId": "550e8400-e29b-41d4-a716-446655440004",
    "status": "active",
    "notes": "Project kickoff scheduled for next week",
    "createdAt": "2026-03-25T14:00:00.000Z",
    "updatedAt": "2026-03-25T14:00:00.000Z",
    "application": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "message": "I would love to work on this project",
      "createdAt": "2026-03-24T10:00:00.000Z"
    },
    "listing": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "Custom Portrait Painting",
      "description": "Professional portrait painting service",
      "price": 500.00,
      "images": ["https://example.com/image1.jpg"],
      "curatorId": "550e8400-e29b-41d4-a716-446655440004"
    },
    "client": {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "avatar": "https://example.com/avatar.jpg"
    },
    "curator": {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com",
      "avatar": "https://example.com/avatar2.jpg"
    }
  },
  "status": "success",
  "message": "OK",
  "code": 200
}
```

**Error Responses:**

404 Not Found:
```json
{
  "status": "error",
  "message": "Job not found",
  "code": 404
}
```

403 Forbidden:
```json
{
  "status": "error",
  "message": "Unauthorized access to this job",
  "code": 403
}
```

---

#### Endpoint 3: Update Job

**Method:** `PUT`  
**Path:** `/api/jobs/:id`  
**Name:** Update Job  
**Description:** Update job status or notes (involved parties only)

**Authentication:**
- Type: Bearer Token
- Required: Yes

**Path Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string (UUID) | Yes | Job ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | New job status (must follow valid transitions) |
| notes | string | No | Job notes (max 2000 characters) |

**Valid Status Values:**
- `active`
- `in_progress`
- `completed`
- `cancelled`
- `disputed`

**Request Example:**
```json
{
  "status": "in_progress",
  "notes": "Work has started on the project"
}
```

**Response Example (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "applicationId": "550e8400-e29b-41d4-a716-446655440001",
    "listingId": "550e8400-e29b-41d4-a716-446655440002",
    "clientId": "550e8400-e29b-41d4-a716-446655440003",
    "curatorId": "550e8400-e29b-41d4-a716-446655440004",
    "status": "in_progress",
    "notes": "Work has started on the project",
    "createdAt": "2026-03-25T14:00:00.000Z",
    "updatedAt": "2026-03-25T15:00:00.000Z",
    "listing": { /* ... */ },
    "client": { /* ... */ },
    "curator": { /* ... */ }
  },
  "status": "success",
  "message": "Job updated successfully",
  "code": 200
}
```

**Error Responses:**

400 Bad Request (Invalid Transition):
```json
{
  "status": "error",
  "message": "Cannot transition from 'completed' to 'cancelled'. Allowed transitions from 'completed': none (terminal state)",
  "code": 400
}
```

422 Unprocessable Entity (Invalid Status):
```json
{
  "status": "error",
  "message": "Invalid job status",
  "code": 422
}
```

---

#### Endpoint 4: Delete Job

**Method:** `DELETE`  
**Path:** `/api/jobs/:id`  
**Name:** Delete Job  
**Description:** Delete a job (admin only, cancelled/disputed only)

**Authentication:**
- Type: Bearer Token
- Required: Yes
- Role: ADMIN

**Path Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string (UUID) | Yes | Job ID |

**Response Example (202 Accepted):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "status": "success",
  "message": "Job deleted successfully",
  "code": 202
}
```

**Error Responses:**

403 Forbidden:
```json
{
  "status": "error",
  "message": "Only administrators can delete jobs",
  "code": 403
}
```

400 Bad Request:
```json
{
  "status": "error",
  "message": "Jobs can only be deleted if they are cancelled or disputed. Complete the job first or cancel it before deletion.",
  "code": 400
}
```

---

## Status Transition Rules

Document these rules in the endpoint descriptions:

### Valid Transitions

| From | To |
|------|-----|
| active | in_progress, cancelled |
| in_progress | completed, cancelled, disputed |
| completed | (none - terminal state) |
| cancelled | (none - terminal state) |
| disputed | completed, cancelled |

---

## Authorization Rules

Add these notes to each endpoint:

### GET /api/jobs
- **ADMIN**: Can see all jobs
- **CURATOR**: Can see jobs where they are the curator
- **USER**: Can see jobs where they are the client

### GET /api/jobs/:id
- Accessible by: Client, Curator, or Admin

### PUT /api/jobs/:id
- Accessible by: Client, Curator, or Admin

### DELETE /api/jobs/:id
- Accessible by: Admin only
- Additional rule: Job must be in `cancelled` or `disputed` status

---

## Environment Variables

Ensure the following environment variables are set in Apidog:

- `{{baseUrl}}` - API base URL (e.g., `https://api.artisyn.io`)
- `{{token}}` - JWT Bearer token for authentication

---

## Testing in Apidog

### Test Scenarios to Add

1. **List Jobs**
   - Test as client (should see own jobs)
   - Test as curator (should see curator jobs)
   - Test as admin (should see all jobs)
   - Test with status filter
   - Test pagination

2. **Get Job Details**
   - Test as client (should succeed)
   - Test as curator (should succeed)
   - Test as unauthorized user (should fail with 403)
   - Test with invalid ID (should fail with 404)

3. **Update Job**
   - Test valid status transition (active → in_progress)
   - Test invalid status transition (completed → cancelled)
   - Test update notes only
   - Test update both status and notes
   - Test as unauthorized user (should fail with 403)

4. **Delete Job**
   - Test as admin with cancelled job (should succeed)
   - Test as admin with active job (should fail with 400)
   - Test as non-admin (should fail with 403)

---

## Mock Data

Add the following mock data rules in Apidog:

### Job Object
```json
{
  "id": "@uuid",
  "applicationId": "@uuid",
  "listingId": "@uuid",
  "clientId": "@uuid",
  "curatorId": "@uuid",
  "status": "@pick(['active', 'in_progress', 'completed', 'cancelled', 'disputed'])",
  "notes": "@sentence",
  "createdAt": "@datetime",
  "updatedAt": "@datetime"
}
```

---

## Export and Backup

After adding all endpoints:

1. Export the updated Apidog project
2. Save as `DOCUMENTATION.json`
3. Replace the existing `DOCUMENTATION.json` in the repository
4. Commit the changes with message: "docs: Update Apidog documentation with Jobs API"

---

## Additional Resources

- [Jobs API Documentation](./JOBS_API.md)
- [Jobs Implementation Summary](./JOBS_IMPLEMENTATION_SUMMARY.md)
- [API Endpoints Overview](./ENDPOINTS.md)
- [Response Format Standard](./RESPONSE.md)

---

## Support

For questions about Apidog documentation:
1. Refer to [Apidog Documentation](https://apidog.com/help/)
2. Check the [Jobs API Documentation](./JOBS_API.md) for endpoint details
3. Contact the development team

---

**Last Updated**: 2026-03-25
**Version**: 1.0.0
