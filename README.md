# SB Agent Portal

SB Agent Portal is a powerful project designed to manage AI agents, enabling them to follow instructions, work with data using Retrieval-Augmented Generation (RAG), and perform actions through function calling.

## Project Overview

The SB Agent Portal provides a comprehensive suite of tools and services for creating, managing, and interacting with AI agents. These agents are capable of:

1. Following instructions via prompts
2. Working with data using RAG (Retrieval-Augmented Generation)
3. Performing actions through function calling

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

Each integration requires an API key, which can be managed through the Company settings. These integrations collectively enhance the capabilities of the AI agents, allowing them to perform a wide range of tasks across different domains and communication channels.

### Integration Structure

Each integration follows a standardized structure:

- `integration.config.json`: Contains metadata about the integration (name, icon, API key name, action creator function name).
- `index.ts`: Exports the action creator function and any other necessary exports.
- `<integration>.actions.ts`: Defines the actions for the integration.
- `<integration>.service.ts`: Contains the service logic that interacts with the external API.
- `translations/`: A folder containing translation files (en.json, he.json, etc.).

### Adding a New Integration

To add a new integration:

1. Create a new folder under `src/integrations/` with your integration name.
2. Create an `integration.config.json` file with the necessary metadata.
3. Implement the actions in `<integration>.actions.ts`.
4. Implement the service logic in `<integration>.service.ts`.
5. Add translations in the `translations/` folder.
6. Update the API key management service to handle the new integration's API key.

For more detailed instructions, please refer to our development documentation.

## Getting Started

To get started with the SB Agent Portal:

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up your environment variables
4. Run the project: `npm start`

For more detailed instructions, please refer to our development documentation.

## Contributing

We welcome contributions to the SB Agent Portal. Please read our contributing guidelines before submitting pull requests.

## License

This project is licensed under [INSERT LICENSE HERE]. Please see the LICENSE file for more details.