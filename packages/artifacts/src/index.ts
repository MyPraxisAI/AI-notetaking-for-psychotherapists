/**
 * Dummy function to test the package import
 */
export function dummyArtifactFunction(): string {
  return 'Hello from @kit/artifacts package!';
}

/**
 * Basic artifact types that can be used across apps
 */
export type ArtifactType = 
  | 'session_therapist_summary' 
  | 'session_client_summary' 
  | 'client_prep_note' 
  | 'client_conceptualization' 
  | 'client_bio';
