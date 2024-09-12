# SB API Services V2 Architecture Overview

## Introduction

This document provides an overview of the SB API Services V2 project architecture, focusing on the action factory system and its role in creating and managing assistants. This overview is intended for the architecture team to understand the current system design and to facilitate potential improvements.

## Action Factory System

The action factory system is a core component of the project, responsible for creating and managing various actions that can be performed by assistants. The system is designed using a functional programming approach, leveraging TypeScript and ES6 features.

### Key Components

1. **Function Factory (src/actions/factory.ts)**
   - Creates a collection of actions from various modules
   - Provides a unified interface for executing function calls

2. **Assistant Service (src/services/assistant.service.ts)**
   - Manages the creation, retrieval, and deletion of assistants
   - Handles session messages and interactions with OpenAI API

### How the Action Factory Works

1. **Creation of Function Factory**
   - The `createFunctionFactory` function in factory.ts combines actions from multiple modules into a single object.
   - Each module (e.g., inboxActions, assistantActions, calendarActions) contributes its specific actions to the factory.

2. **Execution of Function Calls**
   - The `executeFunctionCall` function in factory.ts is responsible for executing function calls.
   - It creates a function factory instance for each call, ensuring proper context.
   - Arguments are processed using a template service before execution.

3. **Integration with Assistant Service**
   - The assistant service uses the action factory indirectly through OpenAI's function calling mechanism.
   - When handling session messages, the assistant service creates runs that can utilize the functions provided by the action factory.

### Default Actions

The following action modules are included by default in the function factory:

- Inbox Actions
- Assistant Actions
- Calendar Actions
- JSONBin Actions
- Flux Image Actions
- Perplexity Actions
- SendGrid Actions
- ElevenLabs Actions
- OpenAI Actions
- PhotoRoom Actions
- MongoDB Actions
- Debug Actions
- Agenda Actions
- AI Agent Executor Actions
- Linear Actions
- Journal Actions

### Handling Updates

1. **Assistant Updates**
   - Assistants can be updated through the assistant service.
   - The `handleSessionMessage` function processes incoming messages and updates the assistant's state accordingly.

2. **Dynamic Action Processing**
   - The `pollRunStatus` function in the assistant service continuously checks the status of a run and handles any required actions.
   - If a run requires action (e.g., tool outputs), it's submitted using the `submitToolOutputs` function.

3. **Template Processing**
   - Messages and prompts are processed using a template service, allowing for dynamic content insertion.

## Creating a New Assistant

When creating a new assistant:

1. The `createDefaultAssistant` function in the assistant service is used to create a default assistant if one doesn't exist.
2. The assistant is first created in the local database (MongoDB).
3. An OpenAI assistant is then created using the OpenAI API.
4. The OpenAI assistant ID is stored with the local assistant record.

## Conclusion

The action factory system provides a flexible and extensible architecture for managing various actions that can be performed by AI assistants. It allows for easy addition of new action types and seamless integration with the OpenAI API. 

To improve the system, consider:
1. Implementing a plugin architecture for easier addition of new action types.
2. Enhancing error handling and logging for better debugging and monitoring.
3. Optimizing the performance of template processing for large-scale operations.
4. Implementing a caching mechanism for frequently used actions to reduce API calls.