/**
 * Yandex SpeechKit short audio transcription implementation (v1 API)
 * For audio files less than 1MB using synchronous API
 */

import { TranscriptionResult } from '../../transcription';
import { YandexBaseProvider, YandexTranscriptionOptions } from './common';
import { getContentType } from './utils';
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as url from 'node:url';

/**
 * Provider for short audio transcription using Yandex SpeechKit v1 API
 */
export class YandexShortAudioV1Provider extends YandexBaseProvider {
  /**
   * Transcribe a short audio file (<1MB) using Yandex SpeechKit synchronous API
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param transcriptionOptions - Options for transcription
   * @returns Transcription result
   */
  public async transcribeShortAudio(
    audioFilePath: string,
    transcriptionOptions: YandexTranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    // Read the audio file
    const audioBuffer = fs.readFileSync(audioFilePath);
    
    // Get authorization header for authentication
    const authHeader = this.getAuthorizationHeader();
    
    // Get the content type for the audio file
    const contentType = getContentType(audioFilePath);

    // Build the query parameters
    const params = new URLSearchParams();
    params.append('folderId', this.folderId);
    params.append('lang', transcriptionOptions.language || 'auto');
    if (transcriptionOptions.model) {
      params.append('topic', transcriptionOptions.model);
    }
    params.append('format', 'oggopus');
    const queryParams = params.toString();
    
    // Build the request URL
    const apiUrl = `https://${this.apiEndpoint}/speech/v1/stt:recognize?${queryParams}`;
    
    // Make the API request
    const response = await new Promise<any>((resolve, reject) => {
      const parsedUrl = url.parse(apiUrl);
      
      const options = {
        method: 'POST',
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        headers: {
          'Authorization': authHeader,
          'Content-Type': contentType,
          'Content-Length': audioBuffer.length
        }
      };
      
      const req = https.request(options, (res: any) => {
        let data = '';
        
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (error: any) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error: any) => {
        reject(error);
      });
      
      // Write audio data to the request
      req.write(audioBuffer);
      req.end();
    });
    
    // Calculate processing time
    const processingTime = (Date.now() - startTime) / 1000;
    
    // Check if the response contains an error
    if (response.error_code) {
      throw new Error(`Yandex SpeechKit API error: ${response.error_code} - ${response.error_message}`);
    }
    
    // Create the result object
    const result: TranscriptionResult = {
      text: response.result || '',
      confidence: response.confidence || 0.8,
      processingTime,
      timestamp: new Date().toISOString(),
      model: `yandex/${transcriptionOptions.model}`,
      rawResponse: response
    };
    
    console.log(`Short audio transcription completed in ${processingTime.toFixed(2)} seconds`);
    
    return result;
  }
}
