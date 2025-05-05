"use client"

import { useEffect, useState } from "react"
import { Button } from "@kit/ui/button"
import { Info, Mic, X } from "lucide-react"

interface ClientGuidanceBannerProps {
  clientId: string
  onRecordingStart: () => void
  isMobileView: boolean
  hasNoSessions: boolean
}

export function ClientGuidanceBanner({
  clientId,
  onRecordingStart,
  isMobileView,
  hasNoSessions
}: ClientGuidanceBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [showButton, setShowButton] = useState(false)
  
  // Check if the banner should be shown
  useEffect(() => {
    // Don't show on mobile or when there are sessions
    if (isMobileView || !hasNoSessions) {
      setIsVisible(false)
      return
    }
    
    // Check if this banner has been dismissed for this client
    const isDismissed = localStorage.getItem(`clientGuidanceClosed_${clientId}`)
    setIsVisible(!isDismissed)
  }, [clientId, isMobileView, hasNoSessions])
  
  // Check viewport width to determine if button should be shown
  useEffect(() => {
    const checkViewport = () => {
      // Show button only when viewport width is <= 970px
      setShowButton(window.innerWidth <= 970)
    }
    
    // Initial check
    checkViewport()
    
    // Add resize listener
    window.addEventListener('resize', checkViewport)
    
    // Cleanup
    return () => window.removeEventListener('resize', checkViewport)
  }, [])
  
  // If not visible, don't render anything
  if (!isVisible) return null
  
  const handleDismiss = () => {
    // Save dismissal preference for this client
    localStorage.setItem(`clientGuidanceClosed_${clientId}`, "true")
    setIsVisible(false)
  }
  
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between p-4 bg-[#E6F7FF] border border-[#91CAFF] rounded-md relative">
      {/* Close button */}
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        aria-label="Dismiss guidance"
      >
        <X className="h-4 w-4" />
      </button>
      
      {/* Banner content */}
      <div className="flex items-center mr-4 mb-2 sm:mb-0">
        <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
        <p className="text-sm text-gray-700">
          Client profile created successfully. Ready to start recording a session.
        </p>
      </div>
      
      {/* Action button - only shown when viewport width <= 970px */}
      {showButton && (
        <Button
          className="bg-[#22C55E] hover:bg-[#22C55E]/90 text-white text-[14px] font-medium py-2 px-3 mr-4"
          onClick={onRecordingStart}
        >
          <Mic className="h-4 w-4 mr-2" />
          Start Recording
        </Button>
      )}
    </div>
  )
}
