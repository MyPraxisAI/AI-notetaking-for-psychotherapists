/**
 * Remaps uncommon file extensions to more common ones that tools like FFmpeg can work with.
 *
 * @param extension - The original file extension (including the dot).
 * @returns The remapped file extension or the original if no mapping is found.
 */
export function remapUncommonExtensions(extension: string): string {
  const extensionMap: Record<string, string> = {
    '.weba': '.webm', // WebM Audio should use .webm for FFmpeg
    '.mpga': '.mp3', // MPEG-1 Audio Layer I/II should use .mp3 for FFmpeg
    '.aif': '.aiff', // AIFF audio should use .aiff for FFmpeg
    '.oga': '.ogg', // Ogg Audio should use .ogg for FFmpeg
  };

  return extensionMap[extension] || extension;
} 