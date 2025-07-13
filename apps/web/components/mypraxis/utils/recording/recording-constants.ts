/**
 * Constants for recording functionality
 */

// Interval for sending heartbeats to the server (30 seconds)
export const HEARTBEAT_INTERVAL_MS = 30000;

// Threshold for considering a recording stale (in milliseconds)
// Allow up to 2 missing heartbeats before the recording is considered stale
export const STALE_RECORDING_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS*2;

// Minimum time to show the stale recording dialog (in milliseconds)
export const RECORDING_AUTO_DIALOG_MIN_DISPLAY_MS = 5000;

/**
 * The maximum allowed recording duration in seconds (2 hours).
 * This constant is shared between client and server.
 */
export const MAX_RECORDING_SECONDS = 2 * 60 * 60; // 2 hours

/**
 * The default auto-complete duration for a recording in seconds (75 minutes).
 * Used as the default value for the auto-complete selector in the UI.
 */
export const DEFAULT_AUTOCOMPLETE_RECORDING_AFTER_SECONDS = 75 * 60; // 75 minutes
