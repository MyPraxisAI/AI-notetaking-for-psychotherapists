/**
 * Constants for recording functionality
 */

// Interval for sending heartbeats to the server (30 seconds)
export const HEARTBEAT_INTERVAL_MS = 30000;

// Threshold for considering a recording stale (in milliseconds)
// Allow up to 2 missing heartbeats before the recording is considered stale
export const STALE_RECORDING_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS*2;

// Minimum time to show the stale recording dialog (in milliseconds)
export const STALE_RECORDING_DIALOG_MIN_DISPLAY_MS = 4000;
