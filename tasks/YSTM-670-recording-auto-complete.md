# YSTM-670: Recording Modal – Auto-Complete Recording After X Seconds

## Overview
Add the ability for users to set a maximum duration (in minutes) after which a recording will be automatically completed. This should be enforced both in the UI and in the recording logic.

## Requirements

1. **New State Variable**
   - Add a new state variable `completeRecordingAfterSeconds` to the Recording Modal.

2. **UI for Setting Auto-Complete**
   - In the `soundCheck` modal state, display:
     - "Automatically complete recording after: [ ] minutes"
     - This should be an input that sets `completeRecordingAfterSeconds` (in seconds, but input in minutes).
     - The value should not be settable above `MAX_RECORDING_SECONDS` (see below).

3. **Constant for Max Recording Length**
   - Define a constant `MAX_RECORDING_SECONDS` (2 hours, in seconds).
   - This constant should be accessible in both client and server code.
   - The UI input for auto-complete should not allow values above this constant.

4. **Enforce Auto-Complete During Recording**
   - During the recording, if the timer exceeds `completeRecordingAfterSeconds`, do the following:
     - Display a `SavingAutoCompletedRecordingDialog` (similar to `showSavingStaleRecordingDialog`) for a minimum number of seconds.
     - Pause the recording.
     - Call `handleSaveSession` to save the recording.

5. **UX**
   - The dialog should be shown for a minimum display time (like the stale recording dialog).
   - The session list should refresh after auto-completion.

## Notes
- Ensure the constant is shared between client and server (e.g., via a shared config file).
- Follow existing UI and state management patterns in the modal.