# Content File Service and Routes Documentation

This document provides an overview of the Content File Service and its associated routes in the API.

## Content File Service

The Content File Service handles operations related to content files, including uploading, retrieving, and deleting files. It interacts with Google Cloud Storage for file storage and MongoDB for metadata storage.

### Functions

#### uploadContentFile

Uploads a content file to Google Cloud Storage and saves its metadata to MongoDB.

- **Parameters:**
  - `file`: The file to be uploaded (Express.Multer.File)
  - `companyId`: The ID of the company associated with the file
  - `title`: The title of the content file
  - `description`: Optional description of the content file
  - `sessionId`: Optional ID of the session associated with the file
  - `content`: Optional content of the file
- **Returns:** Promise resolving to the saved ContentFile document
- **Throws:** Error if upload or save operations fail

#### getContentFiles

Retrieves all content files associated with a specific company.

- **Parameters:**
  - `companyId`: The ID of the company
- **Returns:** Promise resolving to an array of ContentFile documents
- **Throws:** Error if the fetch operation fails

#### deleteContentFile

Deletes a content file from both Google Cloud Storage and MongoDB.

- **Parameters:**
  - `fileId`: The ID of the file to be deleted
  - `companyId`: The ID of the company associated with the file
- **Returns:** Promise resolving to an object indicating deletion status
- **Throws:** Error if the file is not found or if deletion fails

## Content File Routes

The Content File Routes define the API endpoints for interacting with content files. All routes are prefixed with `/content-file`.

### Routes

#### POST /content-file/upload

Uploads a new content file.

- **Middleware:** 
  - `verifyAccess()`: Ensures the request is authenticated
  - `multer`: Handles file upload
- **Request Body:**
  - `file`: The file to be uploaded
  - `title`: The title of the content file
  - `description`: Optional description of the content file
  - `sessionId`: Optional ID of the session associated with the file
  - `content`: Optional content of the file
- **Response:**
  - Status 201: Returns the uploaded content file data
  - Status 400: If no file is uploaded
  - Status 500: If an error occurs during upload

#### GET /content-file/list

Retrieves a list of all content files for the authenticated company.

- **Middleware:** 
  - `verifyAccess()`: Ensures the request is authenticated
- **Response:**
  - Status 200: Returns an array of content file objects
  - Status 500: If an error occurs while fetching the files

#### DELETE /content-file/:fileId

Deletes a specific content file.

- **Middleware:** 
  - `verifyAccess()`: Ensures the request is authenticated
- **URL Parameters:**
  - `fileId`: The ID of the file to be deleted
- **Response:**
  - Status 200: Returns a success message if the file is deleted
  - Status 500: If an error occurs while deleting the file

## Notes

- All routes are prefixed with `/content-file` and require authentication using the `verifyAccess()` middleware.
- File uploads are handled using `multer` middleware with in-memory storage.
- The service uses Google Cloud Storage for file storage and MongoDB for metadata storage.
- Error handling is implemented for all operations, with appropriate error messages returned to the client.
- The `sessionId` field is optional and can be used to associate a content file with a specific session.
- The `content` field is optional and can be used to store additional textual content related to the file.

For more detailed information about the implementation, please refer to the source code in `src/services/content-file.service.ts` and `src/routes/content-file.routes.ts`.