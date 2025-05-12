import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { 
  getUserLanguage, 
  generateArtifact, 
  saveArtifact, 
  createPromptApi,
  getOrCreateArtifact,
  extractTemplateVariables,
  validateTemplateVariables
} from '@kit/web-bg-common';
import type { ArtifactType, LanguageType } from '@kit/web-bg-common/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// This route handler returns artifacts for a client
export const GET = enhanceRouteHandler(
  async (req) => {
    const { params } = req;
    const { clientId, type } = params as { clientId: string; type: string };
    // Validate the artifact type
    if (!['client_prep_note', 'client_conceptualization', 'client_bio'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid artifact type' },
        { status: 400 }
      );
    }
    
    // Cast the type to a valid artifact type
    const artifactType = type as ArtifactType;

    // Get the Supabase client for database access
    const client = getSupabaseServerClient();
    
    // Get the user's preferred language
    const userLanguage = await getUserLanguage(client) as LanguageType;
    
    try {
      
      // Get or create the artifact
      const { content, language, isNew } = await getOrCreateArtifact(
        client, 
        clientId, 
        'client', 
        artifactType, 
        userLanguage
      );
      
      // Return the artifact
      return NextResponse.json({
        content,
        language,
        generated: true,
        isNew,
        dataTest: `client-artifact-${artifactType}`
      });
    } catch (error) {
      console.error(`Error getting or creating ${artifactType}:`, error);
      return NextResponse.json(
        { error: `Failed to get or create ${artifactType}: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  },
  {
    auth: true,
  }
);
