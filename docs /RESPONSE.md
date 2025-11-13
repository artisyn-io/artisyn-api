# Artisyn.io Backend API

## General Format

API endpoints must follow the **single responsibility principle** and return camelCased JSON responses.

All response objects **must always** include the following properties:

- `data`
- `message`
- `status`
- `code`

For endpoints returning a **single object**, the `data` property should contain that object.

For endpoints returning a **list**, the `data` property should contain the list, and an additional `meta` object must be included. This `meta` object should contain a `pagination` object with the following structure:

- `from`: Start index
- `to`: End index
- `perPage`: Number of items per page
- `total`: Total number of items

If any other specific datasets are needed (e.g., filters, counts, aggregates), they can be added to the `meta` object or alongside the `data` payload.

### For single Resources

```ts
import { ApiResource } from './src/resources/index';
import UserResource from './src/resources/UserResource';

app.get('/user', (req, res) => {
  ApiResource(
    new UserResource(req, res, {
      id: 1,
      email: 'user@example.com',
    })
  ).json();
});
```

### For Resource Collections

```ts
import { ApiResource } from './src/resources/index';
import UserCollection from '.src/resources/UserCollection';

app.get('/users', (req, res) => {
  ApiResource(
    new UserCollection(req, res, {
      data: [
        {
          id: 1,
          email: 'as@e.com',
        },
        {
          id: 2,
          email: 'as13@e.com',
        },
      ],
    })
  ).json();
});
```

OR

```ts
import { ApiResource } from './src/resources/index';
import UserCollection from '.src/resources/UserCollection';

app.get('/users', (req, res) => {
  ApiResource(
    new UserCollection(req, res, {
      data: [
        {
          id: 1,
          email: 'as@e.com',
        },
        {
          id: 2,
          email: 'as13@e.com',
        },
      ],
      pagination: {
        from: 1,
        to: 10,
      },
    })
  ).json();
});
```

### List Example

```json
{
  "data": [],
  "status": "success",
  "message": "OK",
  "code": 200,
  "meta": {
    "pagination": {
      "from": 1,
      "to": 2,
      "perPage": 5,
      "total": 10
    }
  }
}
```

### Single Object Example

```json
{
  "data": {
    "id": 1,
    "name": "John"
  },
  "status": "success",
  "message": "OK",
  "code": 200
}
```

---

## Response Statuses

### Successful Responses

Use the appropriate HTTP status code for the request type. This status should be included in both the HTTP response and the `code` field in the response body.

- **GET:** `200 OK`
- **POST:** `201 Created`
- **PUT/PATCH:** `202 Accepted`
- **DELETE:** `202 Accepted`

### Failed Responses

Failed requests should return meaningful status codes and include them in the `code` field of the response body.

- `400` – Bad Request (General Errors)
- `401` – Unauthenticated (Authentication Required)
- `403` – Forbidden (Special Privileges Required)
- `404` – Not Found (Missing Models)
- `422` – Unprocessable Entity (Validation Errors)
- `500` – Internal Server Error (Unhandled Exceptions)

---

## Status Field

The `status` field describes the general outcome of the request using one of the following:

- `success` – The request was successful
- `info` – The request was successful but includes additional information
- `error` – The request failed due to a known error
- `warning` – The request succeeded with a caution or soft error

---

## Message Field

The `message` field should provide a human-readable explanation of the outcome. If there's no specific message (e.g., a simple GET with no extra info), default to the standard status messages:

| Code | Default Message       |
| ---- | --------------------- |
| 200  | OK                    |
| 201  | Created               |
| 202  | Accepted              |
| 400  | Bad Request           |
| 401  | Unauthenticated       |
| 403  | Access Denied         |
| 404  | Not Found             |
| 422  | Unprocessable Entity  |
| 500  | Internal Server Error |

---

## API Resources and Collections

The recommended API response can easily be easily be obtained by implementing the `JsonResource` class in `src/resources/index`
Here is how it works.

## Generating Resource Collections

The current setup allows you to generate resources and resources collections with a CLI command.

### Resources

The command to generate an API Resource has this signature: `command make:resource [options] <name>`

To generate a Resource Collection named User collection run the command below

```
yarn command make:resource UserResource
```

### Resource Collections

The command to generate an API Resource Collection has this signature: `command make:resource [options] <name>Collection`

By appending `Collection` to the resource name, we are telling the system to generate a resource collection.

To generate a Resource Collection named User collection run the command below

```
yarn command make:resource UserCollection
```

Additionally, you can simply run `command` to see all available commands and signatures
