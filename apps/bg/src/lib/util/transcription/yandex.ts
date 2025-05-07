/**
 * Yandex transcription provider implementation
 */

import { BaseTranscriptionProvider, TranscriptionResult } from '../transcription';
import { executeFFmpegSync } from '../ffmpeg';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Language codes supported by Yandex SpeechKit
 */
export type YandexLanguageCode = 
  | 'auto'     // Automatic language detection
  | 'ru-RU'    // Russian
  | 'en-US'    // English (US)
  | 'de-DE'    // German
  | 'es-ES'    // Spanish
  | 'fi-FI'    // Finnish
  | 'fr-FR'    // French
  | 'he-IL'    // Hebrew
  | 'it-IT'    // Italian
  | 'kk-KZ'    // Kazakh
  | 'nl-NL'    // Dutch
  | 'pl-PL'    // Polish
  | 'pt-PT'    // Portuguese (Portugal)
  | 'pt-BR'    // Portuguese (Brazil)
  | 'sv-SE'    // Swedish
  | 'tr-TR'    // Turkish
  | 'uz-UZ'    // Uzbek
  | string;    // Allow custom language codes for future expansion

/**
 * Model types available in Yandex SpeechKit
 */
export type YandexModelType = 
  | 'general'            // The main version of the model
  | 'general:rc'         // Release candidate version for testing
  | 'general:deprecated' // Previous version (supported for ~2 weeks after update)
  | 'deferred-general';  // For asynchronous recognition with API v2

/**
 * Options for Yandex SpeechKit transcription
 */
export interface YandexTranscriptionOptions {
  model: YandexModelType;
  language?: YandexLanguageCode;
  profanityFilter?: boolean;      // Filter out profanity in the transcription
  topic?: string;                 // Topic hint to improve recognition accuracy
  literatureText?: boolean;       // Format text as literature (punctuation, etc.)
  partialResults?: boolean;       // Return partial results during recognition
}

/**
 * Default transcription options for therapy sessions using Yandex SpeechKit
 */
export const defaultYandexTranscriptionOptions: YandexTranscriptionOptions = {
  model: 'general',            // Use the main version of the model (0.16x realtime - 10 mins / hour)
  language: 'auto',            // Automatic language detection
  topic: 'psychology',         // Psychology domain for better recognition of therapy terminology
  literatureText: true,        // Enable better punctuation and formatting
  profanityFilter: false       // Don't filter profanity as it might be relevant in therapy context
};

/**
 * Yandex transcription provider
 */
export class YandexTranscriptionProvider extends BaseTranscriptionProvider {
  private apiKey: string;
  private folderId: string;
  private storageBucket: string;
  private accessKeyId: string | null = null;
  private secretAccessKey: string | null = null;
  private apiEndpoint: string = 'stt.api.cloud.yandex.net';
  private longAudioApiEndpoint: string = 'transcribe.api.cloud.yandex.net';
  private storageEndpoint: string = 'storage.yandexcloud.net';

  constructor() {
    super();
    
    // Check if Yandex API credentials are set
    if (!process.env.YANDEX_API_KEY) {
      throw new Error('YANDEX_API_KEY environment variable is not set');
    }
    
    if (!process.env.YANDEX_FOLDER_ID) {
      throw new Error('YANDEX_FOLDER_ID environment variable is not set');
    }
    
    if (!process.env.YANDEX_STORAGE_BUCKET) {
      throw new Error('YANDEX_STORAGE_BUCKET environment variable is not set');
    }
    
    this.apiKey = process.env.YANDEX_API_KEY;
    this.folderId = process.env.YANDEX_FOLDER_ID;
    this.storageBucket = process.env.YANDEX_STORAGE_BUCKET;
    
    // Check for static access keys for Object Storage
    if (process.env.YANDEX_ACCESS_KEY_ID && process.env.YANDEX_SECRET_ACCESS_KEY) {
      this.accessKeyId = process.env.YANDEX_ACCESS_KEY_ID;
      this.secretAccessKey = process.env.YANDEX_SECRET_ACCESS_KEY;
      console.log('Using static access keys for Yandex Object Storage');
    } else {
      throw new Error('YANDEX_ACCESS_KEY_ID and YANDEX_SECRET_ACCESS_KEY needed for Yandex Object Storage are not set.');
    }
  }
  
  /**
   * Get the content type based on the file extension
   * @param filePath - Path to the audio file
   * @returns Content type string
   */
  private getContentType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'mp3':
        return 'audio/mpeg';
      case 'ogg':
        return 'audio/ogg';
      case 'opus':
        return 'audio/opus';
      case 'wav':
        return 'audio/wav';
      case 'webm':
        return 'audio/webm';
      default:
        return 'application/octet-stream';
    }
  }
  
  /**
   * Get the authorization header for Yandex Cloud API authentication
   * @returns Authorization header value
   */
  private getAuthorizationHeader(): string {
    // Using API key authentication as documented in
    // https://yandex.cloud/en/docs/speechkit/stt/transcribation
    return `Api-Key ${this.apiKey}`;
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
    // Set default options for therapy sessions if not provided
    const transcriptionOptions: YandexTranscriptionOptions = {
      ...defaultYandexTranscriptionOptions,
      ...options
    };
    
    console.log(`Transcribing audio file: ${audioFilePath} using Yandex SpeechKit model: ${transcriptionOptions.model}`);
    const startTime = Date.now();
    
    // Variables for cleanup in finally block
    let tempFilePath: string | null = null;
    let convertedFilePath: string | null = null;
    
    try {
      // Create a temporary file from the audio buffer
      tempFilePath = await this.createTempFile(audioFilePath);
      
      // Convert audio to supported format if needed
      convertedFilePath = await this.convertToSupportedFormat(tempFilePath);
      
      // Read the audio file
      const fs = require('fs');
      const stats = fs.statSync(convertedFilePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      // Determine if we should use the long audio API based on file size
      // Short audio API is limited to 1MB according to Yandex docs
      const useLongAudioAPI = fileSizeInMB > 1;
      
      let result: TranscriptionResult;
      
      // if (useLongAudioAPI) {
       console.log(`File size is ${fileSizeInMB.toFixed(2)}MB (>1MB). Using long audio API with automatic storage upload.`);
        result = await this.transcribeLongAudio(convertedFilePath, transcriptionOptions);
      // } else {
      // !!!!!!!!!!! Currently transcribeShortAudio doesn't work - instead of converting audio to mp3 above, 
      //             ( need to convert to lpcm or oggopus, see https://yandex.cloud/en/docs/speechkit/stt/api/request-api ) !!!!!!!!!!!!!!!!
      //   console.log(`File size is ${fileSizeInMB.toFixed(2)}MB (≤1MB). Using short audio API with direct upload.`);
      //   result = await this.transcribeShortAudio(convertedFilePath, transcriptionOptions);
      // }
      
      return result;
    } catch (error) {
      console.error('Error during Yandex transcription:', error);
      throw error;
    } finally {
      // Clean up the temporary files
      if (tempFilePath) {
        await this.cleanupTempFile(tempFilePath);
      }
      
      // Clean up the converted file if it was created and is different from the temp file
      if (convertedFilePath && convertedFilePath !== tempFilePath) {
        try {
          const fs = require('fs');
          console.log(`Cleaning up temporary converted file: ${convertedFilePath}`);
          fs.unlinkSync(convertedFilePath);
        } catch (error: any) {
          console.warn(`Warning: Failed to clean up temporary converted file ${convertedFilePath}:`, error);
        }
      }
    }
  }
  
  /**
   * Transcribe a short audio file (< 1MB) using Yandex SpeechKit synchronous API
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param options - Options for transcription
   * @returns Transcription result
   */
  private async transcribeShortAudio(
    audioFilePath: string,
    transcriptionOptions: YandexTranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    // Read the audio file
    const fs = require('fs');
    const audioBuffer = fs.readFileSync(audioFilePath);
    
    // Get authorization header for authentication
    const authHeader = this.getAuthorizationHeader();
    
    // Prepare request options
    const https = require('https');
    const url = require('url');
    
    // Get the content type for the audio file
    const contentType = this.getContentType(audioFilePath);
  
    // Build the query parameters
    const queryParams = new URLSearchParams({
      folderId: this.folderId,
      lang: transcriptionOptions.language || 'auto',
      topic: transcriptionOptions.model,
      format: 'oggopus'
    }).toString();
    
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
  
  /**
   * Check if the audio format is supported by Yandex SpeechKit
   * Supported formats: LPCM, OggOpus, MP3
   * 
   * @param filePath - Path to the audio file
   * @returns True if the format is supported, false otherwise
   */
  private isFormatSupported(filePath: string): boolean {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    // Yandex SpeechKit supports MP3, OGG (Opus), and LPCM (raw PCM without WAV header)
    return ['mp3', 'ogg', 'opus'].includes(extension || '');
  }
  
  /**
   * Convert audio to a format supported by Yandex SpeechKit
   * 
   * @param inputFilePath - Path to the input audio file
   * @returns Path to the converted audio file (or original if already supported)
   */
  private async convertToSupportedFormat(inputFilePath: string): Promise<string> {
    if (this.isFormatSupported(inputFilePath)) {
      console.log(`Audio format is already supported: ${inputFilePath}`);
      return inputFilePath;
    }
    
    const path = require('path');
    const fs = require('fs');
    
    // Create a temporary output file with .mp3 extension
    const outputFilePath = `/tmp/${path.basename(inputFilePath, path.extname(inputFilePath))}.mp3`;
    
    console.log(`Converting audio to MP3 format: ${inputFilePath} -> ${outputFilePath}`);
    
    try {
      // Use ffmpeg to convert the audio file to MP3 format
      executeFFmpegSync({
        input: inputFilePath,
        output: outputFilePath,
        args: ['-c:a', 'libmp3lame', '-q:a', '4']
      });
      
      console.log('Audio conversion completed successfully');
      return outputFilePath;
    } catch (error: any) {
      console.error('Error converting audio format:', error);
      throw new Error(`Failed to convert audio format: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Transcribe a long audio file (> 1MB) using Yandex SpeechKit asynchronous API
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param options - Options for transcription
   * @returns Transcription result
   */
  private async transcribeLongAudio(
    audioFilePath: string,
    transcriptionOptions: YandexTranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    let storageUri: string | null = null;
    
    try {
      // Get authorization header for authentication
      const authHeader = this.getAuthorizationHeader();
      
      // Prepare request options
      const https = require('https');
      const url = require('url');
      const fs = require('fs');
      
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
    const https = require('https');
    const url = require('url');
    
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
   * Create an S3 client for Yandex Object Storage
   * 
   * @returns S3 client instance
   */
  private createS3Client(): S3Client {
    if (!this.accessKeyId || !this.secretAccessKey) {
      throw new Error('Static access keys for Yandex Object Storage are not set');
    }
    
    // Create S3 client for Yandex Object Storage
    return new S3Client({
      region: 'ru-central1',
      endpoint: `https://${this.storageEndpoint}`,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey
      },
      forcePathStyle: false 
    });
  }

  /**
   * Upload an audio file to Yandex Object Storage
   * 
   * @param audioFilePath - Path to the audio file
   * @returns Storage URI for the uploaded file
   */
  private async uploadToObjectStorage(audioFilePath: string): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    
    // Generate a unique object key for the file
    const fileName = path.basename(audioFilePath);
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const objectKey = `transcription/${timestamp}-${randomString}-${fileName}`;
    
    // Get the file content
    const fileContent = fs.readFileSync(audioFilePath);
    const contentType = this.getContentType(audioFilePath);
    
    // Log upload parameters for debugging
    console.log('Yandex Object Storage Upload Parameters:');
    if (this.accessKeyId) {
      console.log(`- Access Key ID (first 4 chars): ${this.accessKeyId.substring(0, 4)}...`);
      console.log('- Using S3 client for authentication');
    } else {
      console.log(`- API Key (first 4 chars): ${this.apiKey.substring(0, 4)}...`);
      console.log('- Using API Key authentication (not recommended for Object Storage)');
      throw new Error('Static access keys for Yandex Object Storage are required');
    }
    console.log(`- Folder ID: ${this.folderId}`);
    console.log(`- Storage Bucket: ${this.storageBucket}`);
    console.log(`- Storage Endpoint: ${this.storageEndpoint}`);
    console.log(`- Object Key: ${objectKey}`);
    console.log(`- Content Type: ${contentType}`);
    console.log(`- File Size: ${fileContent.length} bytes`);
    
    try {
      // Create S3 client
      const s3Client = this.createS3Client();
      
      // Create upload command
      const uploadParams = {
        Bucket: this.storageBucket,
        Key: objectKey,
        Body: fileContent,
        ContentType: contentType
      };
      
      console.log(`- Uploading to bucket: ${this.storageBucket} with key: ${objectKey}`);
      
      // Execute upload command
      const command = new PutObjectCommand(uploadParams);
      const response = await s3Client.send(command);
      
      console.log('- Upload successful');
      console.log(`- Response: ${JSON.stringify(response)}`);
      
      // Return the storage URI
      return `https://${this.storageBucket}.${this.storageEndpoint}/${objectKey}`;
    } catch (error: any) {
      console.error('- Upload failed:', error);
      throw new Error(`Failed to upload to Yandex Object Storage: ${error.message}`);
    }
  }
  
  /**
   * Estimate audio duration in seconds using ffprobe or file size fallback
   * 
   * @param audioFilePath - Path to the audio file
   * @returns Estimated duration in seconds
   */
  private async estimateAudioDuration(audioFilePath: string): Promise<number> {
    const fs = require('fs');
    const { execSync } = require('child_process');
    let durationSeconds = 0;
    
    try {
      // Use ffprobe to get the exact duration of the audio file
      const ffprobeCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFilePath}"`;
      const durationStr = execSync(ffprobeCommand).toString().trim();
      durationSeconds = Math.ceil(parseFloat(durationStr));
      
      console.log(`Audio duration from ffprobe: ${durationSeconds} seconds (${Math.floor(durationSeconds / 60)} minutes ${durationSeconds % 60} seconds)`);
    } catch (error) {
      // Fallback to file size estimation if ffprobe fails
      console.warn('Failed to get duration with ffprobe, falling back to file size estimation:', error);
      const stats = fs.statSync(audioFilePath);
      const fileSizeInBytes = stats.size;
      // Use a conservative estimate of 32KB per second (assuming decent quality audio)
      durationSeconds = Math.ceil(fileSizeInBytes / (32 * 1024));
      console.log(`Estimated audio duration (from file size): ${durationSeconds} seconds (${Math.floor(durationSeconds / 60)} minutes ${durationSeconds % 60} seconds)`);
    }
    
    return durationSeconds;
  }
  
  /**
   * Delete a file from Yandex Object Storage
   * @param storageUri URI of the file to delete
   */
  private async deleteFromObjectStorage(storageUri: string): Promise<void> {
    try {
      // Parse the URI to get the object key
      const parsedUrl = new URL(storageUri);
      const objectKey = parsedUrl.pathname.substring(1); // Remove leading slash
      
      console.log(`Deleting object from storage: ${this.storageBucket}/${objectKey}`);
      
      // Create S3 client
      const s3Client = this.createS3Client();
      
      // Create delete command
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.storageBucket,
        Key: objectKey,
      });
      
      // Execute delete command
      try {        
        const response = await s3Client.send(deleteCommand);
        console.log(`Successfully deleted object: ${JSON.stringify(response)}`);
      } catch (error) {
        console.warn(`Failed to delete from Yandex Object Storage:`, error);
        // Continue execution despite error
      }
    } catch (error) {
      // Just log the error but don't throw, as this is cleanup code
      console.warn('Error during storage cleanup:', error);
    }
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
    const https = require('https');
    const url = require('url');
    
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
