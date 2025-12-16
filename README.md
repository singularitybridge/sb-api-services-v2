# SB Agent Portal

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

SB Agent Portal is a powerful project designed to manage AI agents, enabling them to follow instructions, work with data using Retrieval-Augmented Generation (RAG), and perform actions through function calling.

## Project Overview

The SB Agent Portal provides a comprehensive suite of tools and services for creating, managing, and interacting with AI agents. These agents are capable of:

1. Following instructions via prompts
2. Working with data using RAG (Retrieval-Augmented Generation)
3. Performing actions through function calling
4. Conducting vector searches on content items

This system is built with a microservices architecture, utilizing TypeScript and modern JavaScript (ES6+) practices, with a preference for functional programming over object-oriented programming.

## Developer Documentation

For detailed information on the internal workings, particularly regarding the creation and execution of actions and integrations, please refer to the:

-   **[Integrations Framework Documentation](./docs/integrations_framework/README.md)**

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
10. Linear
11. Code Indexer
12. JIRA
13. **Nylas** (Email, Calendar, Contacts)

Each integration requires an API key, which can be managed through the Company settings. These integrations collectively enhance the capabilities of the AI agents, allowing them to perform a wide range of tasks across different domains and communication channels.

### Code Indexer Integration

The Code Indexer integration allows AI agents to scan, index, and interact with code repositories. It provides the following capabilities:

- Scan code projects and create summaries of code files
- Query relevant files based on task descriptions
- Retrieve and edit file contents

This integration is particularly useful for tasks involving code analysis, refactoring, and development assistance.

### JIRA Integration

The JIRA integration enables AI agents to interact with JIRA projects and tickets. It provides the following capabilities:

- Create new JIRA tickets with customizable fields
- Fetch tickets from specific JIRA projects
- Retrieve detailed information about individual tickets

To configure the JIRA integration, you need to set up the following API keys in your Company settings:

- `jira_api_token`: Your JIRA API token
- `jira_domain`: Your JIRA domain (e.g., 'your-company' for 'your-company.atlassian.net')
- `jira_email`: The email address associated with your JIRA account

You can obtain these credentials from your JIRA account settings and API tokens page.

### Nylas Integration

The Nylas integration provides comprehensive email, calendar, and contacts management through the Nylas V3 API. This integration supports per-user grant management, enabling AI agents to access and manage email/calendar/contacts for individual team members.

#### Features

**Email Operations:**
- Get emails from user's inbox
- Get specific email by ID
- Send emails on behalf of users

**Calendar Operations:**
- List calendar events within time ranges
- Create, update, and delete calendar events
- Find available time slots
- Check free/busy status
- Detect scheduling conflicts
- Batch create multiple events
- Move events to new time slots
- **Admin Calendar Creation**: Administrators can create events directly in team members' calendars

**Contacts Operations:**
- Retrieve contacts from user's address book
- Create new contacts
- Update existing contacts

**Grant Management (Admin-only):**
- Check grant status for users
- List all company grants
- Send OAuth invitations to new users
- Revoke user grants

#### Configuration

**V3 Microservice URL:**
The integration uses a V3 microservice proxy deployed on Google Cloud Platform:
```env
NYLAS_V3_SERVICE_URL=https://sb-api-services-v3-53926697384.us-central1.run.app
```

**Company Default Grant (Optional):**
Set a company-wide default grant in Company settings:
- API Key: `nylas_grant_id`
- Value: Your company's Nylas grant ID

**SendGrid Configuration (for invitations):**
```env
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourcompany.com
```

#### Per-User Grant System

The integration supports per-user grants, allowing each team member to connect their own email/calendar/contacts:

1. **Grant Resolution Chain:**
   - User-specific grant (if userEmail provided)
   - Company default grant
   - V3 microservice default

2. **User Onboarding:**
   - Admin sends invitation via `nylasSendInvitation` action
   - User receives email with OAuth link
   - User authorizes Google/Outlook account
   - Grant automatically linked to user's account

3. **Admin Calendar Control:**
   Administrators can create events in team members' calendars:
   ```
   "Create meeting 'Daily Standup' for user john@company.com tomorrow at 9am"
   ```
   This creates the event directly in John's calendar without requiring invitation acceptance.

#### Available Actions

**20 Nylas Actions Total:**
- Email: `nylasGetEmails`, `nylasGetEmail`, `nylasSendEmail`
- Calendar: `nylasGetCalendarEvents`, `nylasCreateCalendarEvent`, `nylasGetEvent`, `nylasUpdateEvent`, `nylasDeleteEvent`, `nylasFindAvailableSlots`, `nylasGetFreeBusy`, `nylasCheckConflicts`, `nylasBatchCreateEvents`, `nylasMoveEvent`
- Contacts: `nylasGetContacts`, `nylasCreateContact`, `nylasUpdateContact`
- Grant Management: `nylasCheckGrantStatus`, `nylasListCompanyGrants`, `nylasSendInvitation`, `nylasRevokeGrant`

#### Documentation

For detailed testing and integration information, see:
- [Test Data Examples](./docs/TEST_DATA_EXAMPLES.md)
- [Test Scenarios](./docs/TEST_SCENARIOS.md)
- [V3 Integration Testing](./docs/V3_INTEGRATION_TEST.md)
- [Grant Management Implementation](./docs/GRANT_MANAGEMENT_IMPLEMENTATION.md)
- [Admin Calendar Creation Guide](./docs/ADMIN_CALENDAR_CREATION_GUIDE.md)

### Vector Search Functionality

The SB Agent Portal now includes vector search capabilities for content items. This feature allows for more efficient and accurate searching based on semantic similarity. Key aspects of this functionality include:

- Generation of embeddings for content items using OpenAI's text-embedding-ada-002 model
- Storage of embeddings alongside content items in the database
- Ability to perform vector similarity searches on content items

### Teams Functionality

The SB Agent Portal includes a Teams feature that allows you to organize AI assistants into logical groups. Each team can have multiple assistants, and each assistant can belong to multiple teams. Key aspects of this functionality include:

- Creation and management of teams with name, description, and optional icon
- Assignment of assistants to one or more teams
- Filtering assistants by team membership
- Company-specific team management

For more detailed information about the Teams feature, please refer to the [Teams Feature Documentation](docs/teams-feature.md).

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

We welcome contributions to the SB Agent Portal! Here's how you can contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -am 'Add some feature'`)
6. Push to the branch (`git push origin feature/your-feature-name`)
7. Create a Pull Request

Please make sure to:
- Follow the existing code style
- Write clear commit messages
- Include tests for new functionality
- Update documentation as needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
