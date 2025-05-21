"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@kit/ui/button"
import { Loader2 } from "lucide-react"
import { useUpdateTherapistField, useMyPraxisTherapistProfile } from "../../app/home/(user)/mypraxis/_lib/hooks/use-therapist-profile"
import { useUserSettings } from "../../app/home/(user)/mypraxis/_lib/hooks/use-user-settings"
import { useTranslation } from 'react-i18next'
import { TherapeuticApproachesSelect } from "./therapeutic-approaches-select"

// Define overlay styles similar to recording modal
const overlayStyles = `
  .onboarding-modal-overlay {
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
  
  .onboarding-modal-overlay.active {
    opacity: 1;
    pointer-events: auto;
  }
`;

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  isMandatory?: boolean
}

export function OnboardingModal({
  isOpen,
  onClose,
  isMandatory = false,
}: OnboardingModalProps) {

  // Modal state: "selection" or "success"
  const [modalState, setModalState] = useState<"selection" | "success">("selection")
  
  // Fetch the current therapist profile
  const { data: therapistProfile, isLoading: _isLoadingProfile } = useMyPraxisTherapistProfile()
  
  // Selected approach state - initialize with the existing value (if any)
  const [selectedApproach, setSelectedApproach] = useState<string>("")
  
  // Loading state
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Error state
  const [error, setError] = useState<string | null>(null)
  
  // Translation hook
  const { t } = useTranslation(['mypraxis'])
  
  // Get therapist field update hook
  const { updateField, isLoading: _isUpdating } = useUpdateTherapistField()
  
  // Get user settings hook
  const { completeOnboarding } = useUserSettings()
  
  // Add styles to document
  useEffect(() => {
    if (!document.getElementById('onboarding-modal-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'onboarding-modal-styles';
      styleElement.innerHTML = overlayStyles;
      document.head.appendChild(styleElement);
      
      return () => {
        const element = document.getElementById('onboarding-modal-styles');
        if (element) {
          element.remove();
        }
      };
    }
  }, []);
  
  // Set initial approach from profile when opened or when profile data changes
  useEffect(() => {
    if (isOpen && therapistProfile && therapistProfile.primaryTherapeuticApproach) {
      // Pre-select the existing approach
      setSelectedApproach(therapistProfile.primaryTherapeuticApproach)
    } else if (isOpen) {
      // Reset if there's no existing approach
      setModalState("selection")
      setSelectedApproach("")
      setError(null)
    }
  }, [isOpen, therapistProfile]);
  
  // Handle approach selection - memoized to prevent unnecessary re-renders
  const handleApproachChange = useCallback((value: string) => {
    setSelectedApproach(value)
    setError(null)
  }, [])
  
  // Handle next button click - memoized with dependencies
  const handleNext = useCallback(async () => {
    if (!selectedApproach) {
      setError(t('mypraxis:onboarding.errorSelectApproach'))
      return
    }
    
    try {
      setIsProcessing(true)
      setError(null)
      
      // Update therapist profile with selected approach
      await updateField('primaryTherapeuticApproach', selectedApproach)
      
      // Show success state - onboarding is NOT marked complete here
      setModalState("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update therapeutic approach")
    } finally {
      setIsProcessing(false)
    }
  }, [selectedApproach, updateField])
  
  // Handle close - memoized with dependencies
  const handleClose = useCallback(() => {
    // If modal is mandatory and we're not in success state, don't allow closing
    // This handleClose is for the overlay click or an explicit close action
    // that doesn't complete onboarding (e.g., if a close 'X' button existed).
    if (isMandatory && modalState !== "success") {
      return
    }
    onClose()
  }, [isMandatory, modalState, onClose])

  // Handle finish onboarding - called from success screen
  const handleFinishOnboarding = useCallback(async () => {
    try {
      setIsProcessing(true) // Indicate processing
      await completeOnboarding() // Mark onboarding as complete
      onClose() // Close the modal
    } catch (err) {
      // Handle any errors during completeOnboarding, though it's less common for this specific action
      setError(err instanceof Error ? err.message : "Failed to complete onboarding")
    } finally {
      setIsProcessing(false)
    }
  }, [completeOnboarding, onClose])
    
  if (!isOpen) return null
  
  return (
    <>
      <div 
        className={`onboarding-modal-overlay ${isOpen ? 'active' : ''}`}
        onClick={isMandatory && modalState !== "success" ? undefined : handleClose}
        data-test="onboarding-modal-overlay"
        aria-hidden="true"
      ></div>
      
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {modalState === "selection" 
                  ? t('mypraxis:onboarding.welcomeTitle') 
                  : t('mypraxis:onboarding.setupCompleteTitle')}
              </h2>
            </div>
            
            {/* Modal content */}
            <div className="p-6">
              {modalState === "selection" && (
                <>
                  <p className="text-gray-600 mb-4">
                    {t('mypraxis:onboarding.selectTherapyStyleText')}
                  </p>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2.5">
                      {t('mypraxis:onboarding.primaryApproachLabel')}
                    </label>
                    <TherapeuticApproachesSelect
                      value={selectedApproach}
                      onValueChange={handleApproachChange}
                      placeholder={t('mypraxis:onboarding.chooseApproachPlaceholder')}
                      className="w-full"
                      testId="onboarding-therapeutic-approach-select"
                      disabled={isProcessing}
                    />
                    {error && (
                      <p className="mt-2 text-sm text-red-600">{error}</p>
                    )}
                  </div>
                </>
              )}
              
              {modalState === "success" && (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-5">
                    {t('mypraxis:onboarding.thanksText')}
                  </p>
                  <p className="text-gray-600 mb-5">
                    {t('mypraxis:onboarding.checkoutDemoText')}
                  </p>
                </div>
              )}
            </div>
            
            {/* Modal footer */}
            <div className="p-6 bg-gray-100 rounded-b-lg">
              {modalState === "selection" && (
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleNext}
                  disabled={!selectedApproach || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t('mypraxis:onboarding.savingButton')}
                    </>
                  ) : (
                    t('mypraxis:onboarding.nextButton')
                  )}
                </Button>
              )}
              
              {modalState === "success" && (
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleFinishOnboarding} // Use the new handler
                  disabled={isProcessing} // Disable while processing
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t('mypraxis:onboarding.finishingButton')}
                    </>
                  ) : (
                    t('mypraxis:onboarding.finishButton')
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
