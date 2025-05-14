/**
 * Utility functions for Yandex SpeechKit transcription
 */

import * as path from 'node:path';

/**
 * Check if the audio format is supported by Yandex SpeechKit
 * Supported formats: LPCM, OggOpus, MP3
 * 
 * @param filePath - Path to the audio file
 * @returns True if the format is supported, false otherwise
 */
export function isFormatSupported(filePath: string): boolean {
  const extension = filePath.split('.').pop()?.toLowerCase();
  return ['mp3', 'ogg', 'opus', 'wav'].includes(extension || '');
}

/**
 * Get the content type based on the file extension
 * 
 * @param filePath - Path to the audio file
 * @returns Content type string
 */
export function getContentType(filePath: string): string {
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
 * Convert audio to a format supported by Yandex SpeechKit
 * 
 * @param inputFilePath - Path to the input audio file
 * @returns Path to the converted audio file (or original if already supported)
 */
export async function convertToSupportedFormat(inputFilePath: string): Promise<string> {
  // Check if the format is already supported
  if (isFormatSupported(inputFilePath)) {
    console.log(`File format is already supported: ${inputFilePath}`);
    return inputFilePath;
  }
  
  console.log(`Converting file to supported format: ${inputFilePath}`);
  
  // Import ffmpeg utility
  const { executeFFmpegSync } = require('../../ffmpeg');
  
  // Generate output file path
  const outputFilePath = `${inputFilePath}.mp3`;
  
  // Convert to MP3 format with mono output (ac=1)
  const ffmpegCommand = `-i "${inputFilePath}" -vn -ar 44100 -ac 1 -b:a 128k "${outputFilePath}"`;
  
  // Execute ffmpeg command with proper options object
  await executeFFmpegSync({
    input: inputFilePath,
    output: outputFilePath,
    args: ['-vn', '-ar', '44100', '-ac', '1', '-b:a', '128k']
  });
  console.log(`Converted file to: ${outputFilePath}`);
  return outputFilePath;
}
