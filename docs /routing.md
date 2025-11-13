# Artisyn Dynamic Routing System

This document explains the dynamic routing system for Artisyn.io API, designed to automatically load and mount route handlers from a directory structure. It supports organizing API endpoints in files like `api.ts`, grouping related endpoints in `api/users.ts`, and handling generic endpoints with names like `api/__generic.ts`.

## Overview

The system scans a directory (`routes/`) for .ts or .js files, loads their default Express router exports, and mounts them to paths based on their file paths. This reduces boilerplate and supports modular API organization.

## How It Works

- **Directory Traversal**: Recursively scans the `routes/` directory for files and subdirectories.

- **File Processing**: For .ts or .js files (excluding index files):

  - Loads the file’s default export (an Express router).
  - Derives a mount path from the file’s relative path.
  - Mounts the router to the path.

- **Special Cases**:

  - web.ts mounts at /.
  - Files like `generic.ts` have `__<word>` removed from the mount path.

- **Router Integration**: All routes are attached to a single Express Router.

```tree
routes/
├── index.ts             # Dynamic loading logic
├── web.ts               # Root endpoints (/)
├── api.ts               # API endpoints (/api)
├── api/
│   ├── users.ts         # User endpoints (/api/users)
│   ├── __generic.ts     # Generic endpoints (/api)
│   └── artisans/
│       └── reviews.ts  # Comment endpoints (/api/artisans/reviews)
```

## File Naming Conventions

- **Route Files**: Must be .ts or .js, export a default Express Router, and not start with index.

- **Special Files**:
  - `web.ts`: Mounts at `/`.
  - `__<word>.ts` (e.g., `__generic.ts`): `__<word>` is removed from the path.
  - Ignored: `index.ts`, non-`.ts`/`.js` files.

## Route Mounting Rules

- **Standard**: Mount path is the relative path without .ts/.js (e.g., api/users.ts → /api/users).

- **Special**:

  - `web.ts` → `/`.
  - `__generic.ts` in `api/` → `/api`.

- **Nested**: Subdirectories create nested paths (e.g., `api/artisans/reviews.ts` → `/api/artisans/reviews`).

## Usage Guidelines

- **Create Route Files**:

  ```ts
  import { Router } from 'express';
  const router = Router();
  router.get('/', (req, res) => res.send('Hello'));
  export default router;
  ```

- **Organize**:
  - **Single files**: `api.ts` for general endpoints.
  - **Subdirectories**: `api/users.ts` for related endpoints.
  - **Generic**: `api/__generic.ts` for shared paths.

## Example

```
routes/
├── web.ts
├── api.ts
├── api/
│   ├── users.ts
│   ├── __generic.ts
│   └── artisans/
│       └── reviews.ts
```

## Troubleshooting

- **Routes Not Loading**: Check for default export and `.ts`/`.js` extension.
- **Wrong Path**: Verify file location and naming (e.g., web.ts, `__generic.ts`).
  **Errors**: Fix syntax errors in route files; check console.
- **Case Sensitivity**: Use lower casing.

This system simplifies route management while supporting flexible organization. Refer to Express.js docs for more details.
