"use client"

import { useState, useEffect } from "react"
import { Button } from "@kit/ui/button"
import { Loader2 } from "lucide-react"
import { useTherapeuticApproaches } from "../../app/home/(user)/mypraxis/_lib/hooks/use-therapeutic-approaches"
import { useUpdateTherapistField } from "../../app/home/(user)/mypraxis/_lib/hooks/use-therapist-profile"
import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/select"

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

interface TherapeuticApproachOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TherapeuticApproachOnboardingModal({
  isOpen,
  onClose,
}: TherapeuticApproachOnboardingModalProps) {
  // Modal state: "selection" or "success"
  const [modalState, setModalState] = useState<"selection" | "success">("selection")
  
  // Selected approach state
  const [selectedApproach, setSelectedApproach] = useState<string>("")
  
  // Loading state
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Error state
  const [error, setError] = useState<string | null>(null)
  
  // Translation hook
  const { t } = useTranslation()
  
  // Fetch therapeutic approaches
  const { data: therapeuticApproaches, isLoading: isLoadingApproaches } = useTherapeuticApproaches()
  
  // Get therapist field update hook
  const { updateField, isLoading: isUpdating } = useUpdateTherapistField()
  
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
  
  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setModalState("selection")
      setSelectedApproach("")
      setError(null)
    }
  }, [isOpen]);
  
  // Handle approach selection
  const handleApproachChange = (value: string) => {
    setSelectedApproach(value)
    setError(null)
  }
  
  // Handle next button click
  const handleNext = async () => {
    if (!selectedApproach) {
      setError("Please select a therapeutic approach")
      return
    }
    
    try {
      setIsProcessing(true)
      setError(null)
      
      // Update therapist profile with selected approach
      await updateField('primaryTherapeuticApproach', selectedApproach)
      
      // Show success state
      setModalState("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update therapeutic approach")
    } finally {
      setIsProcessing(false)
    }
  }
  
  // Handle close
  const handleClose = () => {
    onClose()
  }
  
  // Sort approaches similar to the settings page
  const sortedApproaches = therapeuticApproaches ? [...therapeuticApproaches].sort((a, b) => {
    // Always put 'other' at the end
    if (a.name === 'other') return 1;
    if (b.name === 'other') return -1;
    
    // Sort by translated values
    const aTranslated = t(`mypraxis:therapeuticApproaches.${a.name}`, { defaultValue: a.name });
    const bTranslated = t(`mypraxis:therapeuticApproaches.${b.name}`, { defaultValue: b.name });
    return aTranslated.localeCompare(bTranslated);
  }) : [];
  
  if (!isOpen) return null
  
  return (
    <>
      <div 
        className={`onboarding-modal-overlay ${isOpen ? 'active' : ''}`}
        onClick={handleClose}
      ></div>
      
      {isOpen && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50">
          <div className="relative bg-white rounded-lg w-full max-w-md mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {modalState === "selection" 
                  ? "Welcome to MyPraxis!" 
                  : "Setup Complete"}
              </h2>
            </div>
            
            {/* Modal content */}
            <div className="p-6">
              {modalState === "selection" && (
                <>
                  <p className="text-gray-600 mb-4">
                    Select your primary therapeutic approach — we need it to correctly process your sessions' data.
                  </p>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2.5">
                      Primary Therapeutic Approach
                    </label>
                    <Select
                      value={selectedApproach}
                      onValueChange={handleApproachChange}
                      disabled={isLoadingApproaches || isProcessing}
                    >
                      <SelectTrigger 
                        className="w-full focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                        data-test="onboarding-therapeutic-approach-select"
                      >
                        <SelectValue placeholder="Choose approach" />
                      </SelectTrigger>
                      <SelectContent side="bottom" className="max-h-[200px]">
                        {isLoadingApproaches ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : sortedApproaches.length === 0 ? (
                          <SelectItem value="none" disabled>No approaches found</SelectItem>
                        ) : (
                          sortedApproaches.map((approach) => (
                            <SelectItem key={approach.id} value={approach.id}>
                              {t(`mypraxis:therapeuticApproaches.${approach.name}`, { defaultValue: approach.name })}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {error && (
                      <p className="mt-2 text-sm text-red-600">{error}</p>
                    )}
                  </div>
                </>
              )}
              
              {modalState === "success" && (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-5">
                    Thanks, you are good to go! You can always change your therapeutic approach in the settings.
                  </p>
                  <p className="text-gray-600 mb-5">
                    Now check out the demo client or add a new one to start recording your first session.
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
                      Saving...
                    </>
                  ) : (
                    "Next"
                  )}
                </Button>
              )}
              
              {modalState === "success" && (
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleClose}
                >
                  Get Started
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
