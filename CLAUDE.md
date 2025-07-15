# Claude Memory

## Database Tests
- Run database tests with: `pnpm db:test`
- This executes the supabase db test command via the workspace scripts

## Recent Changes
- Updated transcript database tests to use `content_json` instead of `content` column
- The `content_json` field stores JSON data matching the Transcript interface:
  ```typescript
  interface Transcript {
    segments: TranscriptSegment[];
  }
  
  interface TranscriptSegment {
    start_ms: number;
    end_ms: number;
    speaker: string;
    content: string;
  }
  ```