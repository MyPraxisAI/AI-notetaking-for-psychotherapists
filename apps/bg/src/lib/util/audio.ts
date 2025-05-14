/**
 * Audio processing utility functions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { executeFFmpeg } from './ffmpeg';

// No longer needed as we're using the ffmpeg utility

/**
 * Combine audio chunks using FFmpeg
 * @param chunkFiles - Array of paths to the chunk files
 * @param outputFilePath - Path to write the combined audio file
 * @param standaloneChunks - Whether the chunks are standalone (complete WebM files) or not
 */
export async function combineAudioChunks(
  chunkFiles: string[], 
  outputFilePath: string, 
  standaloneChunks: boolean
): Promise<void> {
  try {
    if (standaloneChunks) {
      // For standalone chunks, create a filter complex for concatenation
      // This approach works well for complete WebM files
      const filterComplex = `concat=n=${chunkFiles.length}:v=0:a=1[outa]`;
      
      await executeFFmpeg({
        input: chunkFiles,
        output: outputFilePath,
        args: [
          '-filter_complex', filterComplex,
          '-map', '[outa]'
        ]
      });
    } else {
      // For non-standalone chunks, try direct binary concatenation
      // First, create a temporary file to hold the concatenated data
      const tempOutputPath = path.join(path.dirname(outputFilePath), 'temp_concat.webm');
      
      // Read all chunks and concatenate them
      const chunks = await Promise.all(chunkFiles.map(file => fs.promises.readFile(file)));
      const concatenated = Buffer.concat(chunks);
      
      // Write the concatenated data to a temporary file
      await fs.promises.writeFile(tempOutputPath, concatenated);
      
      // Use FFmpeg to validate and possibly fix the concatenated file
      await executeFFmpeg({
        input: tempOutputPath,
        output: outputFilePath,
        args: ['-c', 'copy']
      });
      
      // Clean up the temporary file
      try {
        await fs.promises.unlink(tempOutputPath);
      } catch (error) {
        console.warn(`Warning: Failed to clean up temporary file ${tempOutputPath}:`, error);
      }
    }
    
    if (!fs.existsSync(outputFilePath)) {
      throw new Error('FFmpeg did not create the output file');
    }
    
    return;
  } catch (error) {
    console.error('Error combining audio chunks with FFmpeg:', error);
    throw error;
  }
}
