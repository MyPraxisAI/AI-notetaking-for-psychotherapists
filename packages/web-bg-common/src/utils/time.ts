/**
 * Format a timestamp in seconds to a human-readable format (MM:SS)
 * 
 * @param seconds - Time in seconds
 * @returns Formatted timestamp
 */
export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format a timestamp in seconds to a human-readable format with millisecond precision (MM:SS.mmm)
 * 
 * @param seconds - Time in seconds
 * @returns Formatted timestamp with millisecond precision
 */
export function formatTimestampWithMs(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toFixed(3).padStart(6, '0')}`;
}

/**
 * Format a timestamp in milliseconds to a human-readable format (MM:SS)
 * 
 * @param ms - Time in milliseconds
 * @returns Formatted timestamp
 */
export function formatTimestampMs(ms: number): string {
  return formatTimestamp(ms / 1000);
}
