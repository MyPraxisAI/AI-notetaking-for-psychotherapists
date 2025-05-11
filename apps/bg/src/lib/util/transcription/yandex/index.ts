/**
 * Yandex transcription provider implementation
 * This file serves as the entry point for the Yandex transcription provider
 */

import { BaseTranscriptionProvider, TranscriptionResult } from '../../transcription';
import { YandexTranscriptionOptions } from './common';
// Short audio v1 provider has been removed
// Long audio v2 provider has been removed
import { YandexLongAudioV3Provider, YandexV3TranscriptionOptions } from './long_audio_v3';
import { SupabaseClient } from '@supabase/supabase-js';
import { convertToSupportedFormat } from './utils';

/**
 * Yandex transcription provider
 * This class delegates to the appropriate implementation based on the audio file size
 */
export class YandexTranscriptionProvider extends BaseTranscriptionProvider {
  // Short audio provider has been removed
  // Long audio v2 provider has been removed
  private longAudioV3Provider: YandexLongAudioV3Provider;

  constructor() {
    super();
    // Short audio provider initialization removed
    // Long audio v2 provider initialization removed
    this.longAudioV3Provider = new YandexLongAudioV3Provider();
  }

  /**
   * Transcribe an audio file using Yandex SpeechKit API
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param options - Options for transcription
   * @returns Transcription result
   */
  public async transcribeAudio(
    client: SupabaseClient,
    audioFilePath: string,
    transcriptionOptions: YandexV3TranscriptionOptions
  ): Promise<TranscriptionResult> {
    // Use default options if none provided
    const options = transcriptionOptions;
    
    // Check file size to determine which API to use
    const fs = require('fs');
    const stats = fs.statSync(audioFilePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
    
    console.log(`Audio file size: ${fileSizeInMB.toFixed(2)} MB`);
    
    // Convert audio to a supported format if needed
    // Using the utility function directly instead of through a provider instance
    const convertedFilePath = await convertToSupportedFormat(audioFilePath);
    
    // Determine which API version to use
    const apiVersion = transcriptionOptions.version;
    let provider;
    switch (apiVersion) {
      case 'v3':
        console.log('Using long audio API (v3) with speaker identification');
        return this.longAudioV3Provider.transcribeLongAudio(
          client,
          convertedFilePath,
          transcriptionOptions as YandexV3TranscriptionOptions
        );
      default:
        throw new Error(`Unsupported API version: ${apiVersion}`);
    }
  }
}
