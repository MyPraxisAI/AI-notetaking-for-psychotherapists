import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getArtifact } from '@kit/web-bg-common';
import type { ArtifactType } from '@kit/web-bg-common/types';
import { logAuditLogRead, extractClientIp } from '../../../../../_lib/server/audit-log';
import { createAccountsApi } from '@kit/web-bg-common';

// This route handler returns artifacts for a client
export const GET = enhanceRouteHandler(
  async ({ params, user, request }) => {
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
    
    try {
      // Get the artifact from the database
      const artifact = await getArtifact(
        client, 
        clientId, 
        'client', 
        artifactType
      );
      
      // If the artifact doesn't exist, return a 404 response
      if (!artifact) {
        return NextResponse.json(
          { error: 'Artifact not found' },
          { status: 404 }
        );
      }

      // Log the read to audit_log
      if (user?.id) {
        await logAuditLogRead({
          actingUserId: user.id,
          tableName: 'artifacts',
          recordId: artifact.id,
          ipAddress: extractClientIp(request),
          details: { artifactType },
        });
      }
      
      // Return the artifact with all its data including the stale field
      return NextResponse.json({
        ...artifact,
        dataTest: `client-artifact-${artifactType}`
      });
    } catch (error) {
      console.error(`Error fetching artifact:`, error);
      
      // Return an error message if fetching fails
      return NextResponse.json({
        error: 'Failed to fetch artifact',
        dataTest: `client-artifact-${artifactType}-error`
      }, { status: 500 });
    }
  },
  {
    auth: true,
  }
);
