# Notion Integration

This document provides an overview of the Notion integration in the SB Agent Portal.

## Overview

The Notion integration allows AI agents to interact with Notion workspaces, enabling them to:

- Retrieve items from Notion databases
- Create new pages in databases or as children of other pages
- Update existing pages
- Search for content across the Notion workspace

## Setup

To use the Notion integration, you need to set up a Notion API key:

1. Go to [Notion Developers](https://developers.notion.com/) and create a new integration
2. Copy the API key
3. Add the API key to your Company settings with the key name `NOTION_API_KEY`

## Available Actions

### getDatabaseItems

Retrieves items from a specified Notion database.

**Parameters:**
- `databaseId` (string, required): The ID of the Notion database
- `filter` (object, optional): Filter to apply to the database query
- `sorts` (array, optional): Sort configurations for the database query

**Example:**
```json
{
  "databaseId": "your-database-id",
  "filter": {
    "property": "Status",
    "status": {
      "equals": "Done"
    }
  },
  "sorts": [
    {
      "property": "Created",
      "direction": "descending"
    }
  ]
}
```

### createNotionPage

Creates a new page in Notion, either in a database or as a child of another page.

**Parameters:**
- `parentId` (string, required): The ID of the parent (database or page)
- `parentType` (string, required): The type of parent (`database_id` or `page_id`)
- `properties` (object, required): The properties of the page to create
- `children` (array, optional): Content blocks for the page

**Example for database page:**
```json
{
  "parentId": "your-database-id",
  "parentType": "database_id",
  "properties": {
    "Name": {
      "title": [
        {
          "text": {
            "content": "New task"
          }
        }
      ]
    },
    "Status": {
      "select": {
        "name": "In Progress"
      }
    }
  }
}
```

**Example for child page:**
```json
{
  "parentId": "your-page-id",
  "parentType": "page_id",
  "properties": {
    "title": [
      {
        "text": {
          "content": "New child page"
        }
      }
    ]
  },
  "children": [
    {
      "object": "block",
      "type": "paragraph",
      "paragraph": {
        "rich_text": [
          {
            "type": "text",
            "text": {
              "content": "This is a new page created via the API"
            }
          }
        ]
      }
    }
  ]
}
```

### updateNotionPage

Updates an existing page in Notion.

**Parameters:**
- `pageId` (string, required): The ID of the page to update
- `properties` (object, required): The properties to update on the page

**Example:**
```json
{
  "pageId": "your-page-id",
  "properties": {
    "Status": {
      "select": {
        "name": "Done"
      }
    }
  }
}
```

### searchNotion

Searches for content across the Notion workspace.

**Parameters:**
- `query` (string, required): The search query
- `searchParams` (object, optional): Additional search parameters

**Example:**
```json
{
  "query": "project plan",
  "searchParams": {
    "filter": {
      "value": "page",
      "property": "object"
    },
    "sort": {
      "direction": "ascending",
      "timestamp": "last_edited_time"
    }
  }
}
```

## Type Definitions

The Notion integration uses the following TypeScript interfaces:

```typescript
interface GetDatabaseItemsArgs {
  databaseId: string;
  filter?: Record<string, any>;
  sorts?: Record<string, any>[];
}

interface CreatePageArgs {
  parentId: string;
  parentType: 'database_id' | 'page_id';
  properties: Record<string, any>;
  children?: Record<string, any>[];
}

interface UpdatePageArgs {
  pageId: string;
  properties: Record<string, any>;
}

interface SearchNotionArgs {
  query: string;
  searchParams?: Record<string, any>;
}
```

## Error Handling

All functions in the Notion integration return a response with the following structure:

```typescript
{
  success: boolean;
  data?: any;
}
```

If an error occurs, the function will throw an error with a message describing the issue.

## Implementation Details

The Notion integration is implemented using the official Notion JavaScript SDK (`@notionhq/client`). The integration handles authentication, request formatting, and response parsing to provide a simple interface for interacting with Notion.

For more information about the Notion API, refer to the [official Notion API documentation](https://developers.notion.com/reference/intro).
