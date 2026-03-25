# Jobs API Documentation

## Overview

The Jobs API manages the lifecycle of work engagements between clients and curators. A Job is automatically created when an application is accepted, transitioning the relationship from application to active work engagement.

## Job Lifecycle

Jobs follow a defined lifecycle with validated state transitions:

```
active → in_progress → completed (terminal)
       ↘ cancelled (terminal)

in_progress → completed (terminal)
            ↘ cancelled (terminal)
            ↘ disputed

disputed → completed (terminal)
         ↘ cancelled (terminal)
```

### Job Statuses

- **active**: Job has been created and is ready to start
- **in_progress**: Work has begun on the job
- **completed**: Job has been successfully completed (terminal state)
- **cancelled**: Job was cancelled by either party (terminal state)
- **disputed**: There is a dispute about the job that needs resolution

## Database Schema

```prisma
model Job {
  id            String    @id @default(uuid())
  applicationId String    @unique
  listingId     String
  clientId      String    // User who applied (applicant)
  curatorId     String    // Listing owner
  status        JobStatus @default(active)
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  listing     Artisan     @relation(fields: [listingId], references: [id], onDelete: Cascade)
  client      User        @relation("JobClient", fields: [clientId], references: [id], onDelete: Cascade)
  curator     User        @relation("JobCurator", fields: [curatorId], references: [id], onDelete: Cascade)

  @@index([listingId])
  @@index([clientId])
  @@index([curatorId])
  @@index([status])
  @@index([createdAt])
  @@map("jobs")
}

enum JobStatus {
  active
  in_progress
  completed
  cancelled
  disputed
}
```

### Indexes

The following indexes are created for optimal query performance:
- `listingId` - For querying jobs by listing
- `clientId` - For querying jobs by client
- `curatorId` - For querying jobs by curator
- `status` - For filtering jobs by status
- `createdAt` - For sorting jobs chronologically

## API Endpoints

### 1. List Jobs

**GET** `/api/jobs`

List jobs for the authenticated user with role-based filtering.

#### Authentication
Required: Yes (JWT Bearer token)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| limit | integer | No | Items per page (default: 10, max: 100) |
| status | string | No | Filter by status: `active`, `in_progress`, `completed`, `cancelled`, `disputed` |
| listingId | string | No | Filter by listing ID (curators and admins only) |

#### Authorization Rules

- **ADMIN**: Can see all jobs in the system
- **CURATOR**: Can see jobs where they are the curator
- **USER**: Can see jobs where they are the client

#### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "applicationId": "uuid",
      "listingId": "uuid",
      "clientId": "uuid",
      "curatorId": "uuid",
      "status": "active",
      "notes": "Optional notes about the job",
      "createdAt": "2026-03-25T14:00:00.000Z",
      "updatedAt": "2026-03-25T14:00:00.000Z",
      "listing": {
        "id": "uuid",
        "name": "Listing Name",
        "description": "Listing description",
        "curatorId": "uuid"
      },
      "client": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "https://..."
      },
      "curator": {
        "id": "uuid",
        "firstName": "Jane",
        "lastName": "Smith",
        "avatar": "https://..."
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

#### Example Requests

```bash
# List all jobs for authenticated user
curl -X GET "https://api.artisyn.io/api/jobs" \
  -H "Authorization: Bearer <token>"

# Filter by status
curl -X GET "https://api.artisyn.io/api/jobs?status=active" \
  -H "Authorization: Bearer <token>"

# Paginate results
curl -X GET "https://api.artisyn.io/api/jobs?page=2&limit=20" \
  -H "Authorization: Bearer <token>"

# Filter by listing (curator/admin only)
curl -X GET "https://api.artisyn.io/api/jobs?listingId=<listing-id>" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Job Details

**GET** `/api/jobs/:id`

Get detailed information about a specific job.

#### Authentication
Required: Yes (JWT Bearer token)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Job ID |

#### Authorization Rules

Only the following users can view a job:
- The client (applicant)
- The curator (listing owner)
- Administrators

#### Response

```json
{
  "data": {
    "id": "uuid",
    "applicationId": "uuid",
    "listingId": "uuid",
    "clientId": "uuid",
    "curatorId": "uuid",
    "status": "active",
    "notes": "Optional notes about the job",
    "createdAt": "2026-03-25T14:00:00.000Z",
    "updatedAt": "2026-03-25T14:00:00.000Z",
    "application": {
      "id": "uuid",
      "message": "Application message",
      "createdAt": "2026-03-25T13:00:00.000Z"
    },
    "listing": {
      "id": "uuid",
      "name": "Listing Name",
      "description": "Listing description",
      "price": 100.00,
      "images": ["https://..."],
      "curatorId": "uuid"
    },
    "client": {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "avatar": "https://..."
    },
    "curator": {
      "id": "uuid",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com",
      "avatar": "https://..."
    }
  },
  "status": "success",
  "message": "OK",
  "code": 200
}
```

#### Example Request

```bash
curl -X GET "https://api.artisyn.io/api/jobs/<job-id>" \
  -H "Authorization: Bearer <token>"
```

#### Error Responses

**404 Not Found**
```json
{
  "status": "error",
  "message": "Job not found",
  "code": 404
}
```

**403 Forbidden**
```json
{
  "status": "error",
  "message": "Unauthorized access to this job",
  "code": 403
}
```

---

### 3. Update Job

**PUT** `/api/jobs/:id`

Update job status or notes. Status transitions are validated according to the job lifecycle rules.

#### Authentication
Required: Yes (JWT Bearer token)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Job ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | New job status (must follow valid transitions) |
| notes | string | No | Job notes (max 2000 characters) |

#### Authorization Rules

Only the following users can update a job:
- The client (applicant)
- The curator (listing owner)
- Administrators

#### Valid Status Transitions

| From | To |
|------|-----|
| active | in_progress, cancelled |
| in_progress | completed, cancelled, disputed |
| completed | (none - terminal state) |
| cancelled | (none - terminal state) |
| disputed | completed, cancelled |

#### Response

```json
{
  "data": {
    "id": "uuid",
    "applicationId": "uuid",
    "listingId": "uuid",
    "clientId": "uuid",
    "curatorId": "uuid",
    "status": "in_progress",
    "notes": "Updated notes",
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

#### Example Requests

```bash
# Update job status
curl -X PUT "https://api.artisyn.io/api/jobs/<job-id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }'

# Update job notes
curl -X PUT "https://api.artisyn.io/api/jobs/<job-id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Work has started on the project"
  }'

# Update both status and notes
curl -X PUT "https://api.artisyn.io/api/jobs/<job-id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "notes": "Project completed successfully"
  }'
```

#### Error Responses

**400 Bad Request - Invalid Transition**
```json
{
  "status": "error",
  "message": "Cannot transition from 'completed' to 'cancelled'. Allowed transitions from 'completed': none (terminal state)",
  "code": 400
}
```

**422 Unprocessable Entity - Invalid Status**
```json
{
  "status": "error",
  "message": "Invalid job status",
  "code": 422
}
```

---

### 4. Delete Job

**DELETE** `/api/jobs/:id`

Delete a job. Only administrators can delete jobs, and only if they are in `cancelled` or `disputed` status.

#### Authentication
Required: Yes (JWT Bearer token)

#### Authorization
Only administrators can delete jobs.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Job ID |

#### System Rules

Jobs can only be deleted if they are in one of the following statuses:
- `cancelled`
- `disputed`

Active, in-progress, or completed jobs cannot be deleted.

#### Response

```json
{
  "data": {
    "id": "uuid"
  },
  "status": "success",
  "message": "Job deleted successfully",
  "code": 202
}
```

#### Example Request

```bash
curl -X DELETE "https://api.artisyn.io/api/jobs/<job-id>" \
  -H "Authorization: Bearer <token>"
```

#### Error Responses

**403 Forbidden**
```json
{
  "status": "error",
  "message": "Only administrators can delete jobs",
  "code": 403
}
```

**400 Bad Request**
```json
{
  "status": "error",
  "message": "Jobs can only be deleted if they are cancelled or disputed. Complete the job first or cancel it before deletion.",
  "code": 400
}
```

---

## Job Creation

Jobs are **automatically created** when an application is accepted. This is handled internally by the [`ApplicationController`](../src/controllers/ApplicationController.ts).

### Automatic Job Creation Flow

1. Curator accepts an application via `PUT /api/applications/:id/status`
2. Application status is updated to `ACCEPTED`
3. A new Job is automatically created with:
   - `applicationId`: The accepted application ID
   - `listingId`: The listing the application was for
   - `clientId`: The applicant's user ID
   - `curatorId`: The listing owner's user ID
   - `status`: `active` (initial status)
4. The acceptance response includes the created job ID

### Example Application Acceptance

```bash
# Accept an application (creates a job)
curl -X PUT "https://api.artisyn.io/api/applications/<application-id>/status" \
  -H "Authorization: Bearer <curator-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ACCEPTED"
  }'
```

**Response:**
```json
{
  "data": {
    "id": "application-uuid",
    "status": "ACCEPTED",
    /* ... other application fields ... */
  },
  "status": "success",
  "message": "Application status updated to ACCEPTED. Job created.",
  "code": 200,
  "job": {
    "id": "job-uuid"
  }
}
```

### Duplicate Prevention

The system prevents duplicate job creation. If an application is accepted multiple times (e.g., status updated again), the existing job is returned rather than creating a new one.

---

## Validation

### Request Validation

All endpoints use express-validator for input validation:

#### GET /api/jobs
- `page`: Optional integer, minimum 1
- `limit`: Optional integer, between 1 and 100
- `status`: Optional, must be one of: `active`, `in_progress`, `completed`, `cancelled`, `disputed`

#### GET /api/jobs/:id
- `id`: Required UUID

#### PUT /api/jobs/:id
- `id`: Required UUID
- `status`: Optional, must be one of: `active`, `in_progress`, `completed`, `cancelled`, `disputed`
- `notes`: Optional string, maximum 2000 characters

#### DELETE /api/jobs/:id
- `id`: Required UUID

### Business Logic Validation

#### Status Transitions
The system enforces valid status transitions. Attempting an invalid transition returns a 400 error with details about allowed transitions.

#### Authorization
All endpoints verify that the requesting user has permission to perform the action:
- View: Client, curator, or admin
- Update: Client, curator, or admin
- Delete: Admin only

---

## Testing

Comprehensive test coverage is provided in [`src/controllers/__tests__/jobs.controller.test.ts`](../src/controllers/__tests__/jobs.controller.test.ts).

### Test Coverage

The test suite includes:

#### GET /api/jobs
- ✓ List jobs for client
- ✓ List jobs for curator
- ✓ List all jobs for admin
- ✓ Filter jobs by status
- ✓ Return 401 without authentication
- ✓ Support pagination

#### GET /api/jobs/:id
- ✓ Return job for client
- ✓ Return job for curator
- ✓ Return job for admin
- ✓ Return 404 for non-existent job
- ✓ Return 401 without authentication
- ✓ Return 403 for unauthorized user

#### PUT /api/jobs/:id
- ✓ Update job status from active to in_progress
- ✓ Update job notes
- ✓ Update both status and notes in one request
- ✓ Allow transition from in_progress to disputed
- ✓ Reject invalid status transitions
- ✓ Reject invalid status values
- ✓ Return 403 for unauthorized user
- ✓ Allow curator to update notes

#### DELETE /api/jobs/:id
- ✓ Allow admin to delete cancelled job
- ✓ Reject delete by non-admin
- ✓ Reject delete of active job
- ✓ Allow admin to delete disputed job

#### Job Lifecycle Validation
- ✓ Enforce terminal state for completed jobs
- ✓ Allow disputed to completed transition
- ✓ Allow disputed to cancelled transition

#### Application Acceptance Creates Job
- ✓ Automatically create a job when application is accepted
- ✓ Include job ID in acceptance response
- ✓ Not create duplicate jobs for same application

### Running Tests

```bash
# Run all tests
npm test

# Run only jobs tests
npm test -- src/controllers/__tests__/jobs.controller.test.ts

# Run with coverage
npm test -- --coverage
```

---

## Error Handling

All endpoints follow the standard error response format defined in [`docs/RESPONSE.md`](./RESPONSE.md).

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | success | Request successful (GET) |
| 201 | success | Resource created (POST) |
| 202 | success | Request accepted (PUT/DELETE) |
| 400 | error | Bad request (invalid transitions, business logic violations) |
| 401 | error | Unauthenticated (missing or invalid token) |
| 403 | error | Forbidden (insufficient permissions) |
| 404 | error | Not found (job doesn't exist) |
| 422 | error | Unprocessable entity (validation errors) |
| 500 | error | Internal server error |

---

## Integration with Other Systems

### Applications
Jobs are tightly integrated with the Applications system. When an application is accepted, a job is automatically created.

See: [`docs/ENDPOINTS.md`](./ENDPOINTS.md) for application endpoints.

### Listings (Artisans)
Each job is linked to a listing (Artisan model) that defines the work to be performed.

### Users
Jobs involve two user roles:
- **Client**: The user who applied for the listing
- **Curator**: The user who owns the listing

---

## Security Considerations

### Authentication
All endpoints require JWT authentication. Tokens must be included in the `Authorization` header as a Bearer token.

### Authorization
Role-based access control ensures:
- Users can only see their own jobs (as client or curator)
- Curators can see all jobs for their listings
- Admins can see and manage all jobs

### Data Privacy
Job details are only visible to involved parties (client, curator, admin). Unauthorized users receive a 403 Forbidden response.

### Audit Trail
All job updates are tracked with `createdAt` and `updatedAt` timestamps for audit purposes.

---

## Performance Optimization

### Database Indexes
The following indexes optimize query performance:
- `listingId` - Fast lookup of jobs by listing
- `clientId` - Fast lookup of jobs by client
- `curatorId` - Fast lookup of jobs by curator
- `status` - Efficient filtering by status
- `createdAt` - Optimized sorting by creation date

### Pagination
All list endpoints support pagination to prevent large result sets:
- Default: 10 items per page
- Maximum: 100 items per page

---

## Future Enhancements

Potential future improvements:
- Job milestones and progress tracking
- Payment integration for job completion
- Automated notifications for status changes
- Job ratings and feedback system
- Dispute resolution workflow
- Job templates for common work types
- Time tracking integration
- File attachments for job deliverables

---

## Related Documentation

- [Response Format Standard](./RESPONSE.md)
- [API Endpoints Overview](./ENDPOINTS.md)
- [Database Schema](./schema.md)
- [Security Guidelines](./SECURITY.md)
- [Application Management](./ENDPOINTS.md#applications)

---

## Support

For questions or issues related to the Jobs API:
1. Check this documentation
2. Review the test suite for usage examples
3. Consult the [QUICK_START_GUIDE.md](../QUICK_START_GUIDE.md)
4. Contact the development team

---

**Last Updated**: 2026-03-25
**API Version**: 1.0.0
