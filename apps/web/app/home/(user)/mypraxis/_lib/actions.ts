/**
 * Client-side wrappers for server actions
 */

/**
 * Get transcript content for a session via API route
 * 
 * @param sessionId The session ID to get transcript content for
 * @returns The formatted transcript content
 */
export async function getTranscriptContent(sessionId: string) {
  const res = await fetch(`/api/transcript/${sessionId}`);
  if (!res.ok) throw new Error('Failed to fetch transcript content');
  return res.json();
}
