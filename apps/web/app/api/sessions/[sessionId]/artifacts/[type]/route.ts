import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';

// This route handler returns artifacts for a session
// It will be enhanced with authentication and error handling
export const GET = enhanceRouteHandler(
  async (req) => {
    const { params } = req;
    const { sessionId, type } = params as { sessionId: string; type: string };

    // Validate the artifact type
    if (!['session_therapist_summary', 'session_client_summary'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid artifact type' },
        { status: 400 }
      );
    }

    // For now, return mock data
    // In the future, this will check the artifacts table and generate with OpenAI if needed
    const mockArtifacts = {
      session_therapist_summary: `## Session Analysis
      
The client demonstrated significant progress in addressing their anxiety triggers. Key observations:

1. **Cognitive patterns**: Client is now able to identify catastrophic thinking before it escalates
2. **Behavioral responses**: Successfully applied breathing techniques in two real-world situations
3. **Emotional regulation**: Reported decreased intensity of panic symptoms

**Recommendations for next session:**
- Continue exposure hierarchy work
- Introduce thought records for documenting cognitive distortions
- Consider mindfulness practice to complement existing techniques`,

      session_client_summary: `# Session Summary

We worked on understanding your anxiety triggers and practiced some techniques to help manage them. Here's what we covered:

- Identified specific situations that tend to trigger your anxiety
- Practiced the 4-7-8 breathing technique that you can use anytime
- Discussed how to recognize when your thoughts are becoming catastrophic
- Created a simple plan for gradually facing situations that make you anxious

**For next time:** Try using the breathing technique when you notice anxiety starting, and we'll discuss how it went.`,
    };

    // Add a delay to simulate network/processing time
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return NextResponse.json({
      content: mockArtifacts[type as 'session_therapist_summary' | 'session_client_summary'],
      language: 'en',
    });
  },
  {
    auth: true,
  }
);
