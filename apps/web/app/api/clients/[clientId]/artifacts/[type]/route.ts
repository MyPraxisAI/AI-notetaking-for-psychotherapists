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
        
        // Format full session contents for the prompt
        const formattedFullSessionContents = sessions && sessions.length > 0 ? 
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
            full_session_contents: formattedFullSessionContents,
            session_summaries: '' // Not implemented yet, YSTM-578
          }
        );
        
        // Save the generated artifact to the database
        await saveArtifact(client, clientId, 'client', artifactType, content, userLanguage);
      } else if (artifactType === 'client_prep_note') {
        // Get the client's conceptualization
        let conceptualizationContent = '';
        
        // Check if conceptualization exists
        const { data: existingConceptualization } = await client
          .from('artifacts')
          .select('content')
          .eq('reference_type', 'client')
          .eq('reference_id', clientId)
          .eq('type', 'client_conceptualization')
          .single();
        
        if (existingConceptualization?.content) {
          // Use existing conceptualization
          conceptualizationContent = existingConceptualization.content;
        } else {
          // Generate conceptualization if it doesn't exist
          // Get all sessions for the client
          const { data: allSessions } = await client
            .from('sessions')
            .select('id, title, note, transcript, created_at')
            .eq('client_id', clientId)
            .order('created_at', { ascending: true });
          
          // Format full session contents for the prompt
          const formattedFullSessionContents = allSessions && allSessions.length > 0 ? 
            allSessions.map((session, index) => {
              const sessionNumber = index + 1;
              const date = new Date(session.created_at).toLocaleDateString();
              
              let sessionContent = `## Session ${sessionNumber} - ${date} - ${session.title || 'Untitled'}\n\n`;
              
              if (session.transcript) {
                sessionContent += `### Transcript:\n${session.transcript}\n\n`;
              }
              
              if (session.note) {
                sessionContent += `### Therapist Notes:\n${session.note}\n\n`;
              }
              
              return sessionContent;
            }).join('---\n\n') : 'No session data available.';
          
          // Generate the conceptualization
          conceptualizationContent = await generateArtifact(
            'client_conceptualization',
            userLanguage,
            {
              full_session_contents: formattedFullSessionContents,
              session_summaries: '' // Not implemented yet, YSTM-578
            }
          );
          
          // Save the generated conceptualization
          await saveArtifact(client, clientId, 'client', 'client_conceptualization', conceptualizationContent, userLanguage);
        }
        
        // Get the last session content
        const { data: lastSession } = await client
          .from('sessions')
          .select('title, note, transcript, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        // Format last session content
        let lastSessionContent = 'No previous session data available.';
        
        if (lastSession) {
          const date = new Date(lastSession.created_at).toLocaleDateString();
          lastSessionContent = `# Last Session - ${date} - ${lastSession.title || 'Untitled'}\n\n`;
          
          if (lastSession.transcript) {
            lastSessionContent += `## Transcript:\n${lastSession.transcript}\n\n`;
          }
          
          if (lastSession.note) {
            lastSessionContent += `## Therapist Notes:\n${lastSession.note}\n\n`;
          }
        }
        
        // Generate the prep note using OpenAI
        content = await generateArtifact(
          artifactType,
          userLanguage,
          {
            conceptualization: conceptualizationContent,
            last_session_content: lastSessionContent
          }
        );
        
        // Save the generated artifact to the database
        await saveArtifact(client, clientId, 'client', artifactType, content, userLanguage);
      } else if (artifactType === 'client_bio') {
        // For now, use mocked content for client bio
        // In a real implementation, we would generate this as well
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
      
      // Save the generated artifact to the database
      await saveArtifact(client, clientId, 'client', artifactType, content, userLanguage);
      
      // Return the generated artifact
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
