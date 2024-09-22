# PhotoRoom Integration

This integration allows users to remove backgrounds from images using the PhotoRoom API.

## Files

1. `integration.config.json`: Configuration file for the PhotoRoom integration.
   - Defines the integration name, icon, API key name, and action creator.

2. `photoroom.actions.ts`: Contains the action definitions for the PhotoRoom integration.
   - Defines the `removeBackground` action, which processes an image URL to remove its background.

3. `photoroom.service.ts`: Implements the service that interacts with the PhotoRoom API.
   - Contains the `removeBackgroundFromImage` function that makes the actual API call to PhotoRoom.

4. `translations/en.json`: Contains English translations for the integration's action names and descriptions.

## Usage

To use this integration, ensure that a valid PhotoRoom API key is set in the company's configuration with the key name "photoroom_api_key".

The main action provided by this integration is:

- `removeBackground`: Removes the background from an image specified by a URL.

### Example usage:

```javascript
const result = await executeFunction('photoroom.removeBackground', {
  imageUrl: 'https://example.com/image.jpg'
});
```

## Requirements

- A valid PhotoRoom API key is required to use this integration.
- The integration expects image URLs to be publicly accessible.

## Error Handling

The integration includes error handling for:
- Missing or invalid parameters
- Invalid image URLs
- API communication errors

Any errors encountered during the background removal process will be logged and returned in the action's response.

## Assumptions

- The PhotoRoom API is assumed to be available and functioning.
- The company's API key management system is expected to provide the correct API key when requested.

For any issues or feature requests related to this integration, please contact the development team.