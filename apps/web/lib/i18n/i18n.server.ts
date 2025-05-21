import { cache } from 'react';

import { cookies, headers } from 'next/headers';

import {
  initializeServerI18n,
  parseAcceptLanguageHeader,
} from '@kit/i18n/server';
import { getUserLanguageRaw } from '@kit/web-bg-common';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import featuresFlagConfig from '~/config/feature-flags.config';
import {
  I18N_COOKIE_NAME,
  getI18nSettings,
  languages,
} from '~/lib/i18n/i18n.settings';

import { i18nResolver } from './i18n.resolver';

/**
 * @name priority
 * @description The language priority setting from the feature flag configuration.
 */
const priority = featuresFlagConfig.languagePriority;

/**
 * @name createI18nServerInstance
 * @description Creates an instance of the i18n server.
 * It uses the language from the cookie if it exists, otherwise it uses the language from the accept-language header.
 * If neither is available, it will default to the provided environment variable.
 *
 * Initialize the i18n instance for every RSC server request (eg. each page/layout)
 */
async function createInstance() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(I18N_COOKIE_NAME)?.value;

  let selectedLanguage: string | undefined = undefined;

  // First, try to get the language from the cookie (explicit user selection in UI)
  if (cookie) {
    selectedLanguage = getLanguageOrFallback(cookie);
  }

  // If no cookie is set, check the user's database preference
  if (!selectedLanguage) {
    try {
      const client = getSupabaseServerClient();
      const userLanguage = await getUserLanguageRaw(client);
      
      if (userLanguage) {
        selectedLanguage = getLanguageOrFallback(userLanguage);
        
        // Set the cookie for future requests
        // This avoids unnecessary database lookups on subsequent requests
        if (selectedLanguage) {
          cookieStore.set(I18N_COOKIE_NAME, selectedLanguage, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1 year
            sameSite: 'lax'
          });
        }
      }
    } catch (error) {
      console.error('Error getting user language from database:', error);
      // Continue with browser detection if database lookup fails
    }
  }

  // If still no language is selected, use browser preference
  if (!selectedLanguage && priority === 'user') {
    const userPreferredLanguage = await getPreferredLanguageFromBrowser();
    selectedLanguage = getLanguageOrFallback(userPreferredLanguage);
    
    // Set the cookie for future requests to avoid re-detection
    if (selectedLanguage) {
      cookieStore.set(I18N_COOKIE_NAME, selectedLanguage, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: 'lax'
      });
    }
  }

  const settings = getI18nSettings(selectedLanguage);

  return initializeServerI18n(settings, i18nResolver);
}

export const createI18nServerInstance = cache(createInstance);

async function getPreferredLanguageFromBrowser() {
  const headersStore = await headers();
  const acceptLanguage = headersStore.get('accept-language');

  if (!acceptLanguage) {
    return;
  }

  return parseAcceptLanguageHeader(acceptLanguage, languages)[0];
}

function getLanguageOrFallback(language: string | undefined) {
  let selectedLanguage = language;

  if (!languages.includes(language ?? '')) {
    console.warn(
      `Language "${language}" is not supported. Falling back to "${languages[0]}"`,
    );

    selectedLanguage = languages[0];
  }

  return selectedLanguage;
}
