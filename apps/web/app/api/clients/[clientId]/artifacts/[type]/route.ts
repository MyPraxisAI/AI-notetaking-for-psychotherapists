import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserLanguage } from '../../../../../../lib/utils/language';
import type { ArtifactType, LanguageType } from '../../../../../../lib/utils/openai';
import { generateArtifact, saveArtifact } from '../../../../../../lib/utils/openai';

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
    const userLanguage = await getUserLanguage() as LanguageType;
    
    // Check if the artifact already exists in the database
    const { data: existingArtifact } = await client
      .from('artifacts')
      .select('content, language')
      .eq('reference_type', 'client')
      .eq('reference_id', clientId)
      .eq('type', artifactType)
      .single();
    
    // If the artifact exists, return it
    if (existingArtifact) {
      return NextResponse.json({
        content: existingArtifact.content,
        language: existingArtifact.language,
        generated: true,
        dataTest: `client-artifact-${artifactType}`
      });
    }
    
    // If the artifact doesn't exist, generate it
    try {
      let content = '';
      
      // Generate content based on the artifact type
      if (artifactType === 'client_conceptualization') {
        // Get all sessions for the client
        const { data: sessions } = await client
          .from('sessions')
          .select('id, title, note, transcript, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: true });
        
        // Format session contents for the prompt
        const formattedSessionContents = sessions && sessions.length > 0 ? 
          sessions.map((session, index) => {
            const sessionNumber = index + 1;
            const date = new Date(session.created_at).toLocaleDateString();
            
            let content = `## Session ${sessionNumber} - ${date} - ${session.title || 'Untitled'}\n\n`;
            
            if (session.transcript) {
              content += `### Transcript:\n${session.transcript}\n\n`;
            }
            
            if (session.note) {
              content += `### Therapist Notes:\n${session.note}\n\n`;
            }
            
            return content;
          }).join('---\n\n') : 'No session data available.';
        
        // Generate the conceptualization using OpenAI
        content = await generateArtifact(
          artifactType,
          userLanguage,
          {
            session_full_contents: formattedSessionContents,
            session_summaries: '' // Not implemented yet, YSTM-578
          }
        );
        
        // Save the generated artifact to the database
        await saveArtifact(client, clientId, 'client', artifactType, content, userLanguage);
      } else {
        // For now, use mocked content for other artifact types
        // In a real implementation, we would generate these as well
    
        if (artifactType === 'client_prep_note') {
          content = `# Session Preparation Note

## Client Goals
- Continue working on anxiety management techniques
- Discuss recent family conflict
- Review homework from last session

## Therapist Focus Areas
- Assess progress with breathing exercises
- Explore underlying triggers for recent panic attacks
- Introduce thought recording exercise if appropriate

## Notes from Previous Session
Client reported improved sleep after implementing evening routine. Still struggling with work-related stress. Responded well to validation of feelings around family dynamics.`;
        } else if (artifactType === 'client_bio') {
          content = `# Client Biography

## Personal Background
34-year-old software engineer, married with one child (age 5). Lives in urban area. Identifies as introverted and analytical. Enjoys reading, hiking, and strategy games.

## Presenting Concerns
Seeking therapy for anxiety management and work-life balance. Reports increasing panic attacks (2-3/week) and persistent worry about job performance and parenting.

## Strengths & Resources
- Strong problem-solving abilities
- Supportive spouse
- Financial stability
- Previous positive therapy experience (2 years ago)
- Good insight into patterns

## Treatment History
Brief CBT in 2023 for work stress with reported benefit. Currently taking Sertraline 50mg daily, prescribed by PCP.`;
        }
        
        // Save the mocked artifact to the database
        await saveArtifact(client, clientId, 'client', artifactType, content, userLanguage);
      }
    
      return NextResponse.json({
        content: content,
        language: userLanguage,
        generated: true,
        dataTest: `client-artifact-${artifactType}`
      });
    } catch (error) {
      console.error('Error generating artifact:', error);
      return NextResponse.json(
        { error: 'Failed to generate artifact' },
        { status: 500 }
      );
    }
  },
  {
    auth: true,
  }
);
