/**
 * Audio processing utility functions
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

/**
 * Create input arguments for FFmpeg
 * @param chunkFiles - Array of paths to the chunk files
 * @returns Input arguments for FFmpeg
 */
export function createInputArgs(chunkFiles: string[]): string {
  // Create input arguments for FFmpeg (-i file1 -i file2 ...)
  return chunkFiles.map(file => `-i "${file}"`).join(' ');
}

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
  const execPromise = promisify(exec);
  
  try {
    let command: string;
    
    if (standaloneChunks) {
      // For standalone chunks, create a filter complex for concatenation
      // This approach works well for complete WebM files
      const inputArgs = createInputArgs(chunkFiles);
      const filterComplex = `"concat=n=${chunkFiles.length}:v=0:a=1[outa]"`;
      
      command = `ffmpeg -nostdin -hide_banner ${inputArgs} -filter_complex ${filterComplex} -map "[outa]" "${outputFilePath}"`;
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
      command = `ffmpeg -nostdin -hide_banner -i "${tempOutputPath}" -c copy "${outputFilePath}"`;
    }
    
    console.log(`Executing FFmpeg command: ${command}`);
    
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr) {
      console.log('FFmpeg stderr:', stderr);
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
