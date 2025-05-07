/**
 * Yandex SpeechKit long audio transcription implementation (v2 API)
 * For audio files larger than 1MB using asynchronous API
 */

import { TranscriptionResult } from '../../transcription';
import { YandexBaseProvider, YandexTranscriptionOptions } from './common';
import * as https from 'node:https';
import * as url from 'node:url';

/**
 * Provider for long audio transcription using Yandex SpeechKit v2 API
 */
export class YandexLongAudioV2Provider extends YandexBaseProvider {
  /**
   * Transcribe a long audio file (>1MB) using Yandex SpeechKit asynchronous API v2
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param transcriptionOptions - Options for transcription
   * @returns Transcription result
   */
  public async transcribeLongAudio(
    audioFilePath: string,
    transcriptionOptions: YandexTranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    let storageUri: string | null = null;
    
    try {
      // Get authorization header for authentication
      const authHeader = this.getAuthorizationHeader();
      
      // Get audio duration for better wait time estimation
      const estimatedAudioDurationSeconds = await this.estimateAudioDuration(audioFilePath); 
      
      // Step 1: Upload the audio file to Yandex Object Storage
      console.log('Uploading audio file to Yandex Object Storage...');
      storageUri = await this.uploadToObjectStorage(audioFilePath);
      console.log(`File uploaded to ${storageUri}`);
      
      // Create internal options object with the storage URI
      const internalOptions = {
        ...transcriptionOptions,
        _storageUri: storageUri // Using underscore to indicate this is internal
      };
      
      // Step 2: Create a new long audio recognition operation with the storage URI
      console.log('Starting long audio recognition operation...');
      const operationId = await this.createLongAudioOperation(authHeader, internalOptions);
      
      // Step 3: Wait for the operation to complete
      console.log(`Waiting for operation ${operationId} to complete...`);
      
      const result = await this.waitForOperationCompletion(
        operationId, 
        authHeader, 
        estimatedAudioDurationSeconds
      );
      
      // Calculate processing time
      const processingTime = (Date.now() - startTime) / 1000;
      
      console.log(`Long audio transcription completed in ${processingTime.toFixed(2)} seconds`);
      
      return {
        text: result.response.chunks.map((chunk: any) => chunk.alternatives[0].text).join(' '),
        confidence: result.response.chunks.reduce((avg: number, chunk: any) => avg + chunk.alternatives[0].confidence, 0) / result.response.chunks.length,
        processingTime,
        timestamp: new Date().toISOString(),
        model: `yandex/${transcriptionOptions.model}`,
        rawResponse: result
      };
    } finally {
      // Clean up the storage object if it was created
      if (storageUri) {
        console.log(`Cleaning up temporary storage object: ${storageUri}`);
        await this.deleteFromObjectStorage(storageUri);
      }
    }
  }

  /**
   * Create a new long audio recognition operation
   * 
   * @param authHeader - Authorization header for authentication
   * @param options - Transcription options
   * @returns Operation ID
   */
  private async createLongAudioOperation(
    authHeader: string,
    options: YandexTranscriptionOptions & { _storageUri?: string }
  ): Promise<string> {
    // Prepare the request body
    const requestBody = JSON.stringify({
      config: {
        specification: {
          languageCode: options.language || 'auto',
          model: options.model || 'general',
          audioEncoding: 'MP3', // for now, we always convert webm to mp3
          profanityFilter: options.profanityFilter || false,
          literature_text: options.literatureText || true,
          ...(options.topic ? { topic: options.topic } : {})
        }
      },
      audio: {
        uri: options._storageUri
      },
      folderId: this.folderId
    });
    
    // Make the API request to create the operation
    const response = await new Promise<any>((resolve, reject) => {
      const apiUrl = `https://${this.longAudioApiEndpoint}/speech/stt/v2/longRunningRecognize`;
      const parsedUrl = url.parse(apiUrl);
      
      const options = {
        method: 'POST',
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
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
      
      // Write request body
      req.write(requestBody);
      req.end();
    });
        
    // Check if the response contains an error
    if (response.error) {
      throw new Error(`Yandex SpeechKit API error: ${response.error.code} - ${response.error.message}`);
    }
    
    // Check if the operation ID exists
    if (!response.id) {
      console.error('Operation ID is missing in the response:', response);
      throw new Error('Operation ID is missing in the Yandex API response');
    }
    
    console.log(`Retrieved operation ID: ${response.id}`);
    
    // Return the operation ID
    return response.id;
  }

  /**
   * Wait for a long audio recognition operation to complete
   * 
   * @param operationId - ID of the operation
   * @param authHeader - Authorization header for authentication
   * @param estimatedAudioDurationSeconds - Estimated duration of the audio in seconds
   * @returns Operation result
   */
  private async waitForOperationCompletion(
    operationId: string,
    authHeader: string,
    estimatedDurationSeconds: number = 0
  ): Promise<any> {
    console.log(`Starting to wait for operation completion with ID: "${operationId}"`);
    
    if (!operationId) {
      console.error('Operation ID is undefined or empty in waitForOperationCompletion');
      throw new Error('Cannot wait for operation completion: Operation ID is undefined or empty');
    }
    
    const startTime = Date.now();
    let elapsedTime = 0;
    
    // Calculate estimated transcription time based on audio duration
    // Yandex docs suggest ~10 minutes for 1 hour of audio
    // Use a ratio of 1:6 (10 min for 60 min = 1/6) for processing time 
    // (`general` model according to Yandex docs takes 10 mins per hour of audio https://yandex.cloud/en/docs/speechkit/stt/api/transcribation-api)
    // Add a small buffer to account for API overhead
    const estimatedTranscriptionTimeSeconds = Math.max(
      1, // Minimum 1 second initial wait
      Math.floor(estimatedDurationSeconds / 6) + 2
    );
    
    console.log(`Estimated transcription time: ${estimatedTranscriptionTimeSeconds} seconds (${Math.floor(estimatedTranscriptionTimeSeconds / 60)} minutes ${estimatedTranscriptionTimeSeconds % 60} seconds)`);
    
    // Calculate maximum wait time as 2x the estimated transcription time (with reasonable min/max bounds)
    // This gives enough buffer for processing while not waiting indefinitely
    const maxWaitTimeSeconds = Math.max(
      60, // Minimum 1 minute wait
      Math.min(
        7200, // Maximum 2 hours wait
        estimatedTranscriptionTimeSeconds * 2 // 2x the estimated transcription time
      )
    );
    
    console.log(`Setting maximum wait time to ${maxWaitTimeSeconds} seconds (${Math.floor(maxWaitTimeSeconds / 60)} minutes ${maxWaitTimeSeconds % 60} seconds)`);
    
    console.log(`Estimated audio duration: ${estimatedDurationSeconds} seconds. Waiting ${estimatedTranscriptionTimeSeconds} seconds before first poll.`);
    
    // Wait before first poll
    // TODO: instead of just waiting here, send another task into SQS
    await new Promise(resolve => setTimeout(resolve, estimatedTranscriptionTimeSeconds * 1000));
    
    // Update elapsed time
    elapsedTime = (Date.now() - startTime) / 1000;
    console.log(`Initial wait complete. Elapsed time: ${Math.floor(elapsedTime)} seconds.`);
    
    // Poll the operation status until it completes or times out
    while (elapsedTime < maxWaitTimeSeconds) {
      // Make the API request to get the operation status
      const response = await new Promise<any>((resolve, reject) => {
        const apiUrl = `https://operation.api.cloud.yandex.net/operations/${operationId}`;
        const parsedUrl = url.parse(apiUrl);
        
        const options = {
          method: 'GET',
          hostname: parsedUrl.hostname,
          path: parsedUrl.path,
          headers: {
            'Authorization': authHeader
          }
        };
        
        console.log(`Checking operation status with request:`, {
          method: options.method,
          url: `https://${options.hostname}${options.path}`,
          headers: { Authorization: 'Api-Key ***' } // Redacted for security
        });
        
        const req = https.request(options, (res: any) => {
          console.log(`Operation status response code: ${res.statusCode}`);
          console.log(`Operation status response headers:`, res.headers);
          
          let data = '';
          
          res.on('data', (chunk: any) => {
            console.log(`Received chunk of size: ${chunk.length} bytes`);
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              console.log(`Operation status complete response (${data.length} bytes):`, data);
              if (data.length === 0) {
                console.warn('Empty response received from operation status endpoint');
                resolve({}); // Return empty object to avoid parsing errors
                return;
              }
              const parsedData = JSON.parse(data);
              resolve(parsedData);
            } catch (error: any) {
              console.error(`Failed to parse response: ${error.message}`);
              reject(new Error(`Failed to parse response: ${error.message}`));
            }
          });
        });
        
        req.on('error', (error: any) => {
          reject(error);
        });
        
        req.end();
      });
      
      // Check if the operation has completed
      if (response.done) {
        // Check if the operation was successful
        if (response.response) {
          return response;
        } else if (response.error) {
          throw new Error(`Yandex SpeechKit API error: ${response.error.code} - ${response.error.message}`);
        }
      }
      
      // Adaptive polling: increase interval as time passes to avoid rate limits
      const pollInterval = Math.min(
        60000, // Cap at 60 seconds max interval
        5000 + Math.floor(elapsedTime / 60) * 5000 // Start at 5s, add 5s for each minute elapsed
      );
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      // Update elapsed time
      elapsedTime = (Date.now() - startTime) / 1000;
      
      // Log progress (less frequently as time passes)
      const logInterval = Math.min(300, 30 + Math.floor(elapsedTime / 120) * 30); // Start at 30s, increase by 30s every 2 minutes
      if (elapsedTime % logInterval < 5) { // Log based on adaptive interval
        console.log(`Waiting for transcription to complete... (${Math.floor(elapsedTime)}/${maxWaitTimeSeconds} seconds, polling every ${pollInterval/1000}s)`);
      }
    }
    
    // If we get here, the operation timed out
    throw new Error(`Operation timed out after ${maxWaitTimeSeconds} seconds`);
  }
}
