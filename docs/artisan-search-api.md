# Artisan Search API Documentation

## Overview

The Artisan Search API provides comprehensive search and filtering capabilities for artisan profiles. It supports full-text search, location-based queries, category filtering, and advanced sorting options.

## Base URL

```
GET /api/artisans
```

## Endpoints

### 1. Search Artisans

**Endpoint:** `GET /api/artisans`

**Description:** Search and filter artisans with various parameters.

#### Query Parameters

| Parameter     | Type    | Required | Description                                                   | Example                                                                          |
| ------------- | ------- | -------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `search`      | string  | No       | Full-text search across name, description, category, location | "woodworking"                                                                    |
| `category`    | string  | No       | Filter by category name                                       | "Woodworking"                                                                    |
| `subcategory` | string  | No       | Filter by subcategory name                                    | "Furniture"                                                                      |
| `country`     | string  | No       | Filter by country                                             | "USA"                                                                            |
| `state`       | string  | No       | Filter by state/province                                      | "New York"                                                                       |
| `city`        | string  | No       | Filter by city                                                | "New York"                                                                       |
| `type`        | enum    | No       | Filter by artisan type                                        | "PERSON" \| "BUSINESS"                                                           |
| `isVerified`  | boolean | No       | Filter by verification status (default: true)                 | true                                                                             |
| `isActive`    | boolean | No       | Filter by active status (default: true)                       | true                                                                             |
| `minPrice`    | number  | No       | Minimum price filter                                          | 50                                                                               |
| `maxPrice`    | number  | No       | Maximum price filter                                          | 500                                                                              |
| `latitude`    | number  | No       | Latitude for location-based search                            | 40.7128                                                                          |
| `longitude`   | number  | No       | Longitude for location-based search                           | -74.0060                                                                         |
| `radius`      | number  | No       | Search radius in kilometers                                   | 10                                                                               |
| `sortBy`      | enum    | No       | Sort results                                                  | "relevance" \| "rating" \| "price_low" \| "price_high" \| "created_at" \| "name" |
| `page`        | integer | No       | Page number (default: 1)                                      | 1                                                                                |
| `limit`       | integer | No       | Results per page (default: 20, max: 100)                      | 20                                                                               |

#### Sort Options

- `relevance`: Sort by relevance (verified status, review count, name)
- `rating`: Sort by average rating and review count
- `price_low`: Sort by price (low to high)
- `price_high`: Sort by price (high to low)
- `created_at`: Sort by creation date (newest first)
- `name`: Sort alphabetically by name

#### Example Requests

**Basic Search:**

```http
GET /api/artisans?search=woodworking
```

**Category and Location Filter:**

```http
GET /api/artisans?category=Woodworking&city=New%20York&country=USA
```

**Price Range with Sorting:**

```http
GET /api/artisans?minPrice=50&maxPrice=500&sortBy=rating
```

**Location-based Search:**

```http
GET /api/artisans?latitude=40.7128&longitude=-74.0060&radius=10
```

**Complex Filter:**

```http
GET /api/artisans?search=furniture&category=Woodworking&subcategory=Chairs&city=New%20York&isVerified=true&sortBy=rating&page=2&limit=10
```

#### Response Format

```json
{
  "data": [
    {
      "id": "artisan-uuid",
      "name": "John's Woodworking",
      "description": "Custom furniture maker specializing in handcrafted pieces",
      "email": "john@example.com",
      "phone": "+1234567890",
      "avatar": "https://example.com/avatar.jpg",
      "type": "PERSON",
      "price": 150.0,
      "priceRange": [100, 200],
      "images": ["https://example.com/image1.jpg"],
      "isActive": true,
      "isVerified": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T15:45:00Z",
      "category": {
        "id": "category-uuid",
        "name": "Woodworking",
        "description": "Handcrafted wood items"
      },
      "subcategory": {
        "id": "subcategory-uuid",
        "name": "Furniture",
        "description": "Custom furniture pieces"
      },
      "location": {
        "id": "location-uuid",
        "address": "123 Main St",
        "city": "New York",
        "state": "NY",
        "country": "USA",
        "postalCode": "10001",
        "latitude": 40.7128,
        "longitude": -74.006
      },
      "curator": {
        "id": "curator-uuid",
        "firstName": "Jane",
        "lastName": "Smith",
        "avatar": "https://example.com/curator-avatar.jpg"
      },
      "averageRating": 4.5,
      "reviewCount": 12
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "itemsPerPage": 20,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "filters": {
    "search": "woodworking",
    "category": "Woodworking",
    "sortBy": "relevance",
    "page": 1,
    "limit": 20
  },
  "status": "success",
  "message": "OK",
  "code": 200
}
```

### 2. Search Suggestions

**Endpoint:** `GET /api/artisans/suggestions`

**Description:** Get search suggestions based on partial input.

#### Query Parameters

| Parameter | Type   | Required | Description                            | Example |
| --------- | ------ | -------- | -------------------------------------- | ------- |
| `query`   | string | Yes      | Partial search term (min 2 characters) | "wood"  |

#### Example Request

```http
GET /api/artisans/suggestions?query=wood
```

#### Response Format

```json
{
  "data": [
    {
      "name": "Woodworking",
      "category": {
        "name": "Crafts"
      }
    },
    {
      "name": "Wood Furniture",
      "subcategory": {
        "name": "Furniture"
      }
    }
  ],
  "status": "success",
  "message": "OK",
  "code": 200
}
```

### 3. Popular Searches

**Endpoint:** `GET /api/artisans/popular`

**Description:** Get popular categories and locations based on artisan count.

#### Example Request

```http
GET /api/artisans/popular
```

#### Response Format

```json
{
  "data": {
    "categories": [
      {
        "id": "category-uuid",
        "name": "Woodworking",
        "description": "Handcrafted wood items",
        "_count": {
          "artisans": 150
        }
      }
    ],
    "locations": [
      {
        "city": "New York",
        "state": "NY",
        "country": "USA",
        "_count": {
          "id": 200
        }
      }
    ]
  },
  "status": "success",
  "message": "OK",
  "code": 200
}
```

## Error Responses

### Validation Error (400)

```json
{
  "status": "error",
  "message": "Validation failed",
  "code": 400,
  "errors": {
    "query": ["The query field must be at least 2 characters."]
  }
}
```

### Not Found (404)

```json
{
  "status": "error",
  "message": "Resource not found",
  "code": 404
}
```

### Server Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "code": 500
}
```

## Performance Considerations

### Caching

- Search results are cached for 5 minutes
- Popular data is cached for 10 minutes
- Cache is automatically invalidated when data changes

### Rate Limiting

- API endpoints are rate-limited to prevent abuse
- Consider implementing exponential backoff for failed requests

### Pagination

- Always use pagination for large result sets
- Default page size is 20, maximum is 100
- Deep pagination is optimized for performance

### Search Optimization

- Use specific filters when possible for better performance
- Location-based searches use spatial indexing
- Full-text search is optimized with trigram indexes

## SDK Examples

### JavaScript/TypeScript

```typescript
interface SearchParams {
  search?: string;
  category?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "rating" | "price_low" | "price_high";
  page?: number;
  limit?: number;
}

async function searchArtisans(params: SearchParams) {
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      queryParams.append(key, value.toString());
    }
  });

  const response = await fetch(`/api/artisans?${queryParams}`);
  return response.json();
}

// Usage
const results = await searchArtisans({
  search: "woodworking",
  city: "New York",
  sortBy: "rating",
  page: 1,
  limit: 20,
});
```

### Python

```python
import requests

def search_artisans(**params):
    response = requests.get('/api/artisans', params=params)
    return response.json()

# Usage
results = search_artisans(
    search='woodworking',
    city='New York',
    sort_by='rating',
    page=1,
    limit=20
)
```

## Testing

The API includes comprehensive test coverage:

### Unit Tests

- Search functionality
- Filter validation
- Pagination
- Sorting options

### Performance Tests

- Response time benchmarks
- Memory usage validation
- Load testing scenarios

Run tests:

```bash
npm test -- ArtisanSearchController
npm run test:performance
```

## Monitoring and Analytics

Search events are automatically tracked for analytics:

- Search queries
- Filter usage
- Result counts
- Response times

Access analytics through the admin dashboard or API endpoints.
