/**
 * Common types and utilities for Yandex SpeechKit transcription
 */

import { BaseTranscriptionProvider, TranscriptionResult } from '../../transcription';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import * as https from 'node:https';
import * as crypto from 'node:crypto';
import { getContentType } from './utils';

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
 * Base class for Yandex SpeechKit transcription providers
 */
export abstract class YandexBaseProvider {
  protected apiKey: string;
  protected folderId: string;
  protected storageBucket: string;
  protected accessKeyId: string | null = null;
  protected secretAccessKey: string | null = null;
  protected apiEndpoint: string = 'stt.api.cloud.yandex.net';
  protected longAudioApiEndpoint: string = 'transcribe.api.cloud.yandex.net';
  protected storageEndpoint: string = 'storage.yandexcloud.net';

  constructor() {
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
   * Get the authorization header for Yandex Cloud API authentication
   * @returns Authorization header value
   */
  protected getAuthorizationHeader(): string {
    // Using API key authentication as documented in
    // https://yandex.cloud/en/docs/speechkit/stt/transcribation
    return `Api-Key ${this.apiKey}`;
  }

  // Content type utility moved to utils.ts

  // Format support check moved to utils.ts

  /**
   * Create an S3 client for Yandex Object Storage
   * 
   * @returns S3 client instance
   */
  protected createS3Client(): S3Client {
    return new S3Client({
      region: 'ru-central1',
      endpoint: `https://${this.storageEndpoint}`,
      credentials: {
        accessKeyId: this.accessKeyId || '',
        secretAccessKey: this.secretAccessKey || ''
      },
      forcePathStyle: true // Required for Yandex Object Storage
    });
  }

  /**
   * Upload an audio file to Yandex Object Storage
   * 
   * @param audioFilePath - Path to the audio file
   * @returns Storage URI for the uploaded file
   */
  protected async uploadToObjectStorage(audioFilePath: string): Promise<string> {
    // Generate a unique object key for the file
    const fileName = path.basename(audioFilePath);
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const objectKey = `transcription/${timestamp}-${randomString}-${fileName}`;
    
    // Get the file content
    const fileContent = fs.readFileSync(audioFilePath);
    const contentType = getContentType(audioFilePath);
    
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
   * Delete a file from Yandex Object Storage
   * @param storageUri URI of the file to delete
   */
  protected async deleteFromObjectStorage(storageUri: string): Promise<void> {
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
   * Estimate audio duration in seconds using ffprobe or file size fallback
   * 
   * @param audioFilePath - Path to the audio file
   * @returns Estimated duration in seconds
   */
  protected async estimateAudioDuration(audioFilePath: string): Promise<number> {
    try {
      // Use ffprobe to get the duration (more accurate)
      const { execSync } = require('child_process');
      const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFilePath}"`;
      const output = execSync(command).toString().trim();
      const duration = parseFloat(output);
      
      if (!isNaN(duration)) {
        console.log(`Estimated audio duration using ffprobe: ${duration} seconds`);
        return duration;
      }
    } catch (error) {
      console.warn('Failed to get audio duration using ffprobe:', error);
    }
    
    // Fallback: Estimate based on file size
    // Rough estimate: ~10KB per second for MP3 at 128kbps
    try {
      const stats = fs.statSync(audioFilePath);
      const fileSizeInBytes = stats.size;
      const estimatedDuration = fileSizeInBytes / (10 * 1024);
      console.log(`Estimated audio duration using file size: ${estimatedDuration} seconds`);
      return estimatedDuration;
    } catch (error) {
      console.warn('Failed to get audio file size:', error);
      return 60; // Default to 1 minute if all estimation methods fail
    }
  }

  // Audio format conversion moved to utils.ts
}
