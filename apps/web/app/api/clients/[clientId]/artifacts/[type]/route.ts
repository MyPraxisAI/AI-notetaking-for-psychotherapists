import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserLanguage } from '../../../../../../lib/utils/language';
import type { ArtifactType, LanguageType } from '../../../../../../lib/utils/openai';

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
    
    // For now, return mocked values based on the artifact type
    // In a real implementation, we would:
    // 1. Check if the artifact exists in the database
    // 2. If not, generate it with OpenAI
    // 3. Save it to the database
    // 4. Return it
    
    // Simulate a delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Return mocked content based on the artifact type
    let mockedContent = '';
    
    if (artifactType === 'client_prep_note') {
      mockedContent = `# Session Preparation Note

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
    } else if (artifactType === 'client_conceptualization') {
      mockedContent = `# Case Conceptualization

## Presenting Problems
Client presents with generalized anxiety disorder (GAD) and social anxiety symptoms. Reports frequent worry, difficulty concentrating, and avoidance of social situations. Physical symptoms include tension, fatigue, and sleep disturbance.

## Relevant History
- Family history of anxiety disorders (mother)
- Academic pressure from early childhood
- Bullying experiences in middle school
- High-pressure work environment

## Psychological Mechanisms
Client's anxiety appears maintained by:
1. Catastrophic thinking patterns
2. Avoidance behaviors reinforcing fear
3. Perfectionism and high self-criticism
4. Limited emotional regulation skills

## Treatment Approach
Using CBT framework to address cognitive distortions and develop coping skills. Incorporating mindfulness techniques to improve present-moment awareness and reduce rumination.`;
    } else if (artifactType === 'client_bio') {
      mockedContent = `# Client Biography

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
    
    return NextResponse.json({
      content: mockedContent,
      language: userLanguage,
      generated: false,
      dataTest: `client-artifact-${artifactType}`
    });
  },
  {
    auth: true,
  }
);
