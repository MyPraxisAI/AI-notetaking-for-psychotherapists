"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@kit/ui/button"
import { Mic, Pause, Play, X, Loader2 } from "lucide-react"
import { Switch } from "@kit/ui/switch"
import { Label } from "@kit/ui/label"
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
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  
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
  
  useEffect(() => {
    if (isOpen) {
      setModalState("initial")
      setSelectedClient(clientId)
      setSelectedClientName(clientName)
      setTimer(0)
      setIsRecording(false)
      
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
        timerInterval.current = null
      }
    }
  }, [isOpen, clientId, clientName])
  
  const handleClose = () => {
    if (isRecording || modalState === "paused") {
      if (window.confirm("Recording won't be saved if you proceed. Are you sure you want to close?")) {
        cleanupRecording()
        onClose()
      }
    } else {
      onClose()
    }
  }
  
  const cleanupRecording = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }
    setIsRecording(false)
    setTimer(0)
  }
  
  const handleMicrophoneAccess = () => {
    setModalState("soundCheck")
  }
  
  const handleStartRecording = () => {
    setIsRecording(true)
    setModalState("recording")
    
    timerInterval.current = setInterval(() => {
      setTimer(prev => prev + 1)
    }, 1000)
  }
  
  const handlePauseRecording = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }
    setIsRecording(false)
    setModalState("paused")
  }
  
  const handleResumeRecording = () => {
    setIsRecording(true)
    setModalState("recording")
    
    timerInterval.current = setInterval(() => {
      setTimer(prev => prev + 1)
    }, 1000)
  }
  
  const handleSaveSession = () => {
    setModalState("saving")
    
    setTimeout(() => {
      cleanupRecording()
      if (createSession) {
        createSession(selectedClient)
      }
      onSave()
    }, 1000)
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
              {modalState === "initial" && (
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleMicrophoneAccess}
                >
                  <Mic className="mr-2 h-5 w-5" />
                  Allow Microphone Access
                </Button>
              )}
              
              {modalState === "soundCheck" && (
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleStartRecording}
                >
                  <Mic className="mr-2 h-5 w-5" />
                  Record
                </Button>
              )}
              
              {modalState === "recording" && (
                <Button 
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800"
                  onClick={handlePauseRecording}
                >
                  <Pause className="mr-2 h-5 w-5" />
                  Pause
                </Button>
              )}
              
              {modalState === "paused" && (
                <div className="flex gap-4">
                  <Button 
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
                    onClick={handleResumeRecording}
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Resume
                  </Button>
                  
                  <Button 
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    onClick={handleSaveSession}
                  >
                    Save Session
                  </Button>
                </div>
              )}
              
              {modalState === "saving" && (
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  disabled
                >
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Save Session
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
