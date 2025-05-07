/**
 * Yandex transcription provider implementation
 * This file serves as the entry point for the Yandex transcription provider
 */

import { BaseTranscriptionProvider, TranscriptionResult } from '../../transcription';
import { YandexTranscriptionOptions, defaultYandexTranscriptionOptions } from './common';
import { YandexShortAudioV1Provider } from './short_audio_v1';
import { YandexLongAudioV2Provider } from './long_audio_v2';
import { convertToSupportedFormat } from './utils';

// Re-export types and defaults for consumers
export { YandexTranscriptionOptions, defaultYandexTranscriptionOptions };

/**
 * Yandex transcription provider
 * This class delegates to the appropriate implementation based on the audio file size
 */
export class YandexTranscriptionProvider extends BaseTranscriptionProvider {
  private shortAudioProvider: YandexShortAudioV1Provider;
  private longAudioV2Provider: YandexLongAudioV2Provider;

  constructor() {
    super();
    this.shortAudioProvider = new YandexShortAudioV1Provider();
    this.longAudioV2Provider = new YandexLongAudioV2Provider();
  }

  /**
   * Transcribe an audio file using Yandex SpeechKit API
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param options - Options for transcription
   * @returns Transcription result
   */
  async transcribeAudio(
    audioFilePath: string,
    options?: YandexTranscriptionOptions
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
        
    // Use short audio API for files under 1MB, long audio API for larger files
    // if (fileSizeInMB < 1) {
    // !!!!!!!!!!! Currently  doesn't work - instead of converting audio to mp3 above, 
    //             ( need to convert to lpcm or oggopus, see https://yandex.cloud/en/docs/speechkit/stt/api/request-api ) !!!!!!!!!!!!!!!!
    //   console.log('Using short audio API (v1) for transcription');
    //   return this.shortAudioProvider.transcribeShortAudio(convertedFilePath, transcriptionOptions);
    // } else {
      console.log('Using long audio API (v2) for transcription');
      return this.longAudioV2Provider.transcribeLongAudio(convertedFilePath, transcriptionOptions);
    // }
  }
}
