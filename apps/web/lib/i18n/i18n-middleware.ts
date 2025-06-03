import type { NextRequest, NextResponse } from 'next/server';
import { parseAcceptLanguageHeader } from '@kit/i18n/server';
import { getUserLanguageRaw } from '@kit/web-bg-common';
import { createMiddlewareClient } from '@kit/supabase/middleware-client';

import featuresFlagConfig from '~/config/feature-flags.config';
import { I18N_COOKIE_NAME, languages } from './i18n.settings';

// Ensure we always have at least one language
const DEFAULT_LANGUAGE = languages[0] || 'en';

/**
 * The language priority setting from the feature flag configuration.
 */
const priority = featuresFlagConfig.languagePriority;

/**
 * Get the preferred language from the browser's Accept-Language header
 * Always returns a valid language string from our supported languages
 */
function getPreferredLanguageFromBrowser(request: NextRequest): string {
  const acceptLanguage = request.headers.get('accept-language') || '';
  const parsedLanguages = parseAcceptLanguageHeader(acceptLanguage, languages);
  
  if (parsedLanguages.length > 0 && typeof parsedLanguages[0] === 'string') {
    return parsedLanguages[0];
  }
  
  return DEFAULT_LANGUAGE;
}

/**
 * Validate and normalize a language code, falling back to the default if needed
 */
function getLanguageOrFallback(language: string | null | undefined): string {
  if (typeof language !== 'string' || !languages.includes(language)) {
    if (language) {
      console.warn(
        `Language "${language}" is not supported. Falling back to "${DEFAULT_LANGUAGE}"`
      );
    }
    return DEFAULT_LANGUAGE;
  }
  
  return language;
}

/**
 * Middleware function to handle language detection and cookie setting
 * This follows the same logic as the server-side i18n implementation
 * but sets cookies in middleware (where it's allowed in Next.js 15)
 */
export async function handleLanguageInMiddleware(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  // Check if the language cookie already exists
  const langCookie = request.cookies.get(I18N_COOKIE_NAME);
  
  // If cookie exists and is valid, we don't need to do anything
  if (langCookie?.value && languages.includes(langCookie.value)) {
    return response;
  }
  
  let selectedLanguage: string | undefined = undefined;
  
  // If no cookie is set or it's invalid, check the user's database preference
  try {
    const supabase = createMiddlewareClient(request, response);
    
    // First check if user is authenticated
    const { data } = await supabase.auth.getUser();
    
    if (data.user) {
      // User is authenticated, try to get their language preference
      const userLanguage = await getUserLanguageRaw(supabase);   

      if (userLanguage) {
        selectedLanguage = getLanguageOrFallback(userLanguage);
      }
    }
  } catch (error) {
    console.error('Error getting user language from database in middleware:', error);
    // Continue with default language on error
  }
  
  // If browser detection is enabled, override with browser preference
  if (!selectedLanguage && priority === 'user') {
    const browserLanguage = getPreferredLanguageFromBrowser(request);
    selectedLanguage = getLanguageOrFallback(browserLanguage);
  }
  
  // If still no language is selected, use default language
  if (!selectedLanguage) {
    selectedLanguage = DEFAULT_LANGUAGE;
  }
  
  // Set the language cookie on the response
  response.cookies.set(I18N_COOKIE_NAME, selectedLanguage, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax'
  });
  
  console.debug(`[Middleware] Setting language cookie: ${selectedLanguage}`);
  
  return response;
}
