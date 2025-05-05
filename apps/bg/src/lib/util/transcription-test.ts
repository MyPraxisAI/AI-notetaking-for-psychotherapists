/**
 * Test script for the refactored transcription module
 * This demonstrates how to use the transcription module with proper type safety
 */

import { 
  transcribeAudio, 
  TranscriptionResult, 
  OpenAITranscriptionOptions,
  YandexTranscriptionOptions,
  TranscriptionProvider
} from './transcription';

/**
 * Test function to demonstrate how to use the transcription module
 * @param audioFilePath Path to the audio file to transcribe
 */
async function testTranscription(audioFilePath: string): Promise<void> {
  try {
    console.log('Testing transcription module...');

    // Example 1: Using OpenAI with GPT-4o model
    const openaiOptions: OpenAITranscriptionOptions = {
      model: 'gpt-4o-transcribe',
      response_format: 'json',
      prompt: "The following is a psychotherapy session between a therapist and a client."
    };

    console.log('Transcribing with OpenAI...');
    const openaiResult = await transcribeAudio(audioFilePath, openaiOptions, 'openai');
    console.log('OpenAI transcription result:', openaiResult.text.substring(0, 100) + '...');

    // Example 2: Using OpenAI with Whisper model
    const whisperOptions: OpenAITranscriptionOptions = {
      model: 'whisper-1',
      language: 'en',
      response_format: 'json'
    };

    console.log('Transcribing with Whisper...');
    const whisperResult = await transcribeAudio(audioFilePath, whisperOptions, 'openai');
    console.log('Whisper transcription result:', whisperResult.text.substring(0, 100) + '...');

    // Example 3: Using Yandex
    const yandexOptions: YandexTranscriptionOptions = {
      model: 'general',
      language: 'en',
      profanityFilter: true
    };

    console.log('Transcribing with Yandex...');
    const yandexResult = await transcribeAudio(audioFilePath, yandexOptions, 'yandex');
    console.log('Yandex transcription result:', yandexResult.text.substring(0, 100) + '...');

    // Example 4: Using default provider (OpenAI)
    console.log('Transcribing with default provider...');
    const defaultResult = await transcribeAudio(audioFilePath, openaiOptions);
    console.log('Default provider transcription result:', defaultResult.text.substring(0, 100) + '...');

    console.log('All transcription tests completed successfully!');
  } catch (error) {
    console.error('Error in transcription test:', error);
  }
}

// This is just a demonstration - don't execute automatically
// To run this test, call testTranscription with a valid audio file path
// Example: testTranscription('/path/to/audio/file.webm');

export { testTranscription };
