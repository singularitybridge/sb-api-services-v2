# SB Agent Portal

SB Agent Portal is a powerful project designed to manage AI agents, enabling them to follow instructions, work with data using Retrieval-Augmented Generation (RAG), and perform actions through function calling.

## Project Overview

The SB Agent Portal provides a comprehensive suite of tools and services for creating, managing, and interacting with AI agents. These agents are capable of:

1. Following instructions via prompts
2. Working with data using RAG (Retrieval-Augmented Generation)
3. Performing actions through function calling
4. Conducting vector searches on content items

This system is built with a microservices architecture, utilizing TypeScript and modern JavaScript (ES6+) practices, with a preference for functional programming over object-oriented programming.

## Available Services

[... existing services content ...]

## Routes

[... existing routes content ...]

## Actions

[... existing actions content ...]

## Integrations

The SB Agent Portal integrates with various third-party services. The following integrations are supported:

1. OpenAI
2. Eleven Labs
3. Google
4. Twilio
5. JSONbin
6. GetImg
7. Perplexity
8. SendGrid
9. PhotoRoom
10. Telegram Bot
11. Linear
12. Code Indexer

Each integration requires an API key, which can be managed through the Company settings. These integrations collectively enhance the capabilities of the AI agents, allowing them to perform a wide range of tasks across different domains and communication channels.

### Code Indexer Integration

The Code Indexer integration allows AI agents to scan, index, and interact with code repositories. It provides the following capabilities:

- Scan code projects and create summaries of code files
- Query relevant files based on task descriptions
- Retrieve and edit file contents

This integration is particularly useful for tasks involving code analysis, refactoring, and development assistance.

### Vector Search Functionality

The SB Agent Portal now includes vector search capabilities for content items. This feature allows for more efficient and accurate searching based on semantic similarity. Key aspects of this functionality include:

- Generation of embeddings for content items using OpenAI's text-embedding-ada-002 model
- Storage of embeddings alongside content items in the database
- Ability to perform vector similarity searches on content items

## Getting Started

To get started with the SB Agent Portal:

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up your environment variables (including OPENAI_API_KEY for vector search functionality)
4. Run the project: `npm start`
5. Set up the vector search index (see below)

### Setting up the Vector Search Index

To enable vector search functionality, you need to create a vector search index in your MongoDB Atlas database. Follow these steps:

1. Ensure your MongoDB Atlas cluster is running version 6.0 or later
2. Set the MONGODB_URI environment variable with your MongoDB connection string
3. Run the createSearchIndex script:

```bash
npm run create-search-index
```

This script will create the necessary index for vector searching on your content items collection.

### Configuring OpenAI API Key

To use the vector search functionality, you need to set up your OpenAI API key:

1. Obtain an API key from OpenAI (https://platform.openai.com/)
2. Set the OPENAI_API_KEY environment variable with your API key

```bash
export OPENAI_API_KEY=your_api_key_here
```

Ensure this environment variable is set in your production environment as well.

For more detailed instructions, please refer to our development documentation.

## Contributing

We welcome contributions to the SB Agent Portal. Please read our contributing guidelines before submitting pull requests.

## License

This project is licensed under [INSERT LICENSE HERE]. Please see the LICENSE file for more details.