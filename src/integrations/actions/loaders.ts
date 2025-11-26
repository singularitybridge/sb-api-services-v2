import { join } from 'path';
import { FunctionFactory, ActionContext } from './types';
import {
  getIntegrationFolders,
  loadConfig,
  createPrefixedActions,
  filterAllowedActions,
} from './utils';

const loadActionModule = async (
  actionFilePath: string,
  config: Record<string, unknown>,
  context: ActionContext,
): Promise<FunctionFactory> => {
  try {
    const module = await import(actionFilePath);
    const actionCreator = module[config.actionCreator as string];

    if (typeof actionCreator === 'function') {
      try {
        // Wrap the action creator call in a separate try-catch
        // to handle errors during initialization (e.g., missing API keys)
        const factory = actionCreator(context) as FunctionFactory;
        return factory || {};
      } catch (initError) {
        console.error(
          `Failed to initialize actions in ${actionFilePath}:`,
          initError,
        );
        console.error(
          `Integration ${
            config.name || 'unknown'
          } will be skipped due to initialization error`,
        );
        return {};
      }
    } else {
      console.log(`No valid action creator found in ${actionFilePath}`);
      return {};
    }
  } catch (error) {
    console.error(`Failed to import module ${actionFilePath}:`, error);
    return {};
  }
};

const processIntegrationFolder = async (
  folder: string,
  integrationsPath: string,
  context: ActionContext,
): Promise<FunctionFactory> => {
  try {
    const integrationPath = join(integrationsPath, folder);
    const configFilePath = join(integrationPath, 'integration.config.json');
    const config = loadConfig(configFilePath);

    if (!config) return {};

    let actionFilePath = join(
      integrationPath,
      (config.actionsFile as string) || `${folder}.actions.ts`,
    );
    // Convert .ts to .js for runtime (compiled code)
    actionFilePath = actionFilePath.replace(/\.ts$/, '.js');

    const actionObj = await loadActionModule(actionFilePath, config, context);
    const integrationName = (config.name as string) || folder;

    return createPrefixedActions(actionObj, integrationName);
  } catch (error) {
    console.error(`Failed to process integration folder ${folder}:`, error);
    return {};
  }
};

export const createFunctionFactory = async (
  context: ActionContext,
  allowedActions: string[],
): Promise<FunctionFactory> => {
  const integrationsPath = join(__dirname, '..');
  const integrationFolders = getIntegrationFolders(integrationsPath);

  const allActionPromises = integrationFolders.map((folder) =>
    processIntegrationFolder(folder, integrationsPath, context),
  );
  const allActionResults = await Promise.all(allActionPromises);

  const allActions = allActionResults.reduce(
    (acc, actions) => ({ ...acc, ...actions }),
    {},
  );
  return filterAllowedActions(allActions, allowedActions);
};
