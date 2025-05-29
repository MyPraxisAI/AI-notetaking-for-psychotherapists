"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@kit/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@kit/ui/dialog"
import { Mic, Pause, Play, Loader2, Upload } from "lucide-react"
import { AudioChunk, uploadAudioChunks, processAudioFile } from "./utils/audio-upload"
import * as RecordingAPI from "./utils/recording-api"
import * as MediaRecorderUtils from "./utils/media-recorder"

// AudioChunk interface is now imported from ./utils/audio-upload

import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/select"

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
  const [modalState, setModalState] = useState<
    "initial" | "soundCheck" | "recording" | "paused" | "saving"
  >("initial")
  
  const [_isIntakeSession, _setIsIntakeSession] = useState(false)
  const [selectedClient, setSelectedClient] = useState(clientId)
  const [selectedClientName, setSelectedClientName] = useState(clientName)
  const [selectedDevice, setSelectedDevice] = useState("MacBook Air Microphone (Built-in)")
  const [selectedTranscriptionEngine, setSelectedTranscriptionEngine] = useState("yandex-v3-ru")
  const [timer, setTimer] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
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
  const [showExistingRecordingDialog, setShowExistingRecordingDialog] = useState(false)
  const [showSavingStaleRecordingDialog, setShowSavingStaleRecordingDialog] = useState(false)
  
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
  
  // Manage heartbeats whenever recordingId exists and modal is open
  useEffect(() => {
    // Only start heartbeat if we have a recording ID and the modal is open
    if (recordingId && isOpen && (modalState === "recording" || modalState === "paused")) {
      // Send initial heartbeat immediately
      sendHeartbeat();
      
      // Setup interval for heartbeats every 30 seconds
      heartbeatInterval.current = setInterval(() => {
        sendHeartbeat();
      }, 30000);
      
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
  
  const startRecording = async (options: { standaloneChunks?: boolean } = {}): Promise<{ success: boolean; recordingId?: string }> => {
    try {
      setIsProcessing(true)
      setError(null)
      
      const result = await RecordingAPI.startRecording({
        clientId: selectedClient,
        transcriptionEngine: selectedTranscriptionEngine,
        standaloneChunks: options.standaloneChunks
      })
      
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
          // Recent recording - likely active in another tab
          setShowExistingRecordingDialog(true)
          setIsProcessing(false)
          return { success: false } // Failed to start a new recording due to active recording in another tab
        } else {
          // Stale recording - complete it automatically
          setShowSavingStaleRecordingDialog(true)
          
          try {
            // Create a minimum timer and complete the stale recording in parallel
            const minimumTimer = new Promise(resolve => setTimeout(resolve, 4000))
            const completeRecordingPromise = RecordingAPI.completeRecording(result.id)
            
            // Wait for both the timer and the API call to complete
            await Promise.all([minimumTimer, completeRecordingPromise])
            console.log('Completed stale recording:', result.id)
            
            // Refresh the session list in column 4
            queryClient.invalidateQueries({ queryKey: ['sessions', clientId] })
            
            // Hide the dialog after ensuring it's been shown for at least 3 seconds
            setShowSavingStaleRecordingDialog(false)
            
            // Try starting a new recording
            return await startRecording(options) // Return the result of the recursive call
          } catch (err) {
            console.error('Error completing stale recording:', err)
            setShowSavingStaleRecordingDialog(false)
            throw err
          }
        }
      }
      
      // Normal case - new recording started
      // At this point, result must be a string (the recording ID)
      const newRecordingId = result as string
      setRecordingId(newRecordingId)
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
  
  const pauseRecording = async () => {
    if (!recordingId) return
    
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
  }
  
  const resumeRecording = async () => {
    if (!recordingId) return
    
    try {
      setIsProcessing(true)
      setError(null)
      
      const result = await RecordingAPI.resumeRecording(recordingId)
      
      if (!result) {
        throw new Error('Failed to resume recording')
      }
      
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume recording')
      toast.error(err instanceof Error ? err.message : 'Failed to resume recording')
      return null
    } finally {
      setIsProcessing(false)
    }
  }
  
  const completeRecording = async () => {
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
  }
  
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
  
  // Setup MediaRecorder and audio handling - now using the extracted utility functions
  const setupMediaRecorder = async () => {
    try {
      // Setup the MediaRecorder with optimal settings
      const recorder = await MediaRecorderUtils.setupMediaRecorder(
        {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1, // Mono for voice clarity
          audioBitsPerSecond: 128000 // 128 kbps for good quality voice
        },
        {
          onError: (error) => {
            console.error('MediaRecorder error:', error);
            toast.error('Error during recording. Please try again.');
            setError(error.message || 'Recording error occurred. Please try again.');
          },
          onDataAvailable: () => {} // This will be configured later in handleStartRecording
        }
      );
      
      if (recorder) {
        mediaRecorder.current = recorder;
        console.log('MediaRecorder initialized successfully');
        return true;
      } else {
        throw new Error('Failed to initialize MediaRecorder');
      }
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error(t('mypraxis:recordingModal.microphone.accessError'));
      setError(err instanceof Error ? err.message : t('mypraxis:recordingModal.microphone.failedAccess'));
      return false;
    }
  }
  
  const handleClose = () => {
    if (isRecording || modalState === "paused") {
      setShowConfirmDialog(true)
    } else {
      // For non-recording state, we can clean up without waiting
      cleanupRecording().then(() => {
        onClose()
      })
    }
  }
  
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
   * Clean up recording resources without aborting the recording in the API
   */
  const cleanupRecording = async () => {
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
  }
  
  /**
   * Abort the recording in the API and then clean up resources
   */
  const abortRecording = async () => {
    // Set the aborted flag to prevent further uploads
    isAborted.current = true;

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
  
  const handleMicrophoneAccess = async () => {
    const success = await setupMediaRecorder()
    if (success) {
      setModalState("soundCheck")
    }
  }
  
  const handleStartRecording = async () => {
    console.log('Starting recording...')
    
    // Reset timer to 0 before starting
    setTimer(0)
    currentTimerRef.current = 0
    
    // Reset audio chunks
    audioChunks.current = []
    
    // Store the recording start time for precise timing
    const _recordingStartTime = performance.now()
    
    const result = await startRecording()
    
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
      const _recordingStartTime = MediaRecorderUtils.configureMediaRecorderForChunks(
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
  const handleUploadAudioChunks = async (explicitRecordingId: string) => {
    // Don't attempt to upload if the recording has been aborted
    if (isAborted.current) {
      console.log('Recording has been aborted, skipping chunk upload');
      return false;
    }
    return await uploadAudioChunks(explicitRecordingId, audioChunks, isUploading);
  };
  
  // We're now using the imported uploadAudioChunkWithId function from utils/audio-upload.ts
  
  const handlePauseRecording = async () => {
    try {
      setIsProcessing(true)
      
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
        timerInterval.current = null
      }
      
      const result = await pauseRecording()
      
      if (result) {
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause recording')
      toast.error(err instanceof Error ? err.message : 'Failed to pause recording')
      setIsProcessing(false)
    }
  }
  
  const handleResumeRecording = async () => {
    try {
      setIsProcessing(true)
      
      const result = await resumeRecording()
      
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
        
        setIsProcessing(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume recording')
      toast.error(err instanceof Error ? err.message : 'Failed to resume recording')
      setIsProcessing(false)
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
          // Could add progress indicator here if needed
          console.log(`Processing chunk ${current}/${total}`);
        },
        onError: (error: Error) => {
          setError(error.message);
          toast.error(error.message);
        }
      });
      
      // 3. Navigate to the session
      toast.success('Audio file imported successfully');
      if (result.sessionId) {
        await onSave(result.sessionId);
      } else {
        await onSave();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import audio file');
      toast.error(err instanceof Error ? err.message : 'Failed to import audio file');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveSession = async () => {
    try {
      setModalState("saving")
      
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
        // Just clean up resources without aborting the recording since it was successfully completed
        cleanupRecording()
        toast.success('Recording saved successfully')
        
        // Pass the session ID to the onSave callback for navigation
        if (result.sessionId) {
          console.log('Found sessionId in result:', result.sessionId)
          await onSave(result.sessionId)
        } else {
          console.log('No session ID found in result:', result)
          await onSave()
        }
      } else {
        setModalState("paused")
        toast.error('Failed to save recording. Please try again.')
      }
    } catch (error) {
      console.error('Error in handleSaveSession:', error)
      setModalState("paused")
      toast.error('An error occurred while saving the recording.')
    }
  };
  
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
            {/* Modal content starts here */}
            {modalState === "soundCheck" && (
              <div className="bg-gray-50 p-4">
                <h2 className="text-xl font-semibold text-gray-800">Sound Check</h2>
                
                {/* Sound level indicator (mock) */}
                <div className="mt-2 h-8 bg-green-100 rounded-md overflow-hidden">
                  <div className="h-full w-16 bg-green-500 rounded-l-md"></div>
                </div>
                
                {/* Device selection */}
                <div className="mt-4">
                  <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("recordingModal.microphone.select")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MacBook Air Microphone (Built-in)">
                        {t("recordingModal.microphone.builtin")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {(modalState === "initial" || modalState === "soundCheck") && (
              <div className="p-6 pb-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-medium text-center">{t("recordingModal.title")} <span className="underline">{selectedClientName}</span></h2>
                
                {/* Transcription engine selection */}
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
                          <SelectItem value="yandex-v3-ru" data-test="transcription-engine-option-yandex-v3-ru">
                            {t("recordingModal.transcription.yandex")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {(modalState === "recording" || modalState === "paused" || modalState === "saving") && (
              <div className="p-6 pb-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-medium text-center">{t("recordingModal.title")} <span className="underline">{selectedClientName}</span></h2>
              </div>
            )}
            
            <div className="p-6 bg-gray-100">
              <div className="flex items-center justify-center">
                {(modalState === "recording") && (
                  <div 
                    className={`w-3 h-3 rounded-full mr-3 bg-red-600 transition-opacity duration-700 ${isBlinking ? 'opacity-100' : 'opacity-30'}`}
                  />
                )}
                <div className="text-5xl font-mono text-center text-gray-600">
                  {formatTime(timer)}
                </div>
              </div>
            </div>
            
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
                    onClick={handleMicrophoneAccess}
                    disabled={isProcessing || isImporting}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {t("recordingModal.microphone.checking")}
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-5 w-5" />
                        {t("recordingModal.microphone.allow")}
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
                    disabled={isProcessing || isImporting}
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
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="audio/mp3,audio/mpeg"
                    onChange={handleFileSelected}
                  />
                </div>
              )}
              
              {modalState === "soundCheck" && (
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleStartRecording}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t("recordingModal.recording.starting")}
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
                      {t("recordingModal.recording.pausing")}
                    </>
                  ) : (
                    <>
                      <Pause className="mr-2 h-5 w-5" />
                      {t("recordingModal.recording.pause")}
                    </>
                  )}
                </Button>
              )}
              
              {modalState === "paused" && (
                <div className="flex gap-4">
                  <Button 
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
                    onClick={handleResumeRecording}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Play className="mr-2 h-5 w-5" />
                        {t("recordingModal.recording.resume")}
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    onClick={handleSaveSession}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      t("recordingModal.recording.save")
                    )}
                  </Button>
                </div>
              )}
              
              {modalState === "saving" && (
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  disabled
                >
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t("recordingModal.recording.saving")}
                </Button>
              )}
            </div>
          </div>
          
          {/* Close link positioned below the modal */}
          <div className="w-full max-w-md px-4 mt-2 flex justify-end">
            <button 
              className="text-white underline text-sm hover:text-gray-200"
              onClick={handleClose}
            >
              {t("recordingModal.close")}
            </button>
          </div>
        </div>
      )}
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
      
      {/* Existing Active Recording Dialog */}
      <Dialog open={showExistingRecordingDialog} onOpenChange={setShowExistingRecordingDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('mypraxis:recordingModal.existingRecording.title')}</DialogTitle>
            <DialogDescription>
              {t('mypraxis:recordingModal.existingRecording.message')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowExistingRecordingDialog(false)}>
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
    </>
  )
}
