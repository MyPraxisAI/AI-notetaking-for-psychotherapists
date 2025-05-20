/**
 * Utility functions for Yandex SpeechKit transcription
 */

import * as path from 'node:path';

/**
 * Check if the audio format is supported by Yandex SpeechKit
 * Yandex only supports single-channel MP3 format
 * 
 * @param filePath - Path to the audio file
 * @returns True if the format is supported, false otherwise
 */
export async function isFormatSupported(filePath: string): Promise<boolean> {
  // First check the file extension
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (extension !== 'mp3') {
    console.log(`File extension ${extension} is not supported by Yandex (only mp3 is supported)`);
    return false;
  }
  
  // Import the getAudioInfo function from audio.ts
  const { getAudioInfo } = require('../../audio');
  
  // Check audio properties using ffprobe
  const audioInfo = await getAudioInfo(filePath);
  
  // Yandex requires single-channel (mono) audio
  if (audioInfo.channels !== 1) {
    console.log(`File has ${audioInfo.channels} channels, but Yandex requires 1 channel (mono)`);
    return false;
  }
  
  console.log(`File format is supported by Yandex: ${filePath} (mp3, mono)`);
  return true;
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
 * Yandex requires single-channel (mono) MP3 format
 * 
 * @param inputFilePath - Path to the input audio file
 * @returns Path to the converted audio file (or original if already supported)
 */
export async function convertToSupportedFormat(inputFilePath: string): Promise<string> {
  // Check if the format is already supported
  const isSupported = await isFormatSupported(inputFilePath);
  if (isSupported) {
    console.log(`File format is already supported by Yandex: ${inputFilePath}`);
    return inputFilePath;
  }
  
  console.log(`Converting file to Yandex-supported format (mono MP3): ${inputFilePath}`);
  
  // Import ffmpeg utility
  const { executeFFmpegSync } = require('../../ffmpeg');
  
  // Generate output file path
  const outputFilePath = `${inputFilePath}.mp3`;
  
  // Convert to MP3 format with mono output (ac=1)
  // Sample rate 44.1kHz, bitrate 128k
  await executeFFmpegSync({
    input: inputFilePath,
    output: outputFilePath,
    args: ['-vn', '-ar', '44100', '-ac', '1', '-b:a', '128k']
  });
  
  console.log(`Converted file to Yandex-compatible format: ${outputFilePath}`);
  
  // Verify the converted file is now supported
  const convertedIsSupported = await isFormatSupported(outputFilePath);
  if (!convertedIsSupported) {
    console.warn(`Warning: Converted file still not supported by Yandex: ${outputFilePath}`);
  }
  
  return outputFilePath;
}
