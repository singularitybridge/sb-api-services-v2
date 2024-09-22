import fs from 'fs';
import path from 'path';

const INTEGRATIONS_PATH = path.join(__dirname, 'src', 'integrations');

function validateIntegration(integrationPath: string): string[] {
  const errors: string[] = [];

  // Check for required files
  const requiredFiles = [
    'integration.config.json',
    `${path.basename(integrationPath)}.actions.ts`,
    `${path.basename(integrationPath)}.service.ts`,
    path.join('translations', 'en.json')
  ];

  requiredFiles.forEach(file => {
    if (!fs.existsSync(path.join(integrationPath, file))) {
      errors.push(`Missing required file: ${file}`);
    }
  });

  // Validate integration.config.json
  try {
    const config = JSON.parse(fs.readFileSync(path.join(integrationPath, 'integration.config.json'), 'utf-8'));
    const requiredFields = ['name', 'icon', 'apiKeyName', 'actionCreator', 'actionsFile'];
    requiredFields.forEach(field => {
      if (!config[field]) {
        errors.push(`Missing required field in integration.config.json: ${field}`);
      }
    });
  } catch (error) {
    errors.push(`Error parsing integration.config.json: ${error}`);
  }

  return errors;
}

function validateAllIntegrations(): void {
  const integrations = fs.readdirSync(INTEGRATIONS_PATH).filter(file => 
    fs.statSync(path.join(INTEGRATIONS_PATH, file)).isDirectory()
  );

  let hasErrors = false;

  integrations.forEach(integration => {
    const integrationPath = path.join(INTEGRATIONS_PATH, integration);
    const errors = validateIntegration(integrationPath);

    if (errors.length > 0) {
      console.error(`Errors in integration ${integration}:`);
      errors.forEach(error => console.error(`  - ${error}`));
      hasErrors = true;
    } else {
      console.log(`Integration ${integration} is valid.`);
    }
  });

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log('All integrations are valid.');
  }
}

validateAllIntegrations();