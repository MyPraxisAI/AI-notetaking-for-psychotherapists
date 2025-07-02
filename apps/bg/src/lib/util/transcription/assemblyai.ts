import { BaseTranscriptionProvider, TranscriptionResult } from '../transcription';
import { AssemblyAI } from 'assemblyai';
import * as fs from 'fs';

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

type AssemblyAITranscribeParams = {
  audio: fs.ReadStream;
  speaker_labels?: boolean;
  speakers_expected?: number;
  speech_model?: string;
  language_code?: string;
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
    const params: AssemblyAITranscribeParams = {
      audio: fs.createReadStream(audioFilePath),
      speaker_labels: true, // Enable speaker labels by default
      speakers_expected: 2, // for now :)
    };
    if (options?.model) params.speech_model = options.model;
    if (options?.language) params.language_code = options.language;

    const startTime = Date.now();
    let transcript;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transcript = await this.client.transcripts.transcribe(params as any);
    } catch (error) {
      throw new Error(`AssemblyAI transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const processingTime = (Date.now() - startTime) / 1000;

    // Map utterances to segments if available
    let segments: Array<{ start_ms: number; end_ms: number; speaker: string; content: string }> = [];
    if (transcript.utterances && Array.isArray(transcript.utterances)) {
      // Map speaker labels 'A', 'B', ... to 'speaker_1', 'speaker_2', ...
      const speakerMap = new Map<string, string>();
      let speakerCount = 0;
      segments = transcript.utterances.map((utterance: { start: number; end: number; speaker: string; text: string }) => {
        let speakerLabel = utterance.speaker;
        if (speakerLabel !== undefined && speakerLabel !== null) {
          if (!speakerMap.has(speakerLabel)) {
            speakerCount++;
            speakerMap.set(speakerLabel, `speaker_${speakerCount}`);
          }
          speakerLabel = speakerMap.get(speakerLabel)!;
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

    // HIPAA compliance: delete the transcript from AssemblyAI after receiving it
    try {
      if (transcript.id) {
        await this.client.transcripts.delete(transcript.id);
      }
    } catch (deleteError) {
      // Log but do not throw, since we want to return the result even if deletion fails
      console.error('Failed to delete AssemblyAI transcript:', deleteError);
    }

    return result;
  }
}