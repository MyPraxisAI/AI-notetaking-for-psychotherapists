/**
 * Yandex SpeechKit long audio transcription implementation (v3 API)
 * For audio files with speaker identification using asynchronous API v3
 * 
 * Documentation: https://yandex.cloud/en/docs/speechkit/stt-v3/api-ref/AsyncRecognizer/
 */

import { TranscriptionResult, Speaker, TranscriptionSegment } from '../../transcription';
import { YandexBaseProvider, YandexTranscriptionOptions } from './common';
import { SupabaseClient } from '@supabase/supabase-js';
import { classifySpeakerRoles } from '../role_classification';
import * as https from 'node:https';
import * as url from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Extended options for Yandex SpeechKit v3 transcription
 */
export interface YandexV3TranscriptionOptions extends YandexTranscriptionOptions {
  /**
   * API version - always v3 for this interface
   */
  version: 'v3';
  
  /**
   * Enable speaker identification (diarization)
   */
  enableSpeakerIdentification?: boolean;
  

}

/**
 * Options for Yandex SpeechKit v3 Russian transcription
 */
export const YandexV3RuOptions: YandexV3TranscriptionOptions = {
  version: 'v3',
  model: 'general',
  language: 'ru-RU',
  literatureText: true,
  profanityFilter: false,
  enableSpeakerIdentification: true
};

/**
 * Provider for long audio transcription using Yandex SpeechKit v3 API with speaker identification
 */
export class YandexLongAudioV3Provider extends YandexBaseProvider {
  // V3 API endpoint
  private v3ApiEndpoint: string = 'stt.api.cloud.yandex.net';
  
  /**
   * Transcribe a long audio file using Yandex SpeechKit asynchronous API v3 with speaker identification
   * 
   * @param client - Supabase client
   * @param audioFilePath - Path to the audio file to transcribe
   * @param transcriptionOptions - Options for transcription
   * @returns Transcription result
   */
  public async transcribeLongAudio(
    client: SupabaseClient,
    audioFilePath: string,
    transcriptionOptions: YandexV3TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    let storageUri: string | null = null;
    let operationId: string | null = null;
    
    try {
      // Get authorization header for authentication
      const authHeader = this.getAuthorizationHeader();
      
      // Get audio duration for better wait time estimation
      const estimatedAudioDurationSeconds = await this.estimateAudioDuration(audioFilePath); 
      
      // Step 1: Upload the audio file to Yandex Object Storage
      console.log('Uploading audio file to Yandex Object Storage for v3 API...');
      storageUri = await this.uploadToObjectStorage(audioFilePath);
      console.log(`File uploaded to ${storageUri}`);
      
      // Create internal options object with the storage URI
      const internalOptions = {
        ...transcriptionOptions,
        _storageUri: storageUri // Using underscore to indicate this is internal
      };
      
      // Step 2: Create a new long audio recognition operation with the storage URI
      console.log('Starting long audio recognition operation with v3 API...');
      operationId = await this.createLongAudioOperation(authHeader, internalOptions);
      
      // Step 3: Wait for the operation to complete
      console.log(`Waiting for operation ${operationId} to complete...`);
      
      const result = await this.waitForOperationCompletion(
        operationId, 
        authHeader, 
        estimatedAudioDurationSeconds
      );
      
      // Calculate processing time
      const processingTime = (Date.now() - startTime) / 1000;
      
      console.log(`Long audio transcription with v3 API completed in ${processingTime.toFixed(2)} seconds`);
      
      // Process the result to extract text, speakers, and segments
      return this.processTranscriptionResult(result, processingTime, client, transcriptionOptions);
    } catch (error) {
      console.error('Error during v3 transcription:', error);
      throw error;
    } finally {
      // Clean up resources
      try {
        // Clean up the storage object if it was created
        if (storageUri) {
          console.log(`Cleaning up temporary storage object: ${storageUri}`);
          await this.deleteFromObjectStorage(storageUri);
        }
        
        // Clean up the recognition result to avoid storage costs
        if (operationId) {
          console.log(`Cleaning up recognition result for operation: ${operationId}`);
          await this.deleteRecognitionResult(operationId, this.getAuthorizationHeader());
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
        // Don't throw the cleanup error, as the transcription was successful
      }
    }
  }

  /**
   * Create a new long audio recognition operation using v3 API
   * 
   * @param authHeader - Authorization header for authentication
   * @param options - Transcription options with storage URI
   * @returns Operation ID
   */
  private async createLongAudioOperation(
    authHeader: string,
    options: YandexV3TranscriptionOptions & { _storageUri?: string }
  ): Promise<string> {
    // Prepare the request body with speaker identification if enabled
    const requestBody = JSON.stringify({
      uri: options._storageUri,
      folderId: this.folderId,
      recognitionModel: {
        model: options.model || 'general',
        audioFormat: {
          containerAudio: {
            containerAudioType: 'MP3'
          }
        },
        textNormalization: {
          profanityFilter: options.profanityFilter || false,
          literatureText: options.literatureText || true,
          textNormalization: 'TEXT_NORMALIZATION_ENABLED'
        },
        languageRestriction: {
          restrictionType: options.language === 'auto' ? 'BLACKLIST' : 'WHITELIST',
          languageCode: options.language === 'auto' ? [] : [options.language || 'ru-RU']
        },
        audioProcessingType: 'FULL_DATA' // or 'REAL_TIME'
      },
      speechAnalysis: {
        enableSpeakerAnalysis: true, // try false here?
        enableConversationAnalysis: false // stats on conversation dynamics, priced separately
      },
      speakerLabeling: {
        speakerLabeling: 'SPEAKER_LABELING_ENABLED',
      }
    });
    
    // Make the API request to create the operation
    const response = await new Promise<any>((resolve, reject) => {
      const apiUrl = `https://${this.v3ApiEndpoint}/stt/v3/recognizeFileAsync`;
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
      
      console.log('Sending request to v3 API:', {
        url: apiUrl,
        method: options.method,
        path: options.path
      });
      
      const req = https.request(options, (res: any) => {
        let data = '';
        
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            console.log(`V3 API response status: ${res.statusCode}`);
            if (res.statusCode >= 400) {
              console.error(`Error response from v3 API: ${data}`);
              reject(new Error(`API error: ${res.statusCode} - ${data}`));
              return;
            }
            
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
    
    console.log(`Retrieved operation ID from v3 API: ${response.id}`);
    
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
    console.log(`Starting to wait for v3 operation completion with ID: "${operationId}"`);
    
    if (!operationId) {
      console.error('Operation ID is undefined or empty in waitForOperationCompletion');
      throw new Error('Cannot wait for operation completion: Operation ID is undefined or empty');
    }
    
    const startTime = Date.now();
    let elapsedTime = 0;
    
    const estimatedTranscriptionTimeSeconds = Math.max(
      1, // Minimum 1 second initial wait
      Math.floor(estimatedDurationSeconds / 15)
    );
    
    console.log(`Estimated transcription time: ${estimatedTranscriptionTimeSeconds} seconds (${Math.floor(estimatedTranscriptionTimeSeconds / 60)} minutes ${estimatedTranscriptionTimeSeconds % 60} seconds)`);
    
    // Calculate maximum wait time as 2x the estimated transcription time (with reasonable min/max bounds)
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
    await new Promise(resolve => setTimeout(resolve, estimatedTranscriptionTimeSeconds * 1000));
    
    // Update elapsed time
    elapsedTime = (Date.now() - startTime) / 1000;
    console.log(`Initial wait complete. Elapsed time: ${Math.floor(elapsedTime)} seconds.`);
    
    // Poll the operation status until it completes or times out
    while (elapsedTime < maxWaitTimeSeconds) {
      // Make the API request to get the operation status
      const response = await new Promise<any>((resolve, reject) => {
        const apiUrl = `https://${this.v3ApiEndpoint}/stt/v3/getRecognition?operationId=${operationId}`;
        const parsedUrl = url.parse(apiUrl);
        
        const options = {
          method: 'GET',
          hostname: parsedUrl.hostname,
          path: parsedUrl.path,
          headers: {
            'Authorization': authHeader
          }
        };
        
        console.log(`Checking v3 operation status with request:`, {
          method: options.method,
          url: `https://${options.hostname}${options.path}`,
          headers: { Authorization: 'Api-Key ***' } // Redacted for security
        });
        
        const req = https.request(options, (res: any) => {
          console.log(`V3 operation status response code: ${res.statusCode}`);
          
          // If status code is not 200, continue polling
          if (res.statusCode !== 200) {
            console.warn(`Non-200 status code: ${res.statusCode}, continuing to poll`);
            
            // For 404, it just means the operation isn't ready yet, so continue polling immediately
            // For other errors, we might want to add a delay in the future if needed
            resolve({
              done: false,
              status: 'POLLING',
              statusCode: res.statusCode,
              error: {
                code: 'HTTP_ERROR',
                message: `Received HTTP ${res.statusCode} from API`
              }
            });
            return;
          }
          
          let data = '';
          
          res.on('data', (chunk: any) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              console.log(`V3 operation status complete response (${data.length} bytes)`);
              if (data.length === 0) {
                console.warn('Empty response received from operation status endpoint');
                resolve({}); // Return empty object to avoid parsing errors
                return;
              }
              console.log(`Processing multiple JSON objects in response...`);
              
              // Parse the response data into a combined result object
              // This will throw an error if parsing fails
              const combinedResult = this.parseResponseData(data);
              
              resolve(combinedResult);
            } catch (error: any) {
              console.error(`Failed to process response: ${error.message}`);
              reject(new Error(`Failed to process response: ${error.message}`));
            }
          });
        });
        
        req.on('error', (error: any) => {
          reject(error);
        });
        
        req.end();
      });
      
      // Log polling status for debugging
      if (response.status === 'POLLING' && response.error) {
        console.log(`Polling continues after HTTP error: ${response.error.message}`);
      }
      
      // Check if the operation has completed or is still in progress
      if (response.done || response.status === 'DONE') {
        // Check if the operation was successful
        if (response.response || response.result) {
          return response;
        } else if (response.error) {
          throw new Error(`Yandex SpeechKit API error: ${response.error.code || 'unknown'} - ${response.error.message || JSON.stringify(response.error)}`);
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
        console.log(`Waiting for v3 transcription to complete... (${Math.floor(elapsedTime)}/${maxWaitTimeSeconds} seconds, polling every ${pollInterval/1000}s)`);
      }
    }
    
    // If we get here, the operation timed out
    throw new Error(`V3 operation timed out after ${maxWaitTimeSeconds} seconds`);
  }

  /**
   * Delete a recognition result to avoid storage costs
   * 
   * @param operationId - ID of the recognition operation
   * @param authHeader - Authorization header for authentication
   * @returns Promise that resolves when the deletion is complete
   */
  private async deleteRecognitionResult(operationId: string, authHeader: string): Promise<void> {
    try {
      console.log(`Deleting recognition result for operation: ${operationId}`);
      
      // Make the API request to delete the recognition result
      await new Promise<void>((resolve, reject) => {
        const apiUrl = `https://${this.v3ApiEndpoint}/stt/v3/deleteRecognition?operationId=${operationId}`;
        const parsedUrl = url.parse(apiUrl);
        
        const options = {
          method: 'DELETE',
          hostname: parsedUrl.hostname,
          path: parsedUrl.path,
          headers: {
            'Authorization': authHeader
          }
        };
        
        const req = https.request(options, (res: any) => {
          let data = '';
          
          res.on('data', (chunk: any) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`Successfully deleted recognition result for operation: ${operationId}`);
              resolve();
            } else {
              console.warn(`Failed to delete recognition result: ${res.statusCode} - ${data}`);
              // Resolve anyway, as this is a cleanup operation
              resolve();
            }
          });
        });
        
        req.on('error', (error: any) => {
          console.warn(`Error deleting recognition result: ${error.message}`);
          // Resolve anyway, as this is a cleanup operation
          resolve();
        });
        
        req.end();
      });
    } catch (error) {
      console.warn(`Exception during recognition result deletion: ${error}`);
      // Don't throw, as this is a cleanup operation
    }
  }
  
  /**
   * Process the transcription result from v3 API
   * 
   * @param result - Raw API result
   * @param processingTime - Processing time in seconds
   * @param client - Supabase client
   * @returns Formatted transcription result
   */
  private async processTranscriptionResult(
    result: any,
    processingTime: number,
    client: SupabaseClient,
    options: YandexV3TranscriptionOptions
  ): Promise<TranscriptionResult> {
    // console.log(`Processing v3 transcription result: ${JSON.stringify(result)}`);
    
    // Check if we have any data to process
    if (!result.result || 
        (!result.result.finalRefinements?.length && 
         !result.result.alternatives?.length && 
         !result.result.speakerAnalysis?.length)) {
      console.warn('No usable data found in the response');
      return {
        text: '',
        processingTime,
        timestamp: new Date().toISOString(),
        model: `yandex-v3/${options.model}`,
        rawResponse: result
      };
    }
    
    // Create maps to store utterances by speaker
    interface Utterance {
      text: string;
      startTime: number;
      endTime: number;
      confidence: number;
    }
    
    // Map to store the best utterance for each time segment by channel
    const utterancesByChannel: Record<string, Map<number, Utterance>> = {};
    
    // Track channels with refinements
    const refinementsFound: Record<string, boolean> = {};
    
    // Process refinements first (they're higher quality)
    for (const refinement of result.result.finalRefinements || []) {
      if (!refinement.channelTag) continue;
      
      const channelTag = refinement.channelTag.toString();
      
      // Initialize map for this channel if needed
      if (!utterancesByChannel[channelTag]) {
        utterancesByChannel[channelTag] = new Map();
      }
      
      // Track that we found refinements for this channel
      refinementsFound[channelTag] = true;
      
      // Find the corresponding alternative for timing information
      const matchingAlternative = result.result.alternatives?.find((alt: { channelTag: string; startTimeMs: string; endTimeMs: string }) => 
        alt.channelTag === refinement.channelTag && alt.startTimeMs && alt.endTimeMs
      );
      
      // Prioritize punctuated text if available (highest quality)
      if (refinement.punctuatedText && matchingAlternative) {
        // Check if we have word-level timestamps for more accuracy
        let startTime = parseInt(matchingAlternative.startTimeMs) / 1000;
        let endTime = parseInt(matchingAlternative.endTimeMs) / 1000;
        
        // If we have words with timestamps, use those instead of utterance-level timestamps
        if (matchingAlternative.words && matchingAlternative.words.length > 0) {
          const firstWord = matchingAlternative.words[0];
          const lastWord = matchingAlternative.words[matchingAlternative.words.length - 1];
          
          if (firstWord.startTimeMs) {
            startTime = parseInt(firstWord.startTimeMs) / 1000;
          }
          
          if (lastWord.endTimeMs) {
            endTime = parseInt(lastWord.endTimeMs) / 1000;
          }
        }
        
        // Use a rounded time key for grouping similar utterances
        const timeKey = Math.round(startTime * 2) / 2;
        
        utterancesByChannel[channelTag].set(timeKey, {
          text: refinement.punctuatedText,
          startTime: startTime,
          endTime: endTime,
          confidence: 0.95 // Highest confidence for punctuated text
        });
      }
      // Then try normalized text alternatives
      else if (refinement.normalizedText?.alternatives?.[0]) {
        const alternative = refinement.normalizedText.alternatives[0];
        
        if (alternative.text && alternative.startTimeMs && alternative.endTimeMs) {
          // Check if we have word-level timestamps for more accuracy
          let startTime = parseInt(alternative.startTimeMs) / 1000;
          let endTime = parseInt(alternative.endTimeMs) / 1000;
          
          // If we have words with timestamps, use those instead of utterance-level timestamps
          if (alternative.words && alternative.words.length > 0) {
            const firstWord = alternative.words[0];
            const lastWord = alternative.words[alternative.words.length - 1];
            
            if (firstWord.startTimeMs) {
              startTime = parseInt(firstWord.startTimeMs) / 1000;
            }
            
            if (lastWord.endTimeMs) {
              endTime = parseInt(lastWord.endTimeMs) / 1000;
            }
          }
          
          const timeKey = Math.round(startTime * 2) / 2;
          
          utterancesByChannel[channelTag].set(timeKey, {
            text: alternative.text,
            startTime: startTime,
            endTime: endTime,
            confidence: parseFloat(alternative.confidence) || 0.9
          });
        }
      }
    }
    
    // Second pass: use regular transcriptions as fallback for channels without refinements
    for (const alternative of result.result.alternatives || []) {
      if (!alternative.channelTag || !alternative.text || !alternative.startTimeMs || !alternative.endTimeMs) continue;
      
      const channelTag = alternative.channelTag.toString();
      
      // Skip if we already have refinements for this channel
      if (refinementsFound[channelTag]) continue;
      
      // Initialize map for this channel if needed
      if (!utterancesByChannel[channelTag]) {
        utterancesByChannel[channelTag] = new Map();
      }
      
      // Check if we have word-level timestamps for more accuracy
      let startTime = parseInt(alternative.startTimeMs) / 1000;
      let endTime = parseInt(alternative.endTimeMs) / 1000;
      
      // If we have words with timestamps, use those instead of utterance-level timestamps
      if (alternative.words && alternative.words.length > 0) {
        const firstWord = alternative.words[0];
        const lastWord = alternative.words[alternative.words.length - 1];
        
        if (firstWord.startTimeMs) {
          startTime = parseInt(firstWord.startTimeMs) / 1000;
        }
        
        if (lastWord.endTimeMs) {
          endTime = parseInt(lastWord.endTimeMs) / 1000;
        }
      }
      
      const timeKey = Math.round(startTime * 2) / 2;
      
      // Only add if we don't already have an utterance for this time
      if (!utterancesByChannel[channelTag].has(timeKey)) {
        utterancesByChannel[channelTag].set(timeKey, {
          text: alternative.text,
          startTime: startTime,
          endTime: endTime,
          confidence: parseFloat(alternative.confidence) || 0.8
        });
      }
    }
    
    // Create speakers array from speaker analysis data
    const speakers: Speaker[] = [];
    const speakerMap = new Map<string, string>();
    
    // Extract speaker information from speakerAnalysis if available
    for (const analysis of result.result.speakerAnalysis || []) {
      if (analysis.channelTag) {
        const channelTag = analysis.channelTag.toString();
        
        // Only add if not already in the map
        if (!speakerMap.has(channelTag)) {
          let speakerName = `speaker_${parseInt(channelTag) + 1}`;
          
          // Add gender information if available
          if (analysis.gender) {
            speakerName += ` (${analysis.gender === 'MALE' ? 'M' : analysis.gender === 'FEMALE' ? 'F' : 'U'})`;
          }
          
          speakerMap.set(channelTag, speakerName);
          
          speakers.push({
            id: channelTag,
            name: speakerName
          });
        }
      }
    }
    
    // If no speaker analysis was found, create basic speaker entries
    if (speakers.length === 0) {
      Object.keys(utterancesByChannel).forEach((channelTag, index) => {
        const speakerName = `speaker_${index + 1}`;
        speakerMap.set(channelTag, speakerName);
        
        speakers.push({
          id: channelTag,
          name: speakerName
        });
      });
    }
    
    // Create segments from utterances
    const segments: TranscriptionSegment[] = [];
    let segmentId = 0;
    
    // Process utterances for each speaker
    Object.entries(utterancesByChannel).forEach(([channelTag, utterancesMap]) => {
      const speakerName = speakerMap.get(channelTag) || `speaker_${parseInt(channelTag) + 1}`;
      
      // Convert the Map to an array of utterances sorted by time
      const sortedUtterances = Array.from(utterancesMap.entries())
        .sort(([timeA], [timeB]) => timeA - timeB)
        .map(([_, utterance]) => utterance);
      
      // Add each utterance as a segment
      sortedUtterances.forEach(utterance => {
        segments.push({
          id: segmentId++,
          seek: utterance.startTime,
          start: utterance.startTime,
          end: utterance.endTime,
          text: utterance.text,
          tokens: [], // Not provided by Yandex API
          temperature: 0, // Not provided by Yandex API
          avg_logprob: 0, // Not provided by Yandex API
          compression_ratio: 0, // Not provided by Yandex API
          no_speech_prob: 0, // Not provided by Yandex API
          speaker: speakerName
        });
      });
    });
    
    // Sort all segments by start time
    segments.sort((a, b) => a.start - b.start);


    // Create the initial transcription result
    const transcriptionResult: TranscriptionResult = {
      processingTime,
      timestamp: new Date().toISOString(),
      model: `yandex-v3/${options.model}`,
      text: '',
      content_json: {
        segments: segments
          .filter(segment => segment.text.trim().length > 0) // Filter out empty segments
          .map(segment => ({
            start_ms: Math.round(segment.start * 1000),
            end_ms: Math.round(segment.end * 1000),
            speaker: segment.speaker || 'speaker', // Will be updated by classification
            content: segment.text
          })),
        classified: false // Initially not classified
      },
      rawResponse: result
    };
    
    // Classify speaker roles and update the transcription
    try {
      await classifySpeakerRoles(client, transcriptionResult);
    } catch (error) {
      console.error('Error during speaker role classification:', error);
      // Continue with unclassified roles if there's an error
    }
    // Text formatting is now handled in the transcribeAudio function

    return transcriptionResult;
  }
  
  /**
   * Parse the response data from the Yandex API into a combined result object
   * 
   * @param data - Raw response data from the API
   * @returns Combined result object or null if parsing failed
   */
  private parseResponseData(data: string): any {
    // Define interfaces for the response structure
    interface Alternative {
      text?: string;
      words?: any[];
      startTimeMs?: string;
      endTimeMs?: string;
      confidence?: number;
      channelTag?: string;
      [key: string]: any;
    }
    
    interface SpeakerAnalysis {
      speakerTag?: string;
      channelTag?: string;
      [key: string]: any;
    }
    
    interface FinalRefinement {
      channelTag?: string;
      [key: string]: any;
    }
    
    interface EouUpdate {
      timeMs?: string;
      channelTag?: string;
      [key: string]: any;
    }
    
    // The response may contain multiple JSON objects
    // We need to parse them and combine them into a single result
    const jsonObjects = data.split(/\n|(?<=})(?={)/).filter(obj => obj.trim().length > 0);
    console.log(`Found ${jsonObjects.length} JSON objects in response`);
    
    if (jsonObjects.length === 0) {
      throw new Error('No valid JSON objects found in Yandex API response');
    }
    
    // Parse each JSON object
    const parsedObjects = [];
    for (const jsonObj of jsonObjects) {
      try {
        const parsed = JSON.parse(jsonObj.trim());
        parsedObjects.push(parsed);
      } catch (parseError) {
        console.warn(`Failed to parse JSON object: ${jsonObj.substring(0, 100)}...`, parseError);
        // Continue with other objects
      }
    }
    
    if (parsedObjects.length === 0) {
      throw new Error('Failed to parse any JSON objects from Yandex API response');
    }
      
    // Combine the results into a single object
    // We'll use the first object as the base and add arrays for different result types
    const combinedResult = {
      done: true,
      status: 'DONE',
      result: {
        alternatives: [] as Alternative[],
        speakerAnalysis: [] as SpeakerAnalysis[],
        finalRefinements: [] as FinalRefinement[],
        eouUpdates: [] as EouUpdate[],
        rawObjects: parsedObjects
      }
    };
    
    // Process each object based on its content
    for (const obj of parsedObjects) {
      if (obj.result) {
        // Extract alternatives
        if (obj.result.final && obj.result.final.alternatives) {
          const alternative: Alternative = {
            ...obj.result.final.alternatives[0],
            channelTag: obj.result.channelTag || obj.result.final.channelTag
          };
          combinedResult.result.alternatives.push(alternative);
        }
        
        // Extract speaker analysis
        if (obj.result.speakerAnalysis) {
          const analysis: SpeakerAnalysis = {
            ...obj.result.speakerAnalysis,
            channelTag: obj.result.channelTag
          };
          combinedResult.result.speakerAnalysis.push(analysis);
        }
        
        // Extract final refinements
        if (obj.result.finalRefinement) {
          const refinement: FinalRefinement = {
            ...obj.result.finalRefinement,
            channelTag: obj.result.channelTag
          };
          combinedResult.result.finalRefinements.push(refinement);
        }
        
        // Extract end-of-utterance updates
        if (obj.result.eouUpdate) {
          const eouUpdate: EouUpdate = {
            ...obj.result.eouUpdate,
            channelTag: obj.result.channelTag
          };
          combinedResult.result.eouUpdates.push(eouUpdate);
        }
      }
    }
    
    return combinedResult;
  }
}
