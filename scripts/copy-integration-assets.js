#!/usr/bin/env node

/**
 * Post-build script to copy non-TypeScript integration assets to dist folder
 *
 * TypeScript compiler only copies .ts files. This script ensures that:
 * - integration.config.json files are copied to dist
 * - translations/ folders are copied to dist
 *
 * This is critical for the discovery service and action loaders to function properly.
 */

const fs = require('fs');
const path = require('path');

const SRC_INTEGRATIONS = path.join(__dirname, '..', 'src', 'integrations');
const DIST_INTEGRATIONS = path.join(__dirname, '..', 'dist', 'integrations');

function copyFileSync(src, dest) {
  try {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    return true;
  } catch (error) {
    console.error(`Error copying ${src} to ${dest}:`, error.message);
    return false;
  }
}

function copyDirectorySync(src, dest) {
  try {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        copyDirectorySync(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
    return true;
  } catch (error) {
    console.error(`Error copying directory ${src} to ${dest}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔧 Copying integration assets to dist folder...\n');

  if (!fs.existsSync(SRC_INTEGRATIONS)) {
    console.error('❌ Source integrations folder not found:', SRC_INTEGRATIONS);
    process.exit(1);
  }

  if (!fs.existsSync(DIST_INTEGRATIONS)) {
    console.error('❌ Dist integrations folder not found:', DIST_INTEGRATIONS);
    console.error('   Run TypeScript build first: npm run build');
    process.exit(1);
  }

  const integrationFolders = fs.readdirSync(SRC_INTEGRATIONS, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  let configsCopied = 0;
  let translationsCopied = 0;
  let errors = 0;

  for (const integrationName of integrationFolders) {
    const srcIntegration = path.join(SRC_INTEGRATIONS, integrationName);
    const distIntegration = path.join(DIST_INTEGRATIONS, integrationName);

    // Ensure dist integration folder exists
    if (!fs.existsSync(distIntegration)) {
      console.log(`⚠️  No dist folder for ${integrationName} - skipping`);
      continue;
    }

    // Copy integration.config.json
    const configSrc = path.join(srcIntegration, 'integration.config.json');
    if (fs.existsSync(configSrc)) {
      const configDest = path.join(distIntegration, 'integration.config.json');
      if (copyFileSync(configSrc, configDest)) {
        configsCopied++;
        console.log(`✓ ${integrationName}/integration.config.json`);
      } else {
        errors++;
      }
    }

    // Copy translations/ folder
    const translationsSrc = path.join(srcIntegration, 'translations');
    if (fs.existsSync(translationsSrc) && fs.statSync(translationsSrc).isDirectory()) {
      const translationsDest = path.join(distIntegration, 'translations');
      if (copyDirectorySync(translationsSrc, translationsDest)) {
        translationsCopied++;
        console.log(`✓ ${integrationName}/translations/`);
      } else {
        errors++;
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   integration.config.json files copied: ${configsCopied}`);
  console.log(`   translations/ folders copied: ${translationsCopied}`);
  console.log(`   Errors: ${errors}`);

  if (errors > 0) {
    console.log('\n⚠️  Build completed with errors');
    process.exit(1);
  } else {
    console.log('\n✅ All integration assets copied successfully');
    process.exit(0);
  }
}

main();
