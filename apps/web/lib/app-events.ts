import type { ConsumerProvidedEventTypes } from '@kit/shared/events';

type Method = 'email' | 'google';
type ArtifactType =
  | 'session_therapist_summary'
  | 'session_client_summary'
  | 'client_prep_note'
  | 'client_conceptualization'
  | 'client_bio'
  | 'session_speaker_roles_classification';

export interface AppEvents extends ConsumerProvidedEventTypes {
  // Authentication
  UserSignedUp: {
    method: Method;
  };
  UserSignedIn: {
    method: Method;
  };
  UserSignedOut: Record<string, never>;
  UserPasswordResetRequested: Record<string, never>;
  UserPasswordResetCompleted: Record<string, never>;
  UserSessionExpired: {
    inactivityMinutes: number;
  };

  // Navigation
  ScreenViewed: {
    screen_name: string;
    referrer_screen?: string;
    via?: string;
  };
  ClientListViewed: Record<string, never>;
  ClientProfileViewed: {
    client_id: string;
  };
  SessionListViewed: {
    client_id?: string;
  };
  SessionDetailViewed: {
    session_id: string;
    client_id: string;
  };

  // Client Management
  ClientCreated: {
    client_id: string;
  };
  ClientUpdated: {
    field: 'name' | 'email' | 'phone';
  };

  // Session Management
  SessionDeleted: {
    session_id: string;
  };
  SessionNoteAdded: {
    session_id: string;
    note_length_chars: number;
  };
  SessionNoteUpdated: {
    session_id: string;
    change_size_chars: number;
  };

  // Recording
  RecordingStarted: {
    client_id: string;
  };
  RecordingPaused: {
    client_id: string;
  };
  RecordingResumed: {
    client_id: string;
  };
  RecordingCompleted: {
    session_id: string;
    client_id: string;
    duration_minutes: number;
  };
  RecordingAborted: {
    client_id: string;
  };
  RecordingFileImported: {
    session_id: string;
    client_id: string;
  };

  // Artifact
  ArtifactViewed: {
    client_id: string;
    session_id?: string;
    artifact_type: ArtifactType;
  };
  ArtifactCopied: {
    client_id: string;
    session_id?: string;
    artifact_type: ArtifactType;
  };


  // Settings
  SettingsViewed: Record<string, never>;
  SettingsUpdated: {
    field:
      | 'name'
      | 'email'
      | 'password'
      | 'avatar'
      | 'credentials'
      | 'country'
      | 'primaryTherapeuticApproach'
      | 'secondaryTherapeuticApproaches'
      | 'language'
      | 'use24HourClock'
      | 'useUSDateFormat';
  };

  // Help & Support
  HelpRequested: Record<string, never>;
} 