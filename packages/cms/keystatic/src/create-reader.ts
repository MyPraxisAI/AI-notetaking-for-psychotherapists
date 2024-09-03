import { z } from 'zod';

import { keyStaticConfig } from './keystatic.config';

/**
 * The kind of storage to use for the Keystatic reader.
 */
const STORAGE_KIND = process.env.KEYSTATIC_STORAGE_KIND ?? 'local';

/**
 * Creates a new Keystatic reader instance.
 */
export async function createKeystaticReader() {
  switch (STORAGE_KIND) {
    case 'local': {
      if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { createReader } = await import('@keystatic/core/reader');

        return createReader(process.cwd(), keyStaticConfig);
      } else {
        // we should never get here but the compiler requires the check
        // to ensure we don't parse the package at build time
        throw new Error();
      }
    }

    case 'github':
    case 'cloud': {
      const githubConfig = z
        .object({
          token: z.string({
            description: 'The GitHub token to use for authentication.',
          }),
          repo: z.custom<`${string}/${string}`>(),
          pathPrefix: z.string().optional(),
        })
        .parse({
          token: process.env.KEYSTATIC_GITHUB_TOKEN,
          repo: process.env.KEYSTATIC_STORAGE_REPO,
          pathPrefix: process.env.KEYSTATIC_PATH_PREFIX,
        });

      const { createGitHubReader } = await import(
        '@keystatic/core/reader/github'
      );

      return createGitHubReader(keyStaticConfig, githubConfig);
    }

    default:
      throw new Error(`Unknown storage kind`);
  }
}
