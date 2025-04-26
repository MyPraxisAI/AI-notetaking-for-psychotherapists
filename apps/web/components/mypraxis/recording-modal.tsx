"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@kit/ui/button"
import { Mic, Pause, Play, X, Loader2 } from "lucide-react"
import { Switch } from "@kit/ui/switch"
import { Label } from "@kit/ui/label"
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
  onSave: () => void
  clientId: string
  clientName: string
  clients: { id: string; fullName: string }[]
  createSession?: (clientId: string) => void
}

export function RecordingModal({
  isOpen,
  onClose,
  onSave,
  clientId,
  clientName,
  clients,
  createSession
}: RecordingModalProps) {
  const [modalState, setModalState] = useState<
    "initial" | "soundCheck" | "recording" | "paused" | "saving"
  >("initial")
  
  const [isIntakeSession, setIsIntakeSession] = useState(false)
  const [selectedClient, setSelectedClient] = useState(clientId)
  const [selectedClientName, setSelectedClientName] = useState(clientName)
  const [selectedDevice, setSelectedDevice] = useState("MacBook Air Microphone (Built-in)")
  const [timer, setTimer] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null)
  
  // MediaRecorder state
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])
  
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
  
  // API functions for recording
  const startRecording = async () => {
    try {
      setIsProcessing(true)
      setError(null)
      
      const response = await fetch('/api/recordings/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId: selectedClient })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start recording')
      }
      
      const data = await response.json()
      setRecordingId(data.recording.id)
      return data.recording.id
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording')
      toast.error(err instanceof Error ? err.message : 'Failed to start recording')
      return null
    } finally {
      setIsProcessing(false)
    }
  }
  
  const pauseRecording = async () => {
    if (!recordingId) return
    
    try {
      setIsProcessing(true)
      setError(null)
      
      const response = await fetch(`/api/recordings/${recordingId}/pause`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to pause recording')
      }
      
      return await response.json()
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
      
      const response = await fetch(`/api/recordings/${recordingId}/resume`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to resume recording')
      }
      
      return await response.json()
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
      
      const response = await fetch(`/api/recordings/${recordingId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ createSession: true })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to complete recording')
      }
      
      return await response.json()
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
      const response = await fetch(`/api/recordings/${recordingId}/heartbeat`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        console.error('Failed to send heartbeat')
      }
    } catch (err) {
      console.error('Heartbeat error:', err)
    }
  }
  
  const uploadAudioChunk = async (blob: Blob, chunkNumber: number, startTime: number, endTime: number) => {
    if (!recordingId) return
    
    try {
      const formData = new FormData()
      formData.append('audioFile', blob, `chunk-${chunkNumber}.webm`)
      formData.append('chunkNumber', chunkNumber.toString())
      formData.append('startTime', startTime.toString())
      formData.append('endTime', endTime.toString())
      
      const response = await fetch(`/api/recordings/${recordingId}/chunk`, {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        console.error('Failed to upload audio chunk')
      }
    } catch (err) {
      console.error('Chunk upload error:', err)
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
  
  // Setup MediaRecorder and audio handling
  const setupMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      
      let chunkNumber = 0
      let chunkStartTime = 0
      
      mediaRecorder.current.ondataavailable = async (event) => {
        if (event.data.size > 0 && recordingId) {
          audioChunks.current.push(event.data)
          const chunkEndTime = timer
          
          // Upload the chunk
          await uploadAudioChunk(event.data, chunkNumber, chunkStartTime, chunkEndTime)
          
          // Prepare for next chunk
          chunkNumber++
          chunkStartTime = chunkEndTime
        }
      }
      
      return true
    } catch (err) {
      console.error('Error accessing microphone:', err)
      toast.error('Could not access microphone. Please check permissions.')
      return false
    }
  }
  
  const handleClose = () => {
    if (isRecording || modalState === "paused") {
      if (window.confirm("Recording won't be saved if you proceed. Are you sure you want to close?")) {
        cleanupRecording()
        onClose()
      }
    } else {
      cleanupRecording()
      onClose()
    }
  }
  
  const cleanupRecording = () => {
    // Clear intervals
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }
    
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current)
      heartbeatInterval.current = null
    }
    
    // Stop MediaRecorder if active
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
    }
    
    // Stop all tracks in the stream
    if (mediaRecorder.current && mediaRecorder.current.stream) {
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop())
    }
    
    setIsRecording(false)
    setTimer(0)
    audioChunks.current = []
  }
  
  const handleMicrophoneAccess = async () => {
    const success = await setupMediaRecorder()
    if (success) {
      setModalState("soundCheck")
    }
  }
  
  const handleStartRecording = async () => {
    const newRecordingId = await startRecording()
    
    if (newRecordingId) {
      // Start the MediaRecorder
      if (mediaRecorder.current) {
        mediaRecorder.current.start(5000) // Capture in 5-second chunks
        setIsRecording(true)
        setModalState("recording")
        
        // Start timer
        timerInterval.current = setInterval(() => {
          setTimer(prev => prev + 1)
        }, 1000)
        
        // Start heartbeat
        heartbeatInterval.current = setInterval(() => {
          sendHeartbeat()
        }, 30000) // Send heartbeat every 30 seconds
      }
    }
  }
  
  const handlePauseRecording = async () => {
    const result = await pauseRecording()
    
    if (result) {
      // Pause the MediaRecorder
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        mediaRecorder.current.requestData() // Get any remaining data
        mediaRecorder.current.pause()
      }
      
      // Clear timer interval
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
        timerInterval.current = null
      }
      
      setIsRecording(false)
      setModalState("paused")
    }
  }
  
  const handleResumeRecording = async () => {
    const result = await resumeRecording()
    
    if (result) {
      // Resume the MediaRecorder
      if (mediaRecorder.current && mediaRecorder.current.state === 'paused') {
        mediaRecorder.current.resume()
      }
      
      setIsRecording(true)
      setModalState("recording")
      
      // Restart timer
      timerInterval.current = setInterval(() => {
        setTimer(prev => prev + 1)
      }, 1000)
    }
  }
  
  const handleSaveSession = async () => {
    setModalState("saving")
    
    // Stop the MediaRecorder and get final data
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.requestData() // Get any remaining data
      mediaRecorder.current.stop()
    }
    
    // Complete the recording in the API
    const result = await completeRecording()
    
    if (result) {
      cleanupRecording()
      toast.success('Recording saved successfully')
      onSave()
    } else {
      setModalState("paused")
      toast.error('Failed to save recording. Please try again.')
    }
  }
  
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
                      <SelectValue placeholder="Select microphone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MacBook Air Microphone (Built-in)">
                        MacBook Air Microphone (Built-in)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {(modalState === "initial" || modalState === "soundCheck") && (
              <div className="p-6 pb-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-medium text-center">Session with <span className="underline">{selectedClientName}</span></h2>
                
                {/* Intake session toggle - temporarily hidden, can be re-enabled in the future
                <div className="p-4 bg-white rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Intake session</h3>
                      <p className="text-sm text-gray-500">Processing differs for intake and follow-ups</p>
                    </div>
                    <Switch
                      checked={isIntakeSession}
                      onCheckedChange={setIsIntakeSession}
                    />
                  </div>
                </div>
                */}
              </div>
            )}
            
            {(modalState === "recording" || modalState === "paused" || modalState === "saving") && (
              <div className="p-6 pb-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-medium text-center">Session with <span className="underline">{selectedClientName}</span></h2>
                
                {/* Intake session toggle - temporarily hidden, can be re-enabled in the future
                <div className="p-4 bg-white rounded-lg mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Intake session</h3>
                      <p className="text-sm text-gray-500">Processing differs for intake and follow-ups</p>
                    </div>
                    <Switch
                      checked={isIntakeSession}
                      onCheckedChange={setIsIntakeSession}
                      disabled={modalState === "recording" || modalState === "saving"}
                    />
                  </div>
                </div>
                */}
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
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleMicrophoneAccess}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Checking Microphone...
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-5 w-5" />
                      Allow Microphone Access
                    </>
                  )}
                </Button>
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
                      Starting Recording...
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-5 w-5" />
                      Record
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
                      Pausing...
                    </>
                  ) : (
                    <>
                      <Pause className="mr-2 h-5 w-5" />
                      Pause
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
                        Resume
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
                      'Save Session'
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
                  Saving Recording...
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
              close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
