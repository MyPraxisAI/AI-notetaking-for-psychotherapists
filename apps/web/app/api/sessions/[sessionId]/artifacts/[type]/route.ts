import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { 
  getOrCreateArtifact,
  getArtifact,
  getSessionContent
} from '@kit/web-bg-common';
import type { ArtifactType } from '@kit/web-bg-common/types';
import { logAuditLogRead, extractClientIp } from '@kit/audit-log';

// This route handler returns artifacts for a session
// It will be enhanced with authentication and error handling
export const GET = enhanceRouteHandler(
  async ({ params, user, request }) => {
    const { sessionId, type } = params as { sessionId: string; type: string };

    // Validate the artifact type
    if (!['session_therapist_summary', 'session_client_summary'].includes(type)) {
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
      let artifact = await getArtifact(
        client,
        sessionId,
        'session',
        artifactType
      );
      
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
        dataTest: `session-artifact-${artifactType}`
      });
    } catch (error) {
      console.error('Error fetching artifact:', error);
      
      // Return an error message if fetching fails
      return NextResponse.json({
        error: 'Failed to fetch artifact',
        dataTest: `session-artifact-${artifactType}-error`
      }, { status: 500 });
    }
  },
  {
    auth: true,
  }
);
