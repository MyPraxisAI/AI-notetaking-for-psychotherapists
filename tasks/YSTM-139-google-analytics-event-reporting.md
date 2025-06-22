# YSTM-139: Google Analytics Event Reporting Implementation

## Overview
Implement Google Analytics event reporting throughout the application according to the following Product Requirements Document (PRD). This includes tracking authentication, navigation, client management, session management, artifact events, and internal performance metrics, with the specified event names and properties.

---

## PRD Summary

### 1. Authentication Events
- **UserSignedUp**: Account created (`method`)
- **UserSignedIn**: Login success (`method`)
- **UserSignedOut**: User clicks sign-out
- **UserPasswordResetRequested**: "Forgot password" clicked
- **UserPasswordResetCompleted**: Password reset finished
- **UserSessionExpired**: Token refresh fails (`inactivityMinutes`)

### 2. Navigation Events
- **ScreenViewed**: Any screen rendered (`screen_name`, `referrer_screen`, `via`)
- **ClientListViewed**: Therapist opens client list
- **ClientProfileViewed**: Therapist opens profile (`client_id`)
- **SessionListViewed**: Therapist lists sessions (`client_id` optional)
- **SessionDetailViewed**: Therapist opens session (`session_id`, `client_id`)

### 3. Client Management Events
- **ClientCreated**: Therapist adds client (`client_id`, `source`)
- **ClientUpdated**: Profile edited (`client_id`, `fields_changed`)

### 4. Session Management Events
- **SessionCreated**: Start recording of new session (`session_id`, `client_id`)
- **SessionDeleted**: Session removed (`session_id`)
- **SessionCompleted**: Therapist marks finish recording (`session_id`, `duration_minutes`)
- **SessionNoteAdded**: Note created (`session_id`, `note_length_chars`)
- **SessionNoteUpdated**: Note edited (`session_id`, `change_size_chars`)

### 5. Artifact Events
- **ArtifactViewed**: Artifact opened (`artifact_id`, `artifact_type`, `via`)
- **ArtifactCopied**: Copy to clipboard (`artifact_id`)
- **ArtifactGenerationRequested**: Therapist clicks generate (`artifact_type`, `prompt_length`)
- **ArtifactGenerationCompleted**: Generation done (`artifact_id`, `duration_ms`)
- **ArtifactGenerationFailed**: Generation error (`artifact_type`, `error_message`)

### 6. Performance (Internal Metrics)
- **PerformanceMetric**: (`metric`, `duration_ms`, `endpoint`)

### 7. Property Reference
See PRD for full property definitions and types.

---

## Implementation Tasks

1. **Google Analytics Integration**
   - [ ] Add Google Analytics SDK to the project (web and server as needed)
   - [ ] Configure Google Analytics project tokens and environments
   - [ ] Set up Google Analytics initialization logic

2. **Event Tracking Utilities**
   - [ ] Create a centralized event tracking utility/module
   - [ ] Define TypeScript types/interfaces for all event names and properties
   - [ ] Ensure utility supports all required event properties and context (user, device, app version, etc.)

3. **Authentication Events**
   - [ ] Fire events at appropriate points in the authentication flow (sign up, sign in, sign out, password reset, session expiry)

4. **Navigation Events**
   - [ ] Track screen/page views and navigation events with required properties
   - [ ] Ensure referrer and via/source are captured

5. **Client Management Events**
   - [ ] Track client creation and updates, including property changes

6. **Session Management Events**
   - [ ] Track session creation, deletion, completion, and note events

7. **Artifact Events**
   - [ ] Track artifact views, copies, generation requests, completions, and failures

8. **Performance Metrics (Server-side)**
   - [ ] Implement server-side event reporting for internal performance metrics

9. **Testing & QA**
   - [ ] Validate that all events fire with correct properties in all relevant flows
   - [ ] Add automated and/or manual tests for event reporting

10. **Documentation**
    - [ ] Document event names, properties, and usage for future reference

---

## Notes
- Ensure all user and account context is included with each event (user_id, role, etc.)
- Respect privacy and security best practices when reporting events
- Coordinate with product/analytics for property naming and event validation 