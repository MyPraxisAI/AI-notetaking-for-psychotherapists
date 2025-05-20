/**
 * Utility functions for artifact generation and processing
 */

/**
 * Cleans up markdown code block markers from LLM responses
 * @param content The content to clean up
 * @returns The cleaned content without markdown code block markers
 */
export function cleanupMarkdownCodeBlocks(content: string): string {
  const trimmedContent = content.trim();
  
  // Check if content starts with ```markdown (or other language specifier) and ends with ```
  if (trimmedContent.startsWith('```') && trimmedContent.endsWith('```')) {
    // Find the first newline to skip the opening marker line
    const firstNewline = trimmedContent.indexOf('\n');
    if (firstNewline !== -1) {
      // Find the last ``` marker
      const lastMarkerPos = trimmedContent.lastIndexOf('```');
      
      // Extract the content between the markers
      const innerContent = trimmedContent.substring(firstNewline + 1, lastMarkerPos).trim();
      return innerContent;
    }
  }
  
  // If not wrapped in code blocks or format doesn't match, return original
  return content;
}
