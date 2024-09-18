# SB Agent Portal

SB Agent Portal is a powerful project designed to manage AI agents, enabling them to follow instructions, work with data using Retrieval-Augmented Generation (RAG), and perform actions through function calling.

## Project Overview

The SB Agent Portal provides a comprehensive suite of tools and services for creating, managing, and interacting with AI agents. These agents are capable of:

1. Following instructions via prompts
2. Working with data using RAG (Retrieval-Augmented Generation)
3. Performing actions through function calling

This system is built with a microservices architecture, utilizing TypeScript and modern JavaScript (ES6+) practices, with a preference for functional programming over object-oriented programming.

## Available Services

The project includes various services to support different functionalities:

1. Assistant Service
2. Action Service
3. File Service
4. Inbox Service
5. Journal Service
6. Session Service
7. User Service
8. Company Service
9. Onboarding Service
10. Verification Service
11. Encryption Service
12. Template Service
13. Token Service
14. Pusher Service
15. MongoDB Query Service
16. Google Calendar Service
17. Google Storage Service
18. Google TTS Service
19. OpenAI Services (Completion, Speech, Thread, Assistant)
20. Eleven Labs Service
21. Perplexity Service
22. PhotoRoom Service
23. SendGrid Service
24. Flux Image Service
25. JSONbin Service
26. Telegram Bot Service
27. Twilio Voice Service
28. Linear Service
29. Content Service

## Routes

The project includes various routes for different functionalities:

1. Action Routes
2. Agenda Routes
3. Assistant Routes
4. Auth Routes
5. Company Routes
6. File Routes
7. Flux Image Routes
8. Inbox Routes
9. Journal Routes
10. JSONbin Routes
11. Onboarding Routes
12. Perplexity Routes
13. PhotoRoom Routes
14. Policy Routes
15. SendGrid Routes
16. Session Routes
17. Speech-to-Text (STT) Routes
18. Text-to-Speech (TTS) Routes
19. User Routes
20. Verification Routes
21. Omni-channel Routes (Telegram, Twilio Messaging, Twilio Voice, WhatsApp)
22. Linear Routes
23. Content Routes

## Actions

The project supports various actions, including:

### Agenda Actions
Manages scheduling and task management functionalities for AI agents.
Available methods:
createAgendaItem(item)
updateAgendaItem(id, updates)

### AI Agent Executor Actions
Coordinates the execution of AI agent tasks and manages their lifecycle.
Available methods:
executeAgentTask(agentId, task)
terminateAgentExecution(executionId)

### Assistant Actions
Handles interactions with AI assistants, including creation and management.
Available methods:
createAssistant(config)
getAssistantResponse(assistantId, prompt)

### Calendar Actions
Manages calendar-related operations, including event creation and retrieval.
Available methods:
createEvent(eventDetails)
getEvents(timeRange)

### Debug Actions
Provides debugging and logging functionalities for troubleshooting.
Available methods:
logDebugInfo(message)
captureErrorState(error)

### Eleven Labs Actions
Interacts with Eleven Labs API for text-to-speech and voice-related tasks.
Available methods:
generateSpeech(text, voiceId)
listAvailableVoices()

### Flux Image Actions
Handles image processing and manipulation tasks.
Available methods:
processImage(imageUrl, operations)
generateImage(prompt)

### Inbox Actions
Manages message inboxes for users or AI agents.
Available methods:
sendMessage(recipientId, message)
getInboxMessages(userId)

### Journal Actions
Manages journal entries for users or AI agents.
Available methods:
createJournalEntry(journalData, apiKey, channel)
getJournalEntries(userId, companyId, sessionId, entryType, tags)
updateJournalEntry(journalId, updateData)
deleteJournalEntry(journalId)

### JSONbin Actions
Interacts with JSONbin for storing and retrieving JSON data.
Available methods:
createBin(data)
readBin(binId)

### MongoDB Actions
Performs database operations on MongoDB.
Available methods:
insertDocument(collection, document)
queryDocuments(collection, query)

### OpenAI Actions
Interacts with OpenAI API for various AI-related tasks.
Available methods:
generateCompletion(prompt)
createEmbedding(text)

### Perplexity Actions
Handles interactions with Perplexity API for advanced language understanding.
Available methods:
analyzeText(text)
generateResponse(query)

### PhotoRoom Actions
Manages image editing and background removal tasks using PhotoRoom API.
Available methods:
removeBackground(imageUrl)
editImage(imageUrl, edits)

### SendGrid Actions
Handles email operations using SendGrid API.
Available methods:
sendEmail(to, subject, content)
createEmailTemplate(template)

### Linear Actions
Manages issues and projects using Linear API.
Available methods:
fetchIssues()
createIssue(title, description, teamId)
updateIssue(issueId, updateData)
deleteIssue(issueId)
fetchAllIssues()

### Content Actions
Manages content items for companies.
Available methods:
createContentItem(title, contentType, content, metadata, tags)
getContentItems()
updateContentItem(itemId, updateData)
deleteContentItem(itemId)

## Integrations

The SB Agent Portal integrates with various third-party services. The following integrations are supported:

1. OpenAI: Used for natural language processing, text generation, and AI model interactions. It powers the core AI capabilities of the agents, enabling them to understand and generate human-like text, and perform various AI tasks.

2. Eleven Labs: Provides advanced text-to-speech capabilities. It's used to generate natural-sounding voice outputs for the AI agents, enhancing the conversational experience.

3. Google: Utilized for various services including calendar management, cloud storage, and text-to-speech. It enables agents to interact with users' calendars, store and retrieve files, and generate speech from text.

4. Twilio: Enables multi-channel communication capabilities. It's used for sending SMS, making voice calls, and potentially for WhatsApp integration, allowing agents to communicate through various channels.

5. JSONbin: Provides a simple JSON storage service. It's used for storing and retrieving structured data that agents might need to access or update during their operations.

6. GetImg: An image generation service. It allows agents to create or modify images based on text descriptions or other parameters, enhancing their visual output capabilities.

7. Perplexity: Offers advanced language understanding and generation. It's used to improve the agents' ability to comprehend complex queries and generate more contextually relevant responses.

8. SendGrid: An email delivery service. It's utilized for sending emails, which can be useful for notifications, reports, or any email-based communication the agents need to perform.

9. PhotoRoom: Provides image editing and background removal services. It's used to manipulate images, which can be helpful for tasks involving visual content creation or editing.

10. Telegram Bot: Enables interaction through Telegram. It allows agents to communicate with users via Telegram, expanding the range of platforms through which they can interact.

11. Linear: Project management and issue tracking service. It's used to manage tasks, issues, and projects, allowing agents to interact with and update project management data.

Each integration requires an API key, which can be managed through the Company settings. These integrations collectively enhance the capabilities of the AI agents, allowing them to perform a wide range of tasks across different domains and communication channels.

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