# YSTM-139: Google Analytics Event Reporting Implementation

## Overview
Implement Google Analytics event reporting throughout the application according to the following Product Requirements Document (PRD). This includes tracking authentication, navigation, client management, session management, artifact events, and internal performance metrics, with the specified event names and properties.

---

## PRD Summary

### 1. Authentication Events
- (x - part of Makerkit) **UserSignedUp**: Account created (`method`)
- (x - part of Makerkit) **UserSignedIn**: Login success (`method`)
- v **UserSignedOut**: User clicks sign-out
- v **UserPasswordResetRequested**: "Forgot password" clicked
- v **UserPasswordResetCompleted**: Password reset finished

### 2. Navigation Events
- v **ScreenViewed**: Any screen rendered (`screen_name`, `referrer_screen`, `via`)
- v **ClientListViewed**: Therapist opens client list 
- v **ClientProfileViewed**: Therapist opens profile (`client_id`)
- v **SessionListViewed**: Therapist lists sessions (`client_id` optional)
- v **SessionDetailViewed**: Therapist opens session (`session_id`, `client_id`)

### 3. Client Management Events
- v **ClientCreated**: Therapist adds client (`client_id`, `source`)
- v **ClientUpdated**: Profile edited (`client_id`, `fields_changed`)

### 4. Session Management Events
- v **SessionDeleted**: User deletes a session (`session_id`)
- v **SessionNoteUpdated**: User updates session notes (`session_id`, `change_size_chars`)
- v **SessionTranscriptViewed**: User views session transcript (`session_id`, `client_id`)
- **SessionTranscriptCopied**: User copies session transcript (`session_id`, `client_id`)
- v **SessionSummaryViewed**: User views session summary tab (`session_id`, `client_id`)

### 5. Recording Events
- v **RecordingStarted**: User starts a new recording (`client_id`)
- v **RecordingPaused**: User pauses a recording (`client_id`)
- v **RecordingResumed**: User resumes a recording (`client_id`)
- v **RecordingCompleted**: A recording is successfully completed (`session_id`, `client_id`, `duration_minutes`)
- v **RecordingAborted**: User abandons a recording in progress (`client_id`)
- v **RecordingFileImported**: User imports an audio file for a session (`session_id`, `client_id`)

### 6. Settings Events
- v **SettingsViewed**: User views the settings page
- v **SettingsUpdated**: User updates a field in the settings (`field_changed`)

### 7. Artifact Events
- v **ArtifactViewed**: Artifact opened (`client_id`, `session_id` (optional), `artifact_type`)
- v **ArtifactCopied**: User copies artifact text (`client_id`, `session_id` (optional), `artifact_type`)

### 8. Property Reference
See PRD for full property definitions and types.

---

## Implementation Tasks

### 1. Setup & Configuration
- [x] Add Google Analytics plugin to the project
- [x] Configure Google Analytics measurement IDs for different environments
- [x] Create a centralized event tracking utility/module
- [x] Define TypeScript types/interfaces for all event names and properties

### 2. Authentication Events
- [x] Track user sign-in, sign-out, and password reset events

### 3. Navigation Events
- [x] Track screen views and other major navigation actions

### 4. Recording Events
- [x] Track recording start, pause, resume, completion, abandonment, and file import events

### 5. Settings Events
- [x] Track settings page views and field updates

### 6. Client & Session Events
- [x] Track client list views, profile views, and session list/detail views
- [x] Track client creation and updates
- [ ] Track session creation, deletion, completion, and note events

### 7. Artifact Events
- [x] Track artifact views, copies

---

## Notes
- Ensure all user and account context is included with each event (user_id, role, etc.)
- Respect privacy and security best practices when reporting events
- Coordinate with product/analytics for property naming and event validation 

- [x] Track client list views, profile views, creations, and updates
- [x] Track session list views and detail views
- [x] Track recording start, pause, resume, completion, abandonment, and file import events
- [x] Track settings page views and field updates

### 6. Artifact Events
- [x] Track artifact views, copies, generation requests, completions, and failures

