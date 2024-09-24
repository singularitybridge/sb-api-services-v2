# Migrating an Existing Service to Plugin Architecture Playbook

This playbook provides a step-by-step guide on how to migrate an existing service to a plugin architecture. It's based on the experience of migrating the Linear integration and can be used as a template for future service migrations.

## Objective

To convert an existing service into a modular plugin that can be easily maintained, extended, and potentially used by third-party developers.

## Prerequisites

- Existing service code (typically in `src/services/` and `src/actions/`)
- Basic understanding of the current system architecture
- Familiarity with TypeScript and modular design patterns

## Migration Checklist

### 1. Preparation

- [ ] Identify all files related to the service (typically in `src/services/` and `src/actions/`)
- [ ] Review the current implementation and identify any dependencies on other parts of the system

### 2. Create Plugin Structure

- [ ] Create a new directory for the plugin in `src/integrations/<service-name>/`
- [ ] Move the main service file (e.g., `<service-name>.service.ts`) to the new directory
- [ ] Move the actions file (e.g., `<service-name>Actions.ts`) to the new directory and rename it to `<service-name>.actions.ts`
- [ ] Create an `index.ts` file in the new directory to expose the plugin's functionality

### 3. Update Service File

- [ ] Update import statements to reflect the new file structure
- [ ] Ensure all necessary functions are exported

### 4. Update Actions File

- [ ] Update import statements to reflect the new file structure
- [ ] Rename the main function to follow the pattern `create<ServiceName>Actions`
- [ ] Ensure all actions are properly exported

### 5. Create Plugin Index File

- [ ] Import necessary functions from the service and actions files
- [ ] Create and export an initialization function for the plugin (e.g., `initialize<ServiceName>Integration`)
- [ ] Define and export an interface for the plugin (e.g., `<ServiceName>Integration`)
- [ ] Re-export necessary types and functions from the service and actions files

### 6. Update Factory File

- [ ] Open `src/actions/factory.ts`
- [ ] Import the new plugin initialization function
- [ ] Replace the old action creation with the new plugin initialization in the `allActions` object

### 7. Update Action Discovery Service

- [ ] Open `src/services/action-discovery.service.ts`
- [ ] Add logic to discover actions from the new plugin structure
- [ ] Ensure the `getIconForService` method includes an icon for the new plugin

### 8. Remove Old Routes (if applicable)

- [ ] Delete the old routes file (e.g., `src/routes/<service-name>.routes.ts`)
- [ ] Remove any references to the deleted routes file from `src/index.ts`

### 9. Create Configuration Files

- [ ] Create a `<service-name>.config.json` file in the plugin directory for any necessary configuration
- [ ] Create a `README.md` file in the plugin directory with usage instructions and any other relevant information

### 10. Update Translations (if applicable)

- [ ] Update any translation files to reflect the new plugin structure and naming conventions

### 11. Testing

- [ ] Run the build process (`npm run build`) to check for any compilation errors
- [ ] Update any existing tests to work with the new plugin structure
- [ ] Create new tests for the plugin functionality if necessary

### 12. Documentation

- [ ] Update any existing documentation to reflect the new plugin structure
- [ ] Create or update API documentation for the plugin

## Best Practices

1. Follow a consistent naming convention across all plugins
2. Keep the plugin interface simple and focused
3. Use TypeScript for better type checking and developer experience
4. Minimize dependencies on other parts of the system to keep the plugin modular
5. Provide clear documentation on how to use and extend the plugin

## Example: Linear Integration Migration

Here's a brief overview of how we migrated the Linear integration:

1. Created `src/integrations/linear/` directory
2. Moved `linear.service.ts` and renamed `linearActions.ts` to `linear.actions.ts`
3. Created `index.ts` to expose the plugin functionality
4. Updated import statements in all moved files
5. Created `linear.config.json` for configuration
6. Created `README.md` with usage instructions
7. Updated `src/actions/factory.ts` to use the new plugin
8. Updated `src/services/action-discovery.service.ts` to discover plugin actions
9. Removed `src/routes/linear.routes.ts` and its reference in `src/index.ts`
10. Ran the build process and fixed any errors

By following this playbook, you can successfully migrate existing services to a plugin architecture, improving modularity and maintainability of your system.