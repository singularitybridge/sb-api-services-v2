# Content Type API Documentation

## Base URL
`http://localhost:3000/content-type`

## Authentication
All endpoints require authentication using the `verifyAccess` middleware. Include your authentication token in the request headers:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Endpoints

### 1. Get All Content Types
Retrieves a list of all content types for the authenticated company.

**Endpoint:** `GET http://localhost:3000/content-type`

**Response:**
- Status: 200 OK
```json
[
  {
    "_id": "string",
    "name": "string",
    "description": "string",
    "fields": [
      {
        "name": "string",
        "type": "string",
        "required": boolean
      }
    ],
    "companyId": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
]
```

### 2. Get Content Type by ID
Retrieves a specific content type by its ID.

**Endpoint:** `GET http://localhost:3000/content-type/:id`

**Parameters:**
- `id` (path parameter): The ID of the content type

**Response:**
- Status: 200 OK
```json
{
  "_id": "string",
  "name": "string",
  "description": "string",
  "fields": [
    {
      "name": "string",
      "type": "string",
      "required": boolean
    }
  ],
  "companyId": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

- Status: 404 Not Found
```json
{
  "error": "Content type not found"
}
```

### 3. Create Content Type
Creates a new content type for the authenticated company.

**Endpoint:** `POST http://localhost:3000/content-type`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "fields": [
    {
      "name": "string",
      "type": "string",
      "required": boolean,
      "default": "any (optional)",
      "enum": ["array of allowed values (optional)"]
    }
  ]
}
```

**Response:**
- Status: 201 Created
```json
{
  "_id": "string",
  "name": "string",
  "description": "string",
  "fields": [
    {
      "name": "string",
      "type": "string",
      "required": boolean,
      "default": "any (if specified)",
      "enum": ["array of allowed values (if specified)"]
    }
  ],
  "companyId": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

### 4. Update Content Type
Updates an existing content type by its ID.

**Endpoint:** `PUT http://localhost:3000/content-type/:id`

**Parameters:**
- `id` (path parameter): The ID of the content type to update

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "fields": [
    {
      "name": "string",
      "type": "string",
      "required": boolean,
      "default": "any (optional)",
      "enum": ["array of allowed values (optional)"]
    }
  ]
}
```

**Response:**
- Status: 200 OK
```json
{
  "_id": "string",
  "name": "string",
  "description": "string",
  "fields": [
    {
      "name": "string",
      "type": "string",
      "required": boolean,
      "default": "any (if specified)",
      "enum": ["array of allowed values (if specified)"]
    }
  ],
  "companyId": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

- Status: 404 Not Found
```json
{
  "error": "Content type not found"
}
```

### 5. Delete Content Type
Deletes a content type by its ID.

**Endpoint:** `DELETE http://localhost:3000/content-type/:id`

**Parameters:**
- `id` (path parameter): The ID of the content type to delete

**Response:**
- Status: 200 OK
```json
{
  "message": "Content type deleted"
}
```

- Status: 404 Not Found
```json
{
  "error": "Content type not found"
}
```

## Error Responses
All endpoints may return the following error responses:

- Status: 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

- Status: 400 Bad Request (for POST requests without company ID)
```json
{
  "error": "Company ID is required"
}
```

## Example Usage with cURL

1. Get all content types:
```bash
curl -X GET 'http://localhost:3000/content-type' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

2. Get specific content type:
```bash
curl -X GET 'http://localhost:3000/content-type/CONTENT_TYPE_ID' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

3. Create new content type:
```bash
curl -X POST 'http://localhost:3000/content-type' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
  "name": "Blog Post",
  "description": "Structure for blog posts",
  "fields": [
    {
      "name": "title",
      "type": "string",
      "required": true
    },
    {
      "name": "content",
      "type": "text",
      "required": true
    }
  ]
}'
```

4. Update content type:
```bash
curl -X PUT 'http://localhost:3000/content-type/CONTENT_TYPE_ID' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
  "name": "Updated Blog Post",
  "description": "Updated structure for blog posts",
  "fields": [
    {
      "name": "title",
      "type": "string",
      "required": true
    },
    {
      "name": "content",
      "type": "text",
      "required": true
    },
    {
      "name": "tags",
      "type": "array",
      "required": false
    }
  ]
}'
```

5. Delete content type:
```bash
curl -X DELETE 'http://localhost:3000/content-type/CONTENT_TYPE_ID' \
-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
