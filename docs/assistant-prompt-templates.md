# Applying Templates in Assistant Prompts

This document provides guidance on how to apply templates in assistant prompts effectively.

## Introduction

Templates in assistant prompts allow for dynamic and customizable interactions. They provide a way to insert variable content into predefined structures, making the assistant's responses more flexible and context-aware.

## Template Syntax

The template system supports the following syntax:

```
{{ variable.property }}
```

Where `variable` is one of the main context objects (user, company, or assistant), and `property` is a specific property of that object.

## Available Context Data

The following context data is available for use in templates:

```typescript
interface SessionContextData {
  user: {
    name: string;
    email: string;
    // Other user properties may be available
  };
  company: {
    name: string;
    // Other company properties may be available
  };
  assistant: {
    name: string;
    // Other assistant properties may be available
  };
}
```

## Examples

Here are some examples of how to use the templates:

1. Greeting a user by name:
   ```
   Hello {{ user.name }}, how can I assist you today?
   ```

2. Referencing the company name:
   ```
   Welcome to {{ company.name }}! How may I help you?
   ```

3. Using the assistant's name:
   ```
   My name is {{ assistant.name }}, and I'm here to help you with any questions about {{ company.name }}.
   ```

## Best Practices

1. **Use Correct Syntax**: Always use the double curly braces `{{ }}` for your placeholders.

2. **Check Available Properties**: Ensure you're only using properties that are available in the SessionContextData interface.

3. **Fallback Values**: Consider providing fallback text in case a property is not available:
   ```
   Hello {{ user.name || "valued customer" }},
   ```

4. **Test Thoroughly**: Always test your templates with various scenarios to ensure they work correctly.

5. **Keep It Simple**: While templates are powerful, avoid overcomplicating your prompts. Use templates where they add clear value to the interaction.

## Conclusion

By using these templates effectively, you can create more personalized and context-aware assistant prompts. Remember to stay within the bounds of the available context data, and always prioritize creating clear and helpful interactions for your users.