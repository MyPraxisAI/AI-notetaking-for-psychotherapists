import 'server-only';

import { envVariables } from '@/app/variables/lib/env-variables-model';
import fs from 'fs/promises';
import path from 'path';

import {
  AppEnvState,
  EnvFileInfo,
  EnvMode,
  EnvVariableState,
  ScanOptions,
} from './types';

// Define precedence order for each mode
const ENV_FILE_PRECEDENCE: Record<EnvMode, string[]> = {
  development: [
    '.env',
    '.env.development',
    '.env.local',
    '.env.development.local',
  ],
  production: [
    '.env',
    '.env.production',
    '.env.local',
    '.env.production.local',
  ],
};

function getSourcePrecedence(source: string, mode: EnvMode): number {
  return ENV_FILE_PRECEDENCE[mode].indexOf(source);
}

export async function scanMonorepoEnv(
  options: ScanOptions,
): Promise<EnvFileInfo[]> {
  const {
    rootDir = path.resolve(process.cwd(), '../..'),
    apps = ['web'],
    mode,
  } = options;

  const envTypes = ENV_FILE_PRECEDENCE[mode];
  const appsDir = path.join(rootDir, 'apps');
  const results: EnvFileInfo[] = [];

  try {
    const appDirs = await fs.readdir(appsDir);

    for (const appName of appDirs) {
      if (apps.length > 0 && !apps.includes(appName)) {
        continue;
      }

      const appDir = path.join(appsDir, appName);
      const stat = await fs.stat(appDir);

      if (!stat.isDirectory()) {
        continue;
      }

      const appInfo: EnvFileInfo = {
        appName,
        filePath: appDir,
        variables: [],
      };

      for (const envType of envTypes) {
        const envPath = path.join(appDir, envType);

        try {
          const content = await fs.readFile(envPath, 'utf-8');
          const vars = parseEnvFile(content, envType);

          appInfo.variables.push(...vars);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.warn(`Error reading ${envPath}:`, error);
          }
        }
      }

      if (appInfo.variables.length > 0) {
        results.push(appInfo);
      }
    }
  } catch (error) {
    console.error('Error scanning monorepo:', error);
    throw error;
  }

  return results;
}

function parseEnvFile(content: string, source: string) {
  const variables: Array<{ key: string; value: string; source: string }> = [];

  const lines = content.split('\n');

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) {
      continue;
    }

    // Match KEY=VALUE pattern, handling quotes
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key = '', rawValue] = match;
      let value = rawValue ?? '';

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Handle escaped quotes within the value
      value = value
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');

      variables.push({
        key: key.trim(),
        value: value.trim(),
        source,
      });
    }
  }

  return variables;
}

export function processEnvDefinitions(
  envInfo: EnvFileInfo,
  mode: EnvMode,
): AppEnvState {
  const variableMap: Record<string, EnvVariableState> = {};

  // First pass: Collect all definitions
  for (const variable of envInfo.variables) {
    if (!variable) {
      continue;
    }

    const model = envVariables.find((v) => variable.key === v.name);

    if (!variableMap[variable.key]) {
      variableMap[variable.key] = {
        key: variable.key,
        definitions: [],
        effectiveValue: variable.value,
        effectiveSource: variable.source,
        isOverridden: false,
        category: model ? model.category : 'Custom',
      };
    }

    const varState = variableMap[variable.key];

    if (!varState) {
      continue;
    }

    varState.definitions.push({
      key: variable.key,
      value: variable.value,
      source: variable.source,
    });
  }

  // Second pass: Determine effective values and override status
  for (const key in variableMap) {
    const varState = variableMap[key];

    if (!varState) {
      continue;
    }

    // Sort definitions by mode-specific precedence
    varState.definitions.sort(
      (a, b) =>
        getSourcePrecedence(a.source, mode) -
        getSourcePrecedence(b.source, mode),
    );

    if (varState.definitions.length > 1) {
      const lastDef = varState.definitions[varState.definitions.length - 1];

      if (!lastDef) {
        continue;
      }

      const highestPrecedence = getSourcePrecedence(lastDef.source, mode);

      varState.isOverridden = true;
      varState.effectiveValue = lastDef.value;
      varState.effectiveSource = lastDef.source;

      // Check for conflicts at highest precedence
      const conflictingDefs = varState.definitions.filter(
        (def) => getSourcePrecedence(def.source, mode) === highestPrecedence,
      );

      if (conflictingDefs.length > 1) {
        varState.effectiveSource = `${varState.effectiveSource}`;
      }
    }
  }

  return {
    appName: envInfo.appName,
    filePath: envInfo.filePath,
    mode,
    variables: variableMap,
  };
}

export async function getEnvState(
  options: ScanOptions,
): Promise<AppEnvState[]> {
  const envInfos = await scanMonorepoEnv(options);
  return envInfos.map((info) => processEnvDefinitions(info, options.mode));
}

// Utility function to get list of env files for current mode
export function getEnvFilesForMode(mode: EnvMode): string[] {
  return ENV_FILE_PRECEDENCE[mode];
}

export async function getVariable(key: string, mode: EnvMode) {
  // Get the processed environment state for all apps (you can limit to 'web' via options)
  const envStates = await getEnvState({ mode, apps: ['web'] });

  // Find the state for the "web" app.
  const webState = envStates.find((state) => state.appName === 'web');

  // Return the effectiveValue based on override status.
  return webState?.variables[key]?.effectiveValue ?? '';
}
