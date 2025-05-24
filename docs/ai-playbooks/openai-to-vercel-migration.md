# OpenAI to Vercel AI Migration Guide

## Overview
This document outlines the migration from OpenAI Assistant API to Vercel AI for action calling and assistant management.

## Issue Fixed
**Error**: "Unsupported value: 'reasoning_effort' does not support 'high' with this model"

**Root Cause**: The `allowed-actions.service.ts` was still trying to update OpenAI assistants even though we've migrated to Vercel AI.

**Fix Applied**: 
- Removed OpenAI assistant update call from `src/services/allowed-actions.service.ts`
- The service now only updates the local database

## Remaining OpenAI Dependencies

### 1. File Service (`src/services/file.service.ts`)
**Current State**: Still heavily dependent on OpenAI for file operations
- Uploads files to OpenAI
- Creates and manages vector stores
- Updates assistants with file_search tool

**Recommendation**: 
- Option 1: Disable file upload functionality temporarily
- Option 2: Migrate to a local file storage solution (e.g., MinIO) with a custom vector search implementation
- Option 3: Keep OpenAI for file/vector operations only (hybrid approach)

### 2. Run Management Service (`src/services/assistant/run-management.service.ts`)
**Current State**: Uses OpenAI threads API for run steps
- Retrieves run steps
- Checks file tool usage

**Recommendation**: This service might be deprecated if you're using Vercel AI for conversation management

### 3. OpenAI Assistant Service (`src/services/oai.assistant.service.ts`)
**Current State**: Contains all OpenAI assistant CRUD operations
**Recommendation**: Keep for reference but mark as deprecated

## Migration Checklist

- [x] Fix allowed actions update error
- [ ] Decide on file upload strategy
- [ ] Remove/update file service if needed
- [ ] Clean up run management service
- [ ] Mark oai.assistant.service.ts as deprecated
- [ ] Update file routes to handle new file strategy
- [ ] Test all assistant operations with Vercel AI

## Code Locations Already Migrated

1. **assistant-management.service.ts** - Comments indicate OpenAI is deprecated
2. **put.routes.ts** - Comments about OpenAI sync being removed
3. **allowed-actions.service.ts** - Now fixed to skip OpenAI updates

## Testing Recommendations

1. Test assistant creation without OpenAI
2. Test allowed actions updates
3. Test file upload functionality (if keeping)
4. Verify Vercel AI handles all action calls properly

## Notes
- The error was specifically related to the `reasoning_effort` parameter which is only supported by O3 models
- The system was trying to pass this parameter to "gpt-4.1-mini" which doesn't support it
- This migration is part of a larger architectural change from OpenAI's assistant API to Vercel AI
