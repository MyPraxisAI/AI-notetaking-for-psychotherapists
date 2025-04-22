'use strict';

/**
 * Mock implementation of the OpenAI client for testing
 * This file will be automatically used by Jest when tests import from '../openai-client'
 */

// Store predefined responses for different prompt types
const mockResponses: Record<string, string> = {
  // Session therapist summary response
  'session_therapist_summary': `
# Session Summary

## Presenting Issues
- Work-related anxiety, particularly during meetings and presentations
- Physical symptoms: racing heart, sweating, breathing difficulties
- Worsening over the past few months since getting a new manager

## Client Insights
- Client recognizes avoidance is not a sustainable coping strategy
- Shows awareness of the connection between anxiety and workplace pressure
- Demonstrates willingness to address the issue

## Therapeutic Focus
- Anxiety management techniques
- Gradual exposure to anxiety-provoking situations
- Exploring the relationship between perfectionism and anxiety

## Next Steps
- Introduce breathing and grounding techniques
- Develop a hierarchy for gradual exposure
- Explore cognitive restructuring for anxious thoughts
`,

  // Client summary response
  'session_client_summary': `
# Session Highlights

We discussed your anxiety at work, especially during presentations and meetings. You mentioned physical symptoms like a racing heart and difficulty breathing, which started after your new manager arrived.

## What We Learned
- Your anxiety is triggered by high-pressure situations at work
- You've been avoiding these situations when possible
- You recognize this isn't a long-term solution

## For Next Time
- We'll work on some breathing techniques to help manage anxiety in the moment
- We'll create a plan to gradually face anxiety-provoking situations
- We'll explore how your thoughts might be contributing to your anxiety

Remember that experiencing anxiety is common, and there are effective strategies to manage it. I'm looking forward to our next session where we'll start working on these tools.
`,

  // Client preparation note response
  'client_prep_note': `
# Preparation Note for Next Session

## Follow-up Points from Previous Session
- Check progress with breathing exercises for anxiety management
- Review any situations where client attempted to face anxiety-provoking scenarios
- Explore any insights about thought patterns contributing to anxiety

## Client Context to Remember
- Recently got a new manager who has high expectations
- Experiencing physical symptoms during meetings and presentations
- Using avoidance as primary coping mechanism

## Therapeutic Approaches to Consider
- Continue with Gestalt approach focusing on present awareness
- Introduce cognitive restructuring techniques for anxious thoughts
- Consider gradual exposure hierarchy development

## Exploration Questions
- "How have the breathing techniques worked for you in anxious moments?"
- "What thoughts come up right before you feel anxious in meetings?"
- "What would feel like a small, manageable step toward facing a work presentation?"
`,

  // Client conceptualization response
  'client_conceptualization': `
# Client Conceptualization

## Presenting Concerns
Client presents with work-related anxiety that manifests primarily in meeting and presentation contexts. Physical symptoms include racing heart, sweating, and breathing difficulties. These symptoms have intensified following the arrival of a new manager approximately three months ago. Client reports using avoidance as a primary coping strategy while recognizing its limitations as a long-term solution.

## Relevant History
No significant history of anxiety disorders prior to current work situation. Client reports having previously enjoyed collaborative environments but feels threatened by perceived high expectations from new management. No current medication for anxiety. No reported substance use concerns.

## Conceptualization through Gestalt Lens
From a Gestalt perspective, the client appears to be experiencing an interruption in the contact cycle, specifically through deflection and retroflection. The anxiety represents awareness of a need (to perform well, to be accepted) that is being blocked by fear. Physical symptoms may represent retroflected energy that would otherwise be directed outward. The client's field has been disrupted by the introduction of a new authority figure, creating unresolved tension.

## Treatment Directions
1. Increase present-moment awareness of bodily sensations, thoughts, and emotions during anxiety episodes
2. Explore polarities between the desire to perform well and the fear of failure
3. Experiment with new ways of making contact in anxiety-provoking situations
4. Develop self-support mechanisms to replace avoidance behaviors
5. Work toward integration of the "anxious self" and "capable self" parts

## Potential Challenges
Resistance may emerge as client confronts avoided situations. Physical symptoms may temporarily intensify during exposure work. Client may struggle with the ambiguity inherent in Gestalt approaches if seeking more directive interventions.
`,

  // Client bio response
  'client_bio': `
# Client Biography

## Personal Information
Name: [Client Name]
Age: 34
Occupation: Marketing Manager
Relationship Status: Married, 5 years

## Presenting Issues
Client initially sought therapy for work-related anxiety that emerged following a management change at their company. Primary symptoms include panic-like reactions during meetings and presentations, characterized by racing heart, sweating, and difficulty breathing. Client reports these symptoms began approximately three months ago and have been increasing in frequency and intensity.

## Relevant Background
Client describes a generally positive childhood with supportive parents who emphasized academic achievement. Some history of perfectionist tendencies throughout education. No previous therapy experience. Client completed an MBA six years ago and has been with current company for four years, receiving regular promotions until recent management change.

## Current Life Situation
Lives with spouse who is described as supportive but sometimes frustrated by client's increasing work stress. No children. Reports a small but consistent social network, though has been withdrawing from social activities due to work stress. Physical health is generally good with regular exercise routine that has become less consistent in recent months.

## Strengths and Resources
- Strong analytical abilities and problem-solving skills
- History of professional success and advancement
- Supportive marriage and stable home environment
- Good insight into patterns and willingness to change
- Financial stability allowing for focus on therapeutic work

## Treatment Goals (Client's Perspective)
- Reduce anxiety symptoms in workplace settings
- Develop coping strategies for high-pressure situations
- Improve work-life balance
- Return to previous level of workplace confidence and performance
`,

  // Default response for any unrecognized prompt type
  'default': 'This is a mock response for testing purposes. In a real environment, this would be generated by OpenAI.'
};

/**
 * Determine which mock response to return based on the prompt content
 */
function getMockResponseForPrompt(prompt: string): string {
  if (prompt.includes('session_therapist_summary')) {
    return mockResponses.session_therapist_summary;
  } else if (prompt.includes('session_client_summary')) {
    return mockResponses.session_client_summary;
  } else if (prompt.includes('client_prep_note')) {
    return mockResponses.client_prep_note || mockResponses.default;
  } else if (prompt.includes('client_conceptualization')) {
    return mockResponses.client_conceptualization || mockResponses.default;
  } else if (prompt.includes('client_bio')) {
    return mockResponses.client_bio || mockResponses.default;
  }
  
  return mockResponses.default;
}

/**
 * Mock implementation of the ChatOpenAI class
 */
class MockChatOpenAI {
  modelName: string;
  temperature: number;
  maxTokens?: number;
  
  constructor(options: any) {
    this.modelName = options.modelName || 'gpt-4o-mini';
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens;
  }
  
  async invoke(messages: any): Promise<any> {
    let promptContent: string;
    
    // Handle both string and array inputs
    if (typeof messages === 'string') {
      // Direct string input
      promptContent = messages;
    } else if (Array.isArray(messages)) {
      // Array of message objects (LangChain format)
      promptContent = messages.map(m => m.content).join('\n');
    } else {
      // Single message object or other format
      promptContent = messages.content || messages.toString();
    }
    
    // Get the appropriate mock response
    const responseContent = getMockResponseForPrompt(promptContent);
    
    // Return in the format expected by LangChain
    return {
      content: responseContent,
      role: 'assistant'
    };
  }
}

/**
 * Initialize the mock OpenAI client
 */
export function getOpenAIClient(options: {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  [key: string]: any;
} = {}): any {  
  // Always return the mock in test environments
  return new MockChatOpenAI({
    modelName: options.model || 'gpt-4o-mini',
    temperature: options.temperature || 0.7,
    maxTokens: options.max_tokens
  });
}
