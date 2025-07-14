"use client"

import { useCallback, useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@kit/ui/button"
import { useAppEvents } from '@kit/shared/events';
import { useIsSuperAdmin } from "../../lib/client/utils/is-super-admin"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogHeader, DialogFooter } from "@kit/ui/dialog"
import { Mic, Pause, Play, Loader2, Upload, AlertTriangle, Volume2 } from "lucide-react"
import { MyPraxisAudioVisualizer } from "./utils/recording/visualizers/mypraxis-audio-visualizer"
import { AudioChunk, uploadAudioChunks, processAudioFile } from "./utils/recording/audio-upload"
import * as RecordingAPI from "./utils/recording/recording-api"
import * as MediaRecorderUtils from "./utils/recording/media-recorder"
import { HEARTBEAT_INTERVAL_MS, RECORDING_AUTO_DIALOG_MIN_DISPLAY_MS } from "./utils/recording/recording-constants"
import * as MicrophoneUtils from "./utils/recording/microphone-selection"
import type { MicrophoneDevice } from "./utils/recording/microphone-selection"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kit/ui/select"
import { HeadphoneWarning } from "./utils/recording/headphone-warning"
import { AppEvents } from '~/lib/app-events';
import { MAX_RECORDING_SECONDS, DEFAULT_AUTOCOMPLETE_RECORDING_AFTER_SECONDS } from './utils/recording/recording-constants';

const overlayStyles = `
  .recording-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 45;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease-in-out;
  }
  
  .recording-modal-overlay.active {
    opacity: 1;
    pointer-events: auto;
  }
`;

interface RecordingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (sessionId?: string) => Promise<void>
  clientId: string
  clientName: string
}

const TRANSCRIPTION_ENGINES = [
  'assemblyai-universal-auto',
  'yandex-v3-ru',
];

export function RecordingModal({
  isOpen,
  onClose,
  onSave,
  clientId,
  clientName
}: RecordingModalProps) {
  // Get the query client for cache invalidation
  const queryClient = useQueryClient()
  const { t } = useTranslation("mypraxis")
  const { emit } = useAppEvents<AppEvents>();
  const [modalState, setModalState] = useState<
    "initial" | "soundCheck" | "recording" | "paused" | "saving"
  >("initial")
  
  const [_isIntakeSession, _setIsIntakeSession] = useState(false)
  const [selectedClient, setSelectedClient] = useState(clientId)
  const [selectedClientName, setSelectedClientName] = useState(clientName)
  const [selectedDevice, setSelectedDevice] = useState("default")
  const [availableMicrophones, setAvailableMicrophones] = useState<MicrophoneDevice[]>([])
  const [isLoadingMicrophones, setIsLoadingMicrophones] = useState(false)
  const { data: isSuperAdmin = false } = useIsSuperAdmin()
  const [selectedTranscriptionEngine, setSelectedTranscriptionEngine] = useState<string | undefined>(undefined)
  const [timer, setTimer] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isMicrophoneChecking, setIsMicrophoneChecking] = useState(false)
  const [isResuming, setIsResuming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Use a ref to track the current timer value for direct access
  const currentTimerRef = useRef<number>(0)
  
  // MediaRecorder state
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<AudioChunk[]>([])
  
  // Lock for upload process to prevent concurrent executions
  const isUploading = useRef<boolean>(false)
  
  // Flag to track if recording has been aborted
  const isAborted = useRef<boolean>(false)
  
  // Constants for recording management
  
  // State for handling existing recordings
  const [showPausedRecordingDialog, setShowPausedRecordingDialog] = useState(false)
  const [showActiveRecordingDialog, setShowActiveRecordingDialog] = useState(false)
  const [existingRecordingData, setExistingRecordingData] = useState<RecordingAPI.ExistingRecordingResponse | null>(null)
  const [showSavingStaleRecordingDialog, setShowSavingStaleRecordingDialog] = useState(false)
  const [autoCompleteRecordingAfterSeconds, setAutoCompleteRecordingAfterSeconds] = useState<number>(DEFAULT_AUTOCOMPLETE_RECORDING_AFTER_SECONDS);
  const [showSavingAutoCompletedRecordingDialog, setShowSavingAutoCompletedRecordingDialog] = useState(false);
  
  // Ref to ensure auto-complete only triggers once per recording session
  const autoCompleteTriggeredRef = useRef(false);
  
  useEffect(() => {
    if (!document.getElementById('recording-modal-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'recording-modal-styles';
      styleElement.innerHTML = overlayStyles;
      document.head.appendChild(styleElement);
      
      return () => {
        const element = document.getElementById('recording-modal-styles');
        if (element) {
          element.remove();
        }
      };
    }
  }, []);
  
  // Function to load available microphones
  const loadAvailableMicrophones = useCallback(async () => {
    try {
      setIsLoadingMicrophones(true);
      const mics = await MicrophoneUtils.getAvailableMicrophones();
      setAvailableMicrophones(mics);
      
      // If we have microphones and no device is selected, select the default one
      if (mics.length > 0 && (!selectedDevice || selectedDevice === "default") && mics[0]?.deviceId) {
        setSelectedDevice(mics[0].deviceId);
      }
    } catch (error) {
      console.error('Error loading microphones:', error);
    } finally {
      setIsLoadingMicrophones(false);
    }
  }, [selectedDevice]);
  
  // This useEffect is moved after initializeMicrophone declaration

  // Manage heartbeats whenever recordingId exists and modal is open
  useEffect(() => {
    // Only start heartbeat if we have a recording ID and the modal is open
    if (recordingId && isOpen && (modalState === "recording" || modalState === "paused")) {
      // Send initial heartbeat immediately
      sendHeartbeat();
      
      // Setup interval for heartbeats
      heartbeatInterval.current = setInterval(() => {
        sendHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);
      
      // Cleanup function
      return () => {
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
      };
    }
  }, [recordingId, isOpen, modalState]); // eslint-disable-line react-hooks/exhaustive-deps
  // We're intentionally omitting sendHeartbeat from the deps array
  // because it's defined later in the file
  
  /**
   * Completes an existing recording and starts a new one
   * @param recordingId The ID of the recording to complete
   * @param options Options for starting a new recording
   * @returns The result of starting a new recording
   */
  const completeRecordingAndStartNew = async (recordingId: string, options: { standaloneChunks?: boolean } = {}): Promise<{ success: boolean; recordingId?: string }> => {
    // Show the saving stale recording dialog
    setShowSavingStaleRecordingDialog(true)
    
    try {
      // Create a minimum timer and complete the stale recording in parallel
      const minimumTimer = new Promise(resolve => setTimeout(resolve, RECORDING_AUTO_DIALOG_MIN_DISPLAY_MS))
      const completeRecordingPromise = RecordingAPI.completeRecording(recordingId)
      
      // Wait for both the timer and the API call to complete
      await Promise.all([minimumTimer, completeRecordingPromise])
      console.log('Completed recording:', recordingId)
      
      // Refresh the session list in column 4
      queryClient.invalidateQueries({ queryKey: ['sessions', clientId] })
      
      // Hide the dialog after ensuring it's been shown for at least a bit
      setShowSavingStaleRecordingDialog(false)
      
      // Try starting a new recording
      return await startRecording(options) // Return the result of the recursive call
    } catch (err) {
      console.error('Error completing recording:', err)
      setShowSavingStaleRecordingDialog(false)
      throw err
    }
  }

  const startRecording = async (options: { standaloneChunks?: boolean; completePausedExistingRecording?: boolean } = {}): Promise<{ success: boolean; recordingId?: string }> => {
    try {
      setIsProcessing(true)
      setError(null)
      
      const startRecordingPayload: RecordingAPI.StartRecordingOptions = {
        clientId: selectedClient,
        transcriptionEngine: selectedTranscriptionEngine || '',
        standaloneChunks: options.standaloneChunks
      };
      const result = await RecordingAPI.startRecording(startRecordingPayload);
      
      if (!result) {
        throw new Error('Failed to start recording')
      }
      
      // Check if result is an ExistingRecordingResponse (explicitly flagged)
      if (typeof result === 'object' && result.isExistingRecording) {
        // Handle existing recording case
        console.log('Existing recording detected:', result)
        
        // Recording exists with ID: result.id
        
        // Check if the recording is stale based on the flag from the API
        if (!result.isStale) {
          // Check if this is a paused recording
          if (result.status === 'paused') {
            // If completePausedExistingRecording is true, complete the paused recording and start a new one
            if (options.completePausedExistingRecording) {
              return await completeRecordingAndStartNew(result.id, options);
            }
            // Otherwise, show the paused recording dialog
            setExistingRecordingData(result)
            setShowPausedRecordingDialog(true)
            setIsProcessing(false)
            return { success: false } // Did not start a new recording
          } else {
            // Recent recording - likely active in another tab
            // No need to store the recording data since the dialog doesn't use it
            setShowActiveRecordingDialog(true)
            setIsProcessing(false)
            return { success: false } // Did not start a new recording
          }
        } else {
          return await completeRecordingAndStartNew(result.id, options)
        }
      }
      
      // Normal case - new recording started
      // At this point, result must be a string (the recording ID)
      const newRecordingId = result as string
      setRecordingId(newRecordingId)

      emit({
        type: 'RecordingStarted',
        payload: { client_id: selectedClient },
      });
      return { success: true, recordingId: newRecordingId } // Successfully started a new recording
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('mypraxis:recordingModal.errors.startFailed')
      setError(errorMessage)
      toast.error(errorMessage)
      return { success: false } // Failed to start a new recording due to error
    } finally {
      setIsProcessing(false)
    }
  }
  
  const pauseRecording = useCallback(async () => {
    if (!recordingId) return
    emit({
      type: 'RecordingPaused',
      payload: { client_id: selectedClient },
    });
    
    try {
      setIsProcessing(true)
      setError(null)
      
      const result = await RecordingAPI.pauseRecording(recordingId)
      
      if (!result) {
        throw new Error('Failed to pause recording')
      }
      
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause recording')
      toast.error(err instanceof Error ? err.message : 'Failed to pause recording')
      return null
    } finally {
      setIsProcessing(false)
    }
  }, [recordingId, selectedClient, emit, setIsProcessing, setError])
  
  const resumeRecording = async () => {
    if (!recordingId) return

    emit({
      type: 'RecordingResumed',
      payload: { client_id: selectedClient },
    });
        
    try {
      setError(null)
      
      const result = await RecordingAPI.resumeRecording(recordingId)
      
      if (result) {
        // Resume the MediaRecorder using the utility function
        if (mediaRecorder.current) {
          MediaRecorderUtils.resumeMediaRecorder(mediaRecorder.current);
        }
        
        setIsRecording(true)
        setModalState("recording")
        
        // Restart timer
        timerInterval.current = setInterval(() => {
          setTimer(prev => prev + 1)
        }, 1000)
        
        return result
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume recording')
      toast.error(err instanceof Error ? err.message : 'Failed to resume recording')
      return null
    }
  }
  
  const completeRecording = useCallback(async () => {
    if (!recordingId) return
    
    try {
      setIsProcessing(true)
      setError(null)
      
      const result = await RecordingAPI.completeRecording(recordingId)
      
      if (!result) {
        throw new Error('Failed to complete recording')
      }
      
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete recording')
      toast.error(err instanceof Error ? err.message : 'Failed to complete recording')
      return null
    } finally {
      setIsProcessing(false)
    }
  }, [recordingId, setIsProcessing, setError])
  
  const sendHeartbeat = async () => {
    if (!recordingId) return
    
    try {
      await RecordingAPI.sendHeartbeat(recordingId)
    } catch (err) {
      console.error('Heartbeat error:', err)
    }
  }
  
  useEffect(() => {
    if (isOpen) {
      setModalState("initial")
      setSelectedClient(clientId)
      setSelectedClientName(clientName)
      setTimer(0)
      setIsRecording(false)
      setRecordingId(null)
      setError(null)
      audioChunks.current = []
      
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
        timerInterval.current = null
      }
      
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current)
        heartbeatInterval.current = null
      }
    }
  }, [isOpen, clientId, clientName])
  
    // Setup MediaRecorder with the selected microphone device
  const setupMediaRecorder = useCallback(async () => {
      try {
        // Set up the MediaRecorder directly with the device ID
        // The MediaRecorderUtils.setupMediaRecorder will internally handle the audio constraints
        const recorder = await MediaRecorderUtils.setupMediaRecorder(
          {
            // Pass the selected device ID through the audio constraints
            deviceId: selectedDevice !== "default" ? selectedDevice : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1, // Mono for voice clarity
            audioBitsPerSecond: 128000 // 128 kbps for good quality voice
          },
          {
            onError: (error) => {
              console.error('setupMediaRecorder onError:', error);
              // Only show toast and error message if it's not a permission error (that's displayed separately)
              // The browser will throw a NotAllowedError for permission issues
              if (error.name !== 'NotAllowedError') {
                toast.error('Error during recording. Please try again.');
                setError(error.message || 'Recording error occurred. Please try again.');
              }
            },
            onDataAvailable: () => {} // This will be configured later in handleStartRecording
          }
        );
        
        if (recorder) {
          mediaRecorder.current = recorder;
          // Store the stream for visualization
          setMicrophoneStream(recorder.stream);
          console.log('MediaRecorder initialized successfully with selected device:', selectedDevice);
          return true;
        } else {
          throw new Error('Failed to initialize MediaRecorder');
        }
      } catch (err) {
        console.error('MediaRecorder creation error:', err);
        // Just return false to indicate failure - the initializeMicrophone function will handle the error
        return false;
      }
    }, [selectedDevice]);

  // Reinitialize MediaRecorder when selected device changes in sound check mode
  useEffect(() => {
    const updateMediaRecorder = async () => {
      // Only update if we're in soundCheck state and not currently processing
      if (modalState === "soundCheck" && !isProcessing) {
        // First, stop all microphone tracks from the current stream
        if (microphoneStream) {
          microphoneStream.getTracks().forEach(track => track.stop());
          setMicrophoneStream(null);
        }
        
        // Then clean up the MediaRecorder (which won't have a valid stream after we stopped the tracks)
        if (mediaRecorder.current) {
          try {
            // We don't actually need to call stop() on the MediaRecorder after stopping the tracks,
            // but we'll do it just to be thorough if it's active
            if (mediaRecorder.current.state !== "inactive") {
              mediaRecorder.current.stop();
            }
          } catch (err) {
            // This might error if the stream was already stopped
            console.warn('Error stopping previous MediaRecorder:', err);
          }
          mediaRecorder.current = null;
        }
        
        // Set up new MediaRecorder with the selected device
        try {
          await setupMediaRecorder();
          console.log(`MediaRecorder reinitialized with device: ${selectedDevice}`);
        } catch (err) {
          console.error('Failed to reinitialize MediaRecorder:', err);
        }
      }
    };
    
    updateMediaRecorder();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice, modalState, isRecording, isProcessing, setupMediaRecorder]); 
  // Deliberately omitting microphoneStream from dependencies to avoid circular reference
  // We're properly cleaning it up inside the effect before setting a new one
  
     /**
   * Clean up recording resources without aborting the recording in the API
   */
     const cleanupRecording = useCallback(async () => {
      // Clean up the MediaRecorder using the utility function
      if (mediaRecorder.current) {
        MediaRecorderUtils.cleanupMediaRecorder(mediaRecorder.current);
        mediaRecorder.current = null;
      }
      
      
      // Clear audio chunks to prevent any pending uploads
      audioChunks.current = [];
      
      // Reset recording state
      setIsRecording(false)
      setRecordingId(null)
      setTimer(0)
      setModalState("initial")
      setError(null)
      
      // Clear intervals
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
        timerInterval.current = null
      }
      
      // Note: Heartbeat interval is managed by the useEffect
    }, []);
  
  const handleClose = useCallback(() => {
    if (isRecording || modalState === "paused") {
      setShowConfirmDialog(true)
    } else {
      // For non-recording state, we can clean up without waiting
      cleanupRecording().then(() => {
        onClose()
      })
    }
  }, [isRecording, modalState, onClose, setShowConfirmDialog, cleanupRecording]);
  
  const handleConfirmClose = () => {
    setShowConfirmDialog(false)
    setIsProcessing(true)
    
    // For confirmed close during recording, show processing state and abort the recording
    abortRecording().then(() => {
      setIsProcessing(false)
      onClose()
    }).catch(() => {
      setIsProcessing(false)
      onClose()
    })
  }
  
  const handleCancelClose = () => {
    setShowConfirmDialog(false)
  }
  
  /**
   * Abort the recording in the API and then clean up resources
   */
  const abortRecording = async () => {
    emit({
      type: 'RecordingAborted',
      payload: { client_id: selectedClient },
    });

    // Set the aborted flag
    isAborted.current = true

    // If there's an active recording, delete it from the database
    if (recordingId && (isRecording || modalState === "paused")) {
      try {
        await RecordingAPI.abortRecording(recordingId);
        console.log('Recording deleted successfully:', recordingId);
      } catch (err) {
        console.error('Failed to delete recording:', err);
      }
    }
    
    // Clean up resources after aborting
    await cleanupRecording();
  }
  
  // State for microphone access error dialog
  const [showMicrophoneAccessErrorDialog, setShowMicrophoneAccessErrorDialog] = useState(false);
  // Removed microphoneErrorMessage state as we use consistent localized messages
  
  // Track the active microphone stream for visualization
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);

  // Initialize microphone and MediaRecorder in the soundCheck state
  const initializeMicrophone = useCallback(async () => {
    try {
      setIsMicrophoneChecking(true);
      setError(null);
      // This will prompt for permissions if needed
      await loadAvailableMicrophones(); // Load microphone list (will prompt for permission)
      const success = await setupMediaRecorder();
      if (!success) {
        // If setup fails, go back to initial state and show error dialog
        throw new Error('MICROPHONE_ACCESS_FAILED');
      }
    } catch (err) {
      console.error('Error initializing microphone:', err);
      // Show the error dialog with the translated message
      setShowMicrophoneAccessErrorDialog(true);
      // Return to initial state
      setModalState("initial");
    } finally {
      setIsMicrophoneChecking(false);
    }
  }, [setupMediaRecorder, loadAvailableMicrophones]);
  
  // Initialize microphone only when entering soundCheck state
  useEffect(() => {
    if (isOpen && modalState === "soundCheck") {
      // Only initialize microphone in soundCheck state
      initializeMicrophone();
    }
  }, [isOpen, modalState, initializeMicrophone]);
  
  const handleStartRecordingFlow = () => {
    // Simply transition to the sound check state
    // The microphone setup will happen in the useEffect that responds to the soundCheck state
    setModalState("soundCheck");
  }
  
  const handleStartRecording = async (options: { completePausedExistingRecording?: boolean } = {}) => {
    console.log('Starting recording...')
    
    // Reset timer to 0 before starting
    setTimer(0)
    currentTimerRef.current = 0
    
    // Reset audio chunks
    audioChunks.current = []
    
    
    const result = await startRecording(options)
    
    // If recording failed to start, exit early
    if (!result.success) {
      console.log('Previous recording exists, not recording')
      return
    }
    
    // Use the recording ID returned directly from the startRecording function
    // This avoids any issues with React state update timing
    if (!result.recordingId) {
      console.error('Recording ID is missing despite successful startRecording')
      return
    }
    
    // Explicitly log the recording ID to verify it's set
    console.log('Recording ID to be used:', result.recordingId)
    
    const currentRecordingId = result.recordingId
    
    // Start the MediaRecorder using the utility functions
    if (mediaRecorder.current) {
      console.log('Configuring MediaRecorder for chunks')
      
      // Configure the MediaRecorder to handle audio chunks
      MediaRecorderUtils.configureMediaRecorderForChunks(
        mediaRecorder.current,
        currentRecordingId,
        audioChunks,
        {
          onError: (error) => {
            console.error('MediaRecorder error:', error);
            toast.error('Error during recording. Please try again.');
            setError(error.message || 'Recording error occurred. Please try again.');
          },
          onDataAvailable: (event, metadata) => {
            if (event.data.size > 0) {
              // Log the chunk details
              console.log('ondataavailable event triggered', {
                dataSize: event.data.size,
                stateRecordingId: recordingId,
                currentRecordingId,
                timerState: timer,
                chunkNumber: metadata.chunkNumber,
                chunkStartTimeSec: metadata.startTime,
                chunkEndTimeSec: metadata.endTime
              });
              
              // Trigger upload of all pending chunks in the background
              handleUploadAudioChunks(currentRecordingId).catch(err => {
                console.error('Error uploading audio chunks:', err);
              });
            }
          }
        }
      );
      
      // Start the MediaRecorder with 4 minute chunks
      MediaRecorderUtils.startMediaRecorder(mediaRecorder.current, 4 * 60 * 1000);
      
      setIsRecording(true)
      setModalState("recording")
      
      // Start timer with synchronized ref
      timerInterval.current = setInterval(() => {
        const newTime = currentTimerRef.current + 1;
        currentTimerRef.current = newTime;
        setTimer(newTime);
      }, 1000)
      
      console.log('Recording started successfully')
    } else {
      console.error('MediaRecorder is not initialized')
    }
  }
  
  // Helper function to upload all pending audio chunks - now using the extracted function
  const handleUploadAudioChunks = useCallback(async (explicitRecordingId: string) => {
    // Don't attempt to upload if the recording has been aborted
    if (isAborted.current) {
      console.log('Recording has been aborted, skipping chunk upload');
      return false;
    }
    return await uploadAudioChunks(explicitRecordingId, audioChunks, isUploading);
  }, [audioChunks, isUploading]);
  
  // We're now using the imported uploadAudioChunkWithId function from utils/audio-upload.ts
  
  const handlePauseRecording = useCallback(async () => {
    try {
      setIsProcessing(true)
      
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
        timerInterval.current = null
      }
      
      await pauseRecording()
      // Go to local paused state independent of whether server pause succeeded

      // Pause the MediaRecorder using the utility function
      if (mediaRecorder.current) {
        MediaRecorderUtils.pauseMediaRecorder(mediaRecorder.current);
      }
      
      // Make sure all chunks are uploaded when pausing
      if (recordingId) {
        await handleUploadAudioChunks(recordingId).catch(err => {
          console.error('Error uploading chunks during pause:', err);
        });
      }
      
      setIsRecording(false)
      setModalState("paused")
      setIsProcessing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause recording')
      toast.error(err instanceof Error ? err.message : 'Failed to pause recording')
      setIsProcessing(false)
    }
  }, [handleUploadAudioChunks, recordingId, setIsRecording, setModalState, setIsProcessing, setError, pauseRecording]);
  
  const handleResumeRecording = async () => {
    try {
      setIsResuming(true)
      
      const result = await resumeRecording()
      
      if (result) {
        setIsResuming(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume recording')
      toast.error(err instanceof Error ? err.message : 'Failed to resume recording')
      setIsResuming(false)
    }
  }
  
  // Handle import button click - trigger file input
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };


  // Handle file selection - now using the extracted utility function
  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setIsImporting(true);
      setError(null);
      setUploadProgress(0);
      
      // 1. Create a new recording
      const startResult = await startRecording({ standaloneChunks: false });
      if (!startResult.success) {
        throw new Error('Failed to create recording');
      }
      
      // Use the recording ID returned directly from startRecording
      if (!startResult.recordingId) {
        throw new Error('Recording ID is missing despite successful start');
      }
      
      // 2. Process the file using our utility function
      const result = await processAudioFile(file, {
        recordingId: startResult.recordingId,
        onProgress: (current: number, total: number) => {
          const progress = Math.round((current / total) * 100);
          setUploadProgress(progress);
        },
        onError: (error: Error) => {
          setError(error.message);
          toast.error(error.message);
        }
      });
      
      if (result.sessionId) {
        emit({
          type: 'RecordingFileImported',
          payload: {
            session_id: result.sessionId,
            client_id: selectedClient,
          },
        });
      }

      // 3. Navigate to the session
      toast.success(t("recordingModal.import.success"));
      if (result.sessionId) {
        await onSave(result.sessionId);
      } else {
        await onSave();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("recordingModal.import.error"));
      toast.error(err instanceof Error ? err.message : t("recordingModal.import.error"));
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveSession = useCallback(async () => {
    try {
      setIsSaving(true)
      
      // Stop the MediaRecorder using the utility function
      if (mediaRecorder.current) {
        MediaRecorderUtils.stopMediaRecorder(mediaRecorder.current);
      }
      
      // Make sure all chunks are uploaded before completing the recording
      if (recordingId) {
        await handleUploadAudioChunks(recordingId).catch(err => {
          console.error('Error uploading final chunks:', err);
        });
      }
      
      // Complete the recording in the API
      const result = await completeRecording()
      
      // Log the result to see what we're getting back
      console.log('Recording complete result:', result)
      
      if (result) {
        emit({
          type: 'RecordingCompleted',
          payload: {
            session_id: result.sessionId,
            client_id: selectedClient,
            duration_minutes: Math.round(currentTimerRef.current / 60),
          },
        });

        // Just clean up resources without aborting the recording since it was successfully completed
        cleanupRecording()
        toast.success('Recording saved successfully')
        
        // Pass the session ID to the onSave callback for navigation
        if (result.sessionId) {
          await onSave(result.sessionId)
        } else {
          console.log('No session ID found in result:', result)
          await onSave()
        }
      } else {
        setIsSaving(false)
        toast.error('Failed to save recording. Please try again.')
      }
    } catch (error) {
      console.error('Error in handleSaveSession:', error)
      setIsSaving(false)
      toast.error('An error occurred while saving the recording.')
    }
  }, [cleanupRecording, completeRecording, handleUploadAudioChunks, recordingId, selectedClient, onSave, setIsSaving, emit]);
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      secs.toString().padStart(2, "0")
    ].join(":")
  }
  
  const [isBlinking, setIsBlinking] = useState(true)
  
  useEffect(() => {
    if (isRecording) {
      const blinkInterval = setInterval(() => {
        setIsBlinking(prev => !prev)
      }, 1000) 
      
      return () => clearInterval(blinkInterval)
    }
  }, [isRecording])
  
  useEffect(() => {
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
      }
    }
  }, [])
  
  useEffect(() => {
    if (modalState === "paused") {
      setIsSaving(false);
      setIsResuming(false);
    }
  }, [modalState]);
  
  // Memoized auto-complete handler to avoid unnecessary effect re-runs
  const handleAutoComplete = useCallback(async () => {
    setShowSavingAutoCompletedRecordingDialog(true);
    try {
      // Wait for minimum display time and save session
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, RECORDING_AUTO_DIALOG_MIN_DISPLAY_MS)),
        handlePauseRecording().then(() => handleSaveSession())
      ]);
    } catch (err) {
      // Log and show error if needed
      console.error('Auto-complete error:', err);
    } finally {
      setShowSavingAutoCompletedRecordingDialog(false);
    }
  }, [handlePauseRecording, handleSaveSession]);

  // Watch timer during recording for auto-complete
  useEffect(() => {
    if (
      modalState === 'recording' &&
      autoCompleteRecordingAfterSeconds > 0 &&
      timer >= autoCompleteRecordingAfterSeconds &&
      !autoCompleteTriggeredRef.current
    ) {
      autoCompleteTriggeredRef.current = true;
      // Auto-complete triggered
      handleAutoComplete();
    }
  }, [timer, modalState, autoCompleteRecordingAfterSeconds, handleAutoComplete]);

  // Reset auto-complete trigger ref when starting a new recording session or after user closes failure dialog
  useEffect(() => {
    if (modalState === 'recording') {
      autoCompleteTriggeredRef.current = false;
    }
  }, [modalState]);
  
  useEffect(() => {
    if (!isOpen) return;
    if (modalState === 'initial' || modalState === 'soundCheck') {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [isOpen, modalState, handleClose]);
  
  if (!isOpen) return null
  
  return (
    <>
      {/* Hidden element to track timer value for accurate chunk timing */}
      <div 
        id="recording-timer" 
        data-seconds={timer} 
        style={{ display: 'none' }}
      ></div>
      
      <div 
        className={`recording-modal-overlay ${isOpen ? 'active' : ''}`}
        onClick={handleClose}
      ></div>
      
      {isOpen && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50">
          <div className="relative bg-white rounded-lg w-full max-w-md mx-4 overflow-hidden">
            <button
              onClick={handleClose}
              aria-label="Close"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 rounded-full p-1"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Modal content starts here */}
            <div className="p-6 pb-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-medium text-center">{t("recordingModal.title")} <span className="underline">{selectedClientName}</span></h2>
            </div>

            {modalState === "soundCheck" && (
              <div className="p-4 bg-white">
                {/* Headphone warning message */}
                <div className="mb-6">
                  <HeadphoneWarning />
                </div>

                <h2 className="block text-sm font-medium text-gray-700">
                  {t("recordingModal.microphone.soundCheck")}
                </h2>

                <div>
                  <div className="flex items-center justify-center w-full h-full">
                    <MyPraxisAudioVisualizer stream={microphoneStream} />
                  </div>
                </div>

                {/* Device selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t("recordingModal.microphone.label")}
                  </label>
                  <Select value={selectedDevice} onValueChange={setSelectedDevice} data-test="microphone-select">
                    <SelectTrigger 
                      className="w-full" 
                      data-test="microphone-select-trigger"
                      disabled={isLoadingMicrophones}
                    >
                      {isLoadingMicrophones ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>{t("recordingModal.microphone.loading")}</span>
                        </div>
                      ) : (
                        <SelectValue placeholder={t("recordingModal.microphone.select")} />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {availableMicrophones.length > 0 ? (
                        availableMicrophones.map((mic) => (
                          <SelectItem 
                            key={mic.deviceId} 
                            value={mic.deviceId}
                            data-test={`microphone-option-${mic.deviceId}`}
                          >
                            {mic.label}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem 
                          value="default"
                          data-test="microphone-option-default"
                        >
                          {t("recordingModal.microphone.builtin")}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {
                <div className="mt-4 flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    {t('mypraxis:recordingModal.autoComplete.inputLabel')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_RECORDING_SECONDS / 60}
                    value={Math.floor(autoCompleteRecordingAfterSeconds / 60)}
                    onChange={e => {
                      let val = Number(e.target.value);
                      if (isNaN(val) || val < 1) val = 1;
                      if (val > MAX_RECORDING_SECONDS / 60) val = MAX_RECORDING_SECONDS / 60;
                      setAutoCompleteRecordingAfterSeconds(val * 60);
                    }}
                    className="w-16 border rounded-lg px-2 py-1 text-right mx-2"
                  />
                  <span className="text-sm text-gray-700">{t('mypraxis:recordingModal.autoComplete.minutes', { count: Math.floor(autoCompleteRecordingAfterSeconds / 60) })}</span>
                </div>
                }
              </div>
            )}
            
            {modalState === "initial" && isSuperAdmin && (
                <div className="p-4 bg-white rounded-lg mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">{t("recordingModal.transcription.label")}</h3>
                    </div>
                    <div className="w-64">
                      <Select 
                        value={selectedTranscriptionEngine} 
                        onValueChange={setSelectedTranscriptionEngine}
                        data-test="transcription-engine-select"
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("recordingModal.transcription.select")} />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSCRIPTION_ENGINES.map((engine: string) => (
                            <SelectItem key={engine} value={engine} data-test={`transcription-engine-option-${engine}`}>
                              {engine}
                          </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
            )}

            
            {modalState !== "initial" && modalState !== "soundCheck" && (
              <div className="p-6 bg-white">
                {/* Paused state */}
                {modalState === "paused" && (
                  <div className="flex items-center justify-center">
                    {/* Paused icon */}
                    <Pause className="w-6 h-6 mr-3 text-gray-400" />
                    <div className="text-5xl font-mono text-center text-gray-600">
                      {formatTime(timer)}
                    </div>
                  </div>
                )}
                { /* Recording state */ }
                {modalState === "recording" && (
                  <>
                    <div>                    
                      {/* Headphone warning message */}
                      <div className="mb-6">
                        <HeadphoneWarning />
                      </div>

                      <div className="flex items-center justify-center w-full h-full">
                        <MyPraxisAudioVisualizer stream={microphoneStream} className="mb-2" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      {/* Blinking red dot */}
                      <div 
                        className={`w-3 h-3 rounded-full mr-3 bg-red-600 transition-opacity duration-700 ${isBlinking ? 'opacity-100' : 'opacity-30'}`}
                      />
                      <div className="text-5xl font-mono text-center text-gray-600">
                        {formatTime(timer)}
                      </div>
                    </div>
                    {/* Auto-complete info card for recording state */}
                    {(() => {
                      const minutesRemainingRaw = (autoCompleteRecordingAfterSeconds - timer) / 60;
                      const minutesRemaining = Math.max(0, Math.ceil(minutesRemainingRaw));
                      const showLessThanOne = minutesRemainingRaw <= 1 && minutesRemainingRaw > 0;
                      const secondsRemaining = Math.max(0, autoCompleteRecordingAfterSeconds - timer);
                      const isWarning = minutesRemainingRaw <= 5;
                      return (
                        <div
                          className={`mt-6 flex items-center rounded-lg px-3 py-2 border ${
                            isWarning
                              ? 'bg-red-50 border-red-200'
                              : 'bg-white border-gray-200'
                          }${showLessThanOne ? ` transition-opacity duration-700 ${isBlinking ? 'opacity-100' : 'opacity-30'}` : ''}`}
                        >
                          <svg className={`h-5 w-5 mr-3 ${isWarning ? 'text-red-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className={`text-sm ${isWarning ? 'text-red-700' : 'text-gray-700'}`}> 
                            {t('mypraxis:recordingModal.autoComplete.infoLabel')}
                            {showLessThanOne ? (
                              <>
                                <span className="font-semibold ml-1">{secondsRemaining}</span>
                                <span> {t('mypraxis:recordingModal.autoComplete.seconds', { count: secondsRemaining })}</span>
                              </>
                            ) : (
                              <>
                                <span className="font-semibold ml-1">{'~ ' + minutesRemaining}</span>
                                <span> {t('mypraxis:recordingModal.autoComplete.minutes', { count: minutesRemaining })}</span>
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
            
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              {modalState === "initial" && (
                <div className="space-y-4">
                  <Button 
                    className="w-full bg-green-500 hover:bg-green-600 text-white"
                    onClick={handleStartRecordingFlow}
                    disabled={isMicrophoneChecking || isImporting}
                  >
                    {isMicrophoneChecking ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {t("recordingModal.microphone.checking")}
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-5 w-5" />
                        {t("recordingModal.microphone.record")}
                      </>
                    )}
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">{t("recordingModal.import.or")}</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                    onClick={handleImportClick}
                    disabled={isImporting}
                    style={
                      isImporting
                        ? {
                            background: `linear-gradient(to right, #2563eb ${uploadProgress}%, #3b82f6 ${uploadProgress}%)`,
                          }
                        : {}
                    }
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {t("recordingModal.import.importing")}
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-5 w-5" />
                        {t("recordingModal.import.button")}
                      </>
                    )}
                  </Button>
                  <div className="mt-4 flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <Volume2 className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      {t("recordingModal.microphone.supportedFormats", {
                        formats: "mp3, wav, m4a/mp4, aac, flac, ogg, aiff, webm, wma"
                      })}
                    </span>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="audio/mp3,audio/mpeg,.mp3,audio/wav,audio/vnd.wav,.wav,audio/mp4,.m4a,.mp4,audio/aac,.aac,audio/flac,.flac,audio/ogg,.ogg,audio/aiff,audio/x-aiff,.aiff,audio/webm,.webm,audio/x-ms-wma,.wma"
                    onChange={handleFileSelected}
                  />
                </div>
              )}
              
              {modalState === "soundCheck" && (
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => handleStartRecording()}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {/* {t("recordingModal.recording.starting")} */}
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-5 w-5" />
                      {t("recordingModal.recording.start")}
                    </>
                  )}
                </Button>
              )}
              
              {modalState === "recording" && (
                <Button 
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800"
                  onClick={handlePauseRecording}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {/* {t("recordingModal.recording.pausing")} */}
                    </>
                  ) : (
                    <>
                      <Pause className="mr-2 h-5 w-5" />
                      {t("recordingModal.recording.pause")}
                    </>
                  )}
                </Button>
              )}
              
              {(modalState === "paused" || modalState === "saving") && (
                <div className="flex gap-4">
                  {/* Hide resume button if autoCompleteTriggeredRef.current is true */}
                  {!autoCompleteTriggeredRef.current && (
      
                    <Button 
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
                      onClick={handleResumeRecording}
                      disabled={isResuming || isSaving}
                    >
                      {isResuming ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Play className="mr-2 h-5 w-5" />
                          {t("recordingModal.recording.resume")}
                        </>
                      )}
                    </Button>
                  )}
                  <Button 
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    onClick={handleSaveSession}
                    disabled={isResuming || isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      t("recordingModal.recording.save")
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Confirmation Dialog */}
          <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t('mypraxis:recordingModal.confirmCloseTitle')}</DialogTitle>
                <DialogDescription>
                  {t('mypraxis:recordingModal.confirmClose')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancelClose}>
                  {t('mypraxis:recordingModal.cancel')}
                </Button>
                <Button variant="destructive" onClick={handleConfirmClose}>
                  {t('mypraxis:recordingModal.confirm')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Paused Recording Dialog */}
          <Dialog open={showPausedRecordingDialog} onOpenChange={setShowPausedRecordingDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {t('mypraxis:recordingModal.pausedRecording.title')}
                </DialogTitle>
                <DialogDescription>
                  {t('mypraxis:recordingModal.pausedRecording.description')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  // Just close the dialog without taking any action
                  setExistingRecordingData(null);
                  setShowPausedRecordingDialog(false);
                  setModalState("initial");
                }}>
                  {t('mypraxis:recordingModal.pausedRecording.abort')}
                </Button>
                <Button onClick={async (_e) => {
                  // Complete the existing recording and start a new one
                  if (existingRecordingData?.id) {
                    setShowPausedRecordingDialog(false);
                    setExistingRecordingData(null);
                    
                    // Use handleStartRecording with completePausedExistingRecording option
                    await handleStartRecording({ completePausedExistingRecording: true });
                  }
                }}>
                  {t('mypraxis:recordingModal.pausedRecording.completeRecording')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Active Recording Dialog */}
          <Dialog open={showActiveRecordingDialog} onOpenChange={setShowActiveRecordingDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {t('mypraxis:recordingModal.activeRecording.title')}
                </DialogTitle>
                <DialogDescription>
                  {t('mypraxis:recordingModal.activeRecording.message')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => {
                  setShowActiveRecordingDialog(false);
                }}>
                  {t('mypraxis:recordingModal.ok')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Saving Stale Recording Dialog */}
          <Dialog open={showSavingStaleRecordingDialog} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t('mypraxis:recordingModal.savingStaleRecording.title')}</DialogTitle>
                <DialogDescription className="flex items-center">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('mypraxis:recordingModal.savingStaleRecording.message')}
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          {/* Saving Auto Completed Recording Dialog */}
          <Dialog open={showSavingAutoCompletedRecordingDialog} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t('mypraxis:recordingModal.savingAutoCompletedRecording.title')}</DialogTitle>
                <DialogDescription className="flex items-center">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('mypraxis:recordingModal.savingAutoCompletedRecording.message')}
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          {/* Microphone Access Error Dialog */}
          <Dialog open={showMicrophoneAccessErrorDialog} onOpenChange={setShowMicrophoneAccessErrorDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <DialogTitle>{t('mypraxis:recordingModal.microphone.errorDialog.title')}</DialogTitle>
                </div>
                <DialogDescription>
                  {t('mypraxis:recordingModal.microphone.errorDialog.message')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setShowMicrophoneAccessErrorDialog(false)}>
                  {t('mypraxis:recordingModal.microphone.errorDialog.button')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </>
  )
}
