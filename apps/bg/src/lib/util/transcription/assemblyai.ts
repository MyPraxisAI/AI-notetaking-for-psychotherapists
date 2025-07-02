import { SupabaseClient } from '@supabase/supabase-js';
import { BaseTranscriptionProvider, TranscriptionResult } from '../transcription';
import { AssemblyAI } from 'assemblyai';

export interface AssemblyAITranscriptionOptions {
  model?: string;
  language?: string;
  // Add more options as needed for AssemblyAI
}

export const defaultAssemblyAITranscriptionOptions: AssemblyAITranscriptionOptions = {
  model: undefined, // Use AssemblyAI's default model
  language: undefined, // Use auto language detection
  // Add more defaults as needed
};

export class AssemblyAITranscriptionProvider extends BaseTranscriptionProvider {
  private client: AssemblyAI;

  constructor() {
    super();
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('ASSEMBLYAI_API_KEY environment variable is not set');
    }
    this.client = new AssemblyAI({ apiKey });
  }

  async transcribeAudio(
    audioFilePath: string,
    options?: AssemblyAITranscriptionOptions
  ): Promise<TranscriptionResult> {
    // Prepare options for AssemblyAI
    const params: any = {
      audio: audioFilePath,
      speaker_labels: true, // Enable speaker labels by default
      speakers_expected: 2, // for now :) 
      // You can add more options here as needed
    };
    if (options?.model) params.speech_model = options.model;
    if (options?.language) params.language_code = options.language;

    const startTime = Date.now();
    let transcript;
    try {
      transcript = await this.client.transcripts.transcribe(params);
    } catch (error) {
      throw new Error(`AssemblyAI transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const processingTime = (Date.now() - startTime) / 1000;

    // Map utterances to segments if available
    let segments: any[] = [];
    console.log(`AssemblyAItranscript: ${JSON.stringify(transcript)}`);
    if (transcript.utterances && Array.isArray(transcript.utterances)) {
      // Map speaker labels 'A', 'B', ... to 'speaker_1', 'speaker_2', ...
      const speakerMap = new Map();
      let speakerCount = 0;
      segments = transcript.utterances.map((utterance: any) => {
        let speakerLabel = utterance.speaker;
        if (speakerLabel !== undefined && speakerLabel !== null) {
          if (!speakerMap.has(speakerLabel)) {
            speakerCount++;
            speakerMap.set(speakerLabel, `speaker_${speakerCount}`);
          }
          speakerLabel = speakerMap.get(speakerLabel);
        } else {
          speakerLabel = 'unknown';
        }
        return {
          start_ms: Math.round(utterance.start),
          end_ms: Math.round(utterance.end),
          speaker: speakerLabel,
          content: utterance.text,
        };
      });
    }

    const result: TranscriptionResult = {
      text: transcript.text || '',
      processingTime,
      timestamp: new Date().toISOString(),
      model: 'assemblyai/default',
      content_json: {
        segments,
      },
      rawResponse: transcript,
    };
    return result;
  }
} 