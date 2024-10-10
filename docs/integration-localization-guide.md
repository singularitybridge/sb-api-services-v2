# Integration Localization Guide

This guide provides detailed instructions on how to properly localize your integration, ensuring that it can be easily translated into different languages.

## 1. Translation File Structure

### 1.1 File Organization

Create a `translations` folder in your integration directory and add language-specific JSON files:

```
your_integration/
└── translations/
    ├── en.json
    └── he.json
```

### 1.2 File Naming

Use standard language codes for file names:
- `en.json` for English
- `he.json` for Hebrew
- Add other languages as needed (e.g., `fr.json` for French)

## 2. Translation File Content

### 2.1 Basic Structure

Use the following structure for your translation files:

```json
{
  "serviceName": "Your Integration Name",
  "serviceDescription": "A brief description of your integration",
  "actionName1": {
    "name": "Action Name",
    "description": "Description of what this action does"
  },
  "actionName2": {
    "name": "Another Action Name",
    "description": "Description of what this action does"
  }
}
```

### 2.2 Key Guidelines

1. Ensure that the `serviceName` and `serviceDescription` keys are present in all translation files.
2. For each action in your `your_integration.actions.ts` file, create a corresponding entry in the translation files.
3. Use the exact action names as keys in the translation file (e.g., "scanCodeProject", "queryRelevantFiles").
4. Include both a "name" and "description" for each action.
5. Maintain consistency in terminology across different languages.
6. Consider cultural context when translating to ensure appropriateness.

## 3. Example Translation File

Here's an example of a properly structured `en.json` file:

```json
{
  "serviceName": "Code Indexer",
  "serviceDescription": "Scan, index, and interact with code repositories",
  "scanCodeProject": {
    "name": "Scan Code Project",
    "description": "Scan a code project directory and index file summaries"
  },
  "queryRelevantFiles": {
    "name": "Query Relevant Files",
    "description": "Query indexed files relevant to a task"
  }
}
```

## 4. Applying Translations

The discovery service automatically applies translations when loading the integration. You don't need to manually apply translations in your action files.

## 5. Updating Translations

When adding new actions or modifying existing ones:

1. Update all language files simultaneously to maintain consistency.
2. Ensure new actions are added to all language files, even if initially only in English.
3. Consider using placeholder text (e.g., "NEEDS TRANSLATION") for new entries in non-English files to easily identify untranslated content.

## 6. Troubleshooting Localization Issues

If you encounter issues with localization:

1. Ensure translation files are named correctly and placed in the `translations` folder.
2. Verify that keys in translation files match exactly with action names in `your_integration.actions.ts`.
3. Check that you're requesting the correct language when calling the API (e.g., `?language=he` for Hebrew).
4. If only some translations are missing, compare the structure of your translation files with the actions defined in your integration.
5. Remember that changes to translation files only take effect when the integration is reloaded or the server is restarted.
6. Use logging or debugging tools to verify which translation file is being loaded and used.

## 7. Best Practices

1. Keep translations concise and clear to maintain readability across all languages.
2. Regularly review and update translations to ensure they remain accurate and relevant.
3. Consider using professional translation services for critical or customer-facing content.
4. Implement a review process for translations, especially for languages not spoken by the development team.

By following these guidelines, you'll ensure that your integration can be easily localized and that fixing localization issues in the future will be straightforward.
