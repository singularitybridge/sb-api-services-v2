## Scytale Integration

- Located at @src/integrations/scytale for integration logic
- Reference @docs/integrations_framework for understanding the integrations framework
- Context item creation endpoint: `POST /context/scytale/controls/items`
- Supports flexible field structure with optional `id`
- Sample request includes:
  - `id`: Optional unique identifier (UUID)
  - `key`: Unique control key
  - `data`: Object with name and description
  - `metadata`: Additional categorization info
  - `tags`: Categorization tags