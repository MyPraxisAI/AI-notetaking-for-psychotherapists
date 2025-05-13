"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@kit/ui/button"
import { Input } from "@kit/ui/input"
import { Label } from "@kit/ui/label"
import { Loader2 } from "lucide-react"

// Define overlay styles similar to recording modal
const overlayStyles = `
  .client-creation-modal-overlay {
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
  
  .client-creation-modal-overlay.active {
    opacity: 1;
    pointer-events: auto;
  }
`;

interface ClientCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (clientName: string) => void
}

export function ClientCreationModal({
  isOpen,
  onClose,
  onSave
}: ClientCreationModalProps) {
  const [clientName, setClientName] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Add overlay styles to document head
  useEffect(() => {
    if (!document.getElementById('client-creation-modal-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'client-creation-modal-styles';
      styleElement.innerHTML = overlayStyles;
      document.head.appendChild(styleElement);
      
      return () => {
        const element = document.getElementById('client-creation-modal-styles');
        if (element) {
          element.remove();
        }
      };
    }
  }, []);
  
  // Focus input field when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);
  
  // Handle close
  const handleClose = () => {
    if (!isProcessing) {
      setClientName("");
      onClose();
    }
  };
  
  // Handle save
  const handleSave = () => {
    if (clientName.trim() && !isProcessing) {
      setIsProcessing(true);
      // In a real implementation, we would save to the database here
      // For now, just call onSave and close the modal
      onSave(clientName.trim());
      setClientName("");
      setIsProcessing(false);
      onClose();
    }
  };
  
  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      <div 
        className={`client-creation-modal-overlay ${isOpen ? 'active' : ''}`}
        onClick={handleClose}
      ></div>
      
      {isOpen && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50">
          <div className="relative bg-white rounded-lg w-full max-w-md mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="p-6 pb-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Add New Client</h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter the client's name to create a new profile.
              </p>
            </div>
            
            {/* Modal content */}
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    ref={inputRef}
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Joanne Smith"
                    className="mt-1"
                    disabled={isProcessing}
                  />
                </div>
                
                <div className="flex gap-4 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleClose}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    onClick={handleSave}
                    disabled={isProcessing || !clientName.trim()}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Client'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
