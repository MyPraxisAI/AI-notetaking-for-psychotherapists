/**
 * Utility functions for working with FFmpeg
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';

/**
 * Options for FFmpeg execution
 */
export interface FFmpegOptions {
  /**
   * Input file path or paths
   */
  input: string | string[];
  
  /**
   * Output file path
   */
  output: string;
  
  /**
   * Additional FFmpeg arguments
   */
  args?: string[];
  
  /**
   * Whether to overwrite the output file if it exists
   * @default true
   */
  overwrite?: boolean;
}

/**
 * Execute an FFmpeg command synchronously
 * 
 * @param options - FFmpeg options
 * @returns The command output
 */
export function executeFFmpegSync(options: FFmpegOptions): string {
  const { input, output, args = [], overwrite = true } = options;
  
  // Build input arguments
  const inputArgs = Array.isArray(input)
    ? input.map(i => `-i "${i}"`).join(' ')
    : `-i "${input}"`;
  
  // Build command with standard flags
  let command = `ffmpeg -nostdin -hide_banner ${inputArgs}`;
  
  // Add additional arguments
  if (args.length > 0) {
    command += ` ${args.join(' ')}`;
  }
  
  // Add output path and overwrite flag if needed
  command += ` "${output}"`;
  if (overwrite) {
    command += ' -y';
  }
  
  console.log(`Executing FFmpeg command: ${command}`);
  return execSync(command).toString();
}

/**
 * Execute an FFmpeg command asynchronously
 * 
 * @param options - FFmpeg options
 * @returns Promise resolving to the command output
 */
export async function executeFFmpeg(options: FFmpegOptions): Promise<string> {
  const { input, output, args = [], overwrite = true } = options;
  const execPromise = promisify(exec);
  
  // Build input arguments
  const inputArgs = Array.isArray(input)
    ? input.map(i => `-i "${i}"`).join(' ')
    : `-i "${input}"`;
  
  // Build command with standard flags
  let command = `ffmpeg -nostdin -hide_banner ${inputArgs}`;
  
  // Add additional arguments
  if (args.length > 0) {
    command += ` ${args.join(' ')}`;
  }
  
  // Add output path and overwrite flag if needed
  command += ` "${output}"`;
  if (overwrite) {
    command += ' -y';
  }
  
  console.log(`Executing FFmpeg command: ${command}`);
  const { stdout } = await execPromise(command);
  return stdout;
}
