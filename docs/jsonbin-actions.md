# JSONBin Actions Documentation

This document provides information about the available JSONBin actions and their parameters.

## Available Actions

1. [createJSONBinFile](#createjsonbinfile)
2. [updateJSONBinFile](#updatejsonbinfile)
3. [readJSONBinFile](#readjsonbinfile)

## createJSONBinFile

Creates a new file in JSONBin.

### Parameters

- `data` (required): 
  - Type: object
  - Description: The data to write to the new file, must be a valid JSON object

- `name` (required):
  - Type: string
  - Description: Name for the bin (1-128 characters), English letters, numbers, and underscores only

### Validation

- `data` must be a valid JSON object (not an array or primitive value)
- `name` must be a string between 1 and 128 characters long
- No additional properties are allowed

### Example

```javascript
{
  "data": {
    "key": "value",
    "number": 42
  },
  "name": "my_json_file"
}
```

## updateJSONBinFile

Updates an existing file in JSONBin.

### Parameters

- `binId` (required):
  - Type: string
  - Description: The ID of the file to update

- `data` (required):
  - Type: object
  - Description: The new data to write to the file, always replaces the entire JSON content

### Validation

- `binId` must be a string
- `data` must be a valid JSON object (not an array or primitive value)
- No additional properties are allowed

### Example

```javascript
{
  "binId": "6012c8d65fd8266c1559afe0",
  "data": {
    "updatedKey": "newValue",
    "newNumber": 100
  }
}
```

## readJSONBinFile

Reads a file from JSONBin.

### Parameters

- `binId` (required):
  - Type: string
  - Description: The ID of the file to read

### Validation

- `binId` must be a string
- No additional properties are allowed

### Example

```javascript
{
  "binId": "6012c8d65fd8266c1559afe0"
}
```

## Notes

- All actions are performed in the context of the company ID associated with the current session.
- Error handling is implemented for all actions, providing detailed error messages for invalid inputs or failed operations.
- The createJSONBinFile and updateJSONBinFile actions perform strict validation on the input data to ensure it's a valid JSON object.