/**
 * Audio processing utility functions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { executeFFmpeg } from './ffmpeg';
import { execSync } from 'child_process';
import { getBackgroundLogger, createLoggerContext } from '../logger';

/**
 * Maps file extensions to FFmpeg-compatible formats
 * @param extension - The original file extension (with dot)
 * @returns FFmpeg-compatible extension (with dot)
 */
function mapToFFmpegFormat(extension: string): string {
  const formatMap: Record<string, string> = {
    '.weba': '.webm', // WebM Audio should use .webm for FFmpeg
  };
  return formatMap[extension] || extension;
}

/**
 * Get audio file information using ffprobe
 * 
 * @param audioFilePath - Path to the audio file
 * @returns Object containing audio information (channels, codec, duration, etc.)
 */
export async function getAudioInfo(audioFilePath: string): Promise<{ 
  channels: number; 
  codec: string; 
  duration: number;
  sampleRate: number;
  bitrate: number;
}> {
  try {
    // Use ffprobe to get detailed audio information
    const command = `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,channels,sample_rate:format=duration,bit_rate -of json "${audioFilePath}"`;
    const output = execSync(command).toString().trim();
    const info = JSON.parse(output);
    
    // Extract relevant information
    const stream = info.streams?.[0] || {};
    const format = info.format || {};
    
    const result = {
      channels: parseInt(stream.channels) || 0,
      codec: stream.codec_name || '',
      sampleRate: parseInt(stream.sample_rate) || 0,
      duration: parseFloat(format.duration) || 0,
      bitrate: parseInt(format.bit_rate) || 0
    };
    
    console.log(`Audio file info for ${audioFilePath}:`, result);
    return result;
  } catch (error) {
    console.warn('Failed to get audio information using ffprobe:', error);
    // Return default values if ffprobe fails
    return {
      channels: 0,
      codec: '',
      duration: 0,
      sampleRate: 0,
      bitrate: 0
    };
  }
}

// No longer needed as we're using the ffmpeg utility

/**
 * Combine audio chunks using FFmpeg
 * @param chunkFiles - Array of paths to the chunk files
 * @param outputFilePath - Path to write the combined audio file (without extension)
 * @param standaloneChunks - Whether the chunks are standalone (complete audio files) or not
 * @returns The path to the combined audio file with extension
 */
export async function combineAudioChunks(
  chunkFiles: string[], 
  outputFilePath: string, 
  standaloneChunks: boolean
): Promise<string> {
  try {
    // If there's only one chunk, just use it directly instead of combining
    if (chunkFiles.length === 1) {
      console.log('Only one chunk found, using it directly without combining');
      // Get the extension from the original file and map it to FFmpeg format
      const extension = mapToFFmpegFormat(path.extname(chunkFiles[0]));
      const finalOutputPath = `${outputFilePath}${extension}`;
      
      // Move the single chunk to the output path (faster than copying)
      await fs.promises.rename(chunkFiles[0], finalOutputPath);
      return finalOutputPath;
    }
    
    // Get extension from the first chunk file and map it to FFmpeg format
    const extension = mapToFFmpegFormat(path.extname(chunkFiles[0]) || '.webm'); // Default to .webm if no extension
    const finalOutputPath = `${outputFilePath}${extension}`;
    
    if (standaloneChunks) {
      // For standalone chunks, create a filter complex for concatenation
      // This approach works well for complete audio files
      // Note: Didn't try this for real standalone chunks, but it also works for non-standalone (mp3s at least)
      const filterComplex = `concat=n=${chunkFiles.length}:v=0:a=1[outa]`;
      
      await executeFFmpeg({
        input: chunkFiles,
        output: finalOutputPath,
        args: [
          '-filter_complex', filterComplex,
          '-map', '[outa]'
        ]
      });
    } else {
      // For non-standalone chunks, try direct binary concatenation
      // First, create a temporary file to hold the concatenated data
      const tempOutputPath = path.join(path.dirname(outputFilePath), `temp_concat${extension}`);
      
      // Read all chunks and concatenate them
      const chunks = await Promise.all(chunkFiles.map(file => fs.promises.readFile(file)));
      const concatenated = Buffer.concat(chunks);
      
      // Write the concatenated data to a temporary file
      await fs.promises.writeFile(tempOutputPath, concatenated);
      
      // Use FFmpeg to validate and possibly fix the concatenated file
      await executeFFmpeg({
        input: tempOutputPath,
        output: finalOutputPath,
        args: ['-c', 'copy']
      });
      
      // Clean up the temporary file
      try {
        await fs.promises.unlink(tempOutputPath);
      } catch (error) {
        console.warn(`Warning: Failed to clean up temporary file ${tempOutputPath}:`, error);
      }
    }
    
    if (!fs.existsSync(finalOutputPath)) {
      throw new Error('FFmpeg did not create the output file');
    }
    
    return finalOutputPath;
  } catch (error) {
    const logger = await getBackgroundLogger();
    logger.error(createLoggerContext('audio', { error }), 'Error combining audio chunks');
    throw error;
  }
}
