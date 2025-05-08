/**
 * Yandex transcription provider implementation
 * This file serves as the entry point for the Yandex transcription provider
 */

import { BaseTranscriptionProvider, TranscriptionResult } from '../../transcription';
import { YandexTranscriptionOptions, defaultYandexTranscriptionOptions } from './common';
import { YandexShortAudioV1Provider } from './short_audio_v1';
import { YandexLongAudioV2Provider } from './long_audio_v2';
import { YandexLongAudioV3Provider, YandexV3TranscriptionOptions, defaultYandexV3TranscriptionOptions } from './long_audio_v3';
import { convertToSupportedFormat } from './utils';

// Re-export types and defaults for consumers
export { 
  YandexTranscriptionOptions, 
  defaultYandexTranscriptionOptions,
  YandexV3TranscriptionOptions,
  defaultYandexV3TranscriptionOptions
};

/**
 * Yandex transcription provider
 * This class delegates to the appropriate implementation based on the audio file size
 */
export class YandexTranscriptionProvider extends BaseTranscriptionProvider {
  private shortAudioProvider: YandexShortAudioV1Provider;
  private longAudioV2Provider: YandexLongAudioV2Provider;
  private longAudioV3Provider: YandexLongAudioV3Provider;

  constructor() {
    super();
    this.shortAudioProvider = new YandexShortAudioV1Provider();
    this.longAudioV2Provider = new YandexLongAudioV2Provider();
    this.longAudioV3Provider = new YandexLongAudioV3Provider();
  }

  /**
   * Transcribe an audio file using Yandex SpeechKit API
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param options - Options for transcription
   * @returns Transcription result
   */
  /**
   * Transcribe an audio file using Yandex SpeechKit API
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param options - Options for transcription
   * @returns Transcription result
   */
  async transcribeAudio(
    audioFilePath: string,
    options?: YandexTranscriptionOptions | YandexV3TranscriptionOptions
  ): Promise<TranscriptionResult> {
    // Use default options if none provided
    const transcriptionOptions = options || defaultYandexTranscriptionOptions;
    
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
    const apiVersion = transcriptionOptions.version || 'v2';
    
    switch (apiVersion) {
      case 'v3':
        console.log('Using long audio API (v3) with speaker identification');
        return this.longAudioV3Provider.transcribeLongAudio(
          convertedFilePath, 
          transcriptionOptions as YandexV3TranscriptionOptions
        );
        
      case 'v1':
        // Short audio API has issues with MP3 format
        // Only use for very small files if explicitly requested
        // TODO: convert to ogg instead of mp3 first (v1 only supports ogg)
        // if (fileSizeInMB < 1) {
        //   console.log('Using short audio API (v1) for transcription');
        //   return this.shortAudioProvider.transcribeShortAudio(convertedFilePath, transcriptionOptions);
        // }
        // Fall through to v2 for larger files
        console.log('File too large for v1 API, using v2 instead');
        
      case 'v2':
      default:
        console.log('Using long audio API (v2) for transcription');
        return this.longAudioV2Provider.transcribeLongAudio(convertedFilePath, transcriptionOptions);
    }
  }
  
  /**
   * Transcribe an audio file with speaker identification using Yandex SpeechKit v3 API
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param options - Options for transcription with speaker identification
   * @returns Transcription result with speaker information
   */
  async transcribeAudioWithSpeakerIdentification(
    audioFilePath: string,
    options?: Partial<YandexV3TranscriptionOptions>
  ): Promise<TranscriptionResult> {
    // Use default v3 options if none provided
    const transcriptionOptions: YandexV3TranscriptionOptions = {
      ...defaultYandexV3TranscriptionOptions,
      ...options,
      version: 'v3' as const, // Ensure v3 API is used with correct type
      enableSpeakerIdentification: true // Ensure speaker identification is enabled
    };
    
    return this.transcribeAudio(audioFilePath, transcriptionOptions);
  }
}
