"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@kit/ui/input"
import { Label } from "@kit/ui/label"
import { Check, MoreVertical } from "lucide-react"
import { Button } from "@kit/ui/button"
import { useTranslation } from "react-i18next"
import { DeleteClientModal } from "../mypraxis/delete-client-modal"
import { useRouter } from "next/navigation"
import type React from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@kit/ui/dropdown-menu"
import { useClient, useUpdateClient } from "../../app/home/(user)/mypraxis/_lib/hooks/use-clients"
import { ClientWithId } from "../../app/home/(user)/mypraxis/_lib/schemas/client"
import { useSessions } from "../../app/home/(user)/mypraxis/_lib/hooks/use-sessions"
import { ClientGuidanceBanner } from "./client-guidance-banner"

interface ProfileFormProps {
  clientId: string
  onNameChange?: (name: string) => void
  onClientDeleted: (clientId: string) => void
  onNewSession?: () => void
  onRecordingStart?: () => void
  isDemo?: boolean
}

export function ProfileForm({ clientId, onNameChange, onClientDeleted, onNewSession, onRecordingStart, isDemo = false }: ProfileFormProps) {
  const { t } = useTranslation()
  const { data: client, isLoading } = useClient(clientId)
  const updateClient = useUpdateClient()
  
  // Get sessions data to check if client has any sessions
  const { data: sessions = [] } = useSessions(clientId)
  const hasNoSessions = sessions.length === 0
  
  // Check if we're on mobile view where recording is disabled
  const [isMobileView, setIsMobileView] = useState(false)
  
  // Check for mobile view on mount and window resize
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth <= 768)
    }
    
    // Initial check
    checkMobileView()
    
    // Add resize listener
    window.addEventListener('resize', checkMobileView)
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobileView)
  }, [])
  
  const [formData, setFormData] = useState<Partial<ClientWithId>>({})
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set())
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [validation, setValidation] = useState({
    email: true,
    phone: true
  })
  
  // Refs for all input fields
  const fullNameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)

  const saveTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const _router = useRouter()

  // Update form data when client data changes
  useEffect(() => {
    if (client) {
      setFormData(client)
    }
  }, [client])

  useEffect(() => {
    if (fullNameRef.current && client?.fullName === "New Client") {
      fullNameRef.current.focus()
      fullNameRef.current.select()
    }
  }, [client?.fullName])

  const validateEmail = (email: string) => {
    // Allow empty email
    if (!email.trim()) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validatePhone = (phone: string) => {
    return /^[\d+]*$/.test(phone)
  }

  // Modify the saveField function to update the savedValues state
  const saveField = (field: string, value: string | number | boolean | null) => {
    if (!client) return

    // Check if the value has actually changed
    if (client[field as keyof ClientWithId] === value) {
      return // Don't save or show checkmark if no change
    }

    const updatedClient = {
      ...client,
      [field]: value,
    }

    // Update the client in Supabase
    updateClient.mutate(updatedClient)

    // Update local form data
    setFormData(updatedClient)

    // Show the checkmark
    setSavedFields((prev) => new Set(prev).add(field))

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current)
    }
    saveTimeout.current = setTimeout(() => {
      setSavedFields((prev) => {
        const newSet = new Set(prev)
        newSet.delete(field)
        return newSet
      })
    }, 1000)
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: string,
    _isPhone = false,
    _isEmail = false,
  ) => {
    const value = e.target.value

    if (field === "fullName" && onNameChange) {
      onNameChange(value)
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: string,
    isPhone = false,
    isEmail = false,
  ) => {
    const value = e.target.value

    if (isEmail) {
      setValidation((prev) => ({ ...prev, email: validateEmail(value) }))
      if (!validateEmail(value)) return
    }
    if (isPhone) {
      const isValid = validatePhone(value)
      setValidation((prev) => ({
        ...prev,
        phone: isValid,
      }))
      if (!isValid) return
    }

    saveField(field, value)
  }

  const handleDeleteClient = () => {
    // Notify parent component about deletion
    onClientDeleted(clientId)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, currentField: string) => {
    if (e.key === "Enter") {
      e.preventDefault()

      // Define the focus order
      const focusOrder = {
        fullName: emailRef,
        email: phoneRef,
        phone: fullNameRef, // Cycle back to the top
      }

      // Focus the next field
      const nextRef = focusOrder[currentField as keyof typeof focusOrder]
      nextRef?.current?.focus()
    }
  }

  if (isLoading) return <div className="w-full px-6 pt-6 bg-white">{t('mypraxis:profileForm.loading')}</div>
  if (!client) return <div className="w-full px-6 pt-6 bg-white">{t('mypraxis:profileForm.clientNotFound')}</div>

  return (
    <div className="w-full px-6 pt-6 border-r border-[#E5E7EB] bg-white">
      {/* Client Guidance Banner */}
      <ClientGuidanceBanner 
        clientId={clientId}
        onRecordingStart={onRecordingStart || (() => {})}
        isMobileView={isMobileView}
        hasNoSessions={hasNoSessions}
      />
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em]">{t('mypraxis:profileForm.title')}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" data-test="client-more-options">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isDemo && (
              <DropdownMenuItem
                onClick={() => onNewSession && onNewSession()}
                data-test="new-session-button"
              >
                {t('mypraxis:profileForm.actions.newSession')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setIsDeleteModalOpen(true)}
              data-test="delete-client-button"
            >
              {t('mypraxis:profileForm.actions.deleteClient')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-5 space-y-4" data-test="client-form">
        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label htmlFor="fullName">{t('mypraxis:profileForm.fullName')}</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("fullName") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`}
                data-test="client-fullname-saved-check"
              />
            </div>
          </div>
          <Input
            ref={fullNameRef}
            id="fullName"
            value={formData.fullName || ""}
            onChange={(e) => handleChange(e, "fullName")}
            onBlur={(e) => handleBlur(e, "fullName")}
            onKeyDown={(e) => handleKeyDown(e, "fullName")}
            placeholder={t('mypraxis:profileForm.enterFullName')}
            className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
            data-test="client-fullname-input"
          />
        </div>

        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label htmlFor="email">{t('mypraxis:profileForm.email')}</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("email") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`}
                data-test="client-email-saved-check"
              />
            </div>
          </div>
          <Input
            ref={emailRef}
            id="email"
            type="email"
            value={formData.email || ""}
            onChange={(e) => handleChange(e, "email")}
            onBlur={(e) => handleBlur(e, "email", false, true)}
            onKeyDown={(e) => handleKeyDown(e, "email")}
            placeholder={t('mypraxis:profileForm.enterEmail')}
            data-test="client-email-input"
            className={
              !validation.email
                ? "border-red-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                : "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
            }
          />
          {!validation.email && <p className="text-red-500 text-sm mt-1">{t('mypraxis:profileForm.validationErrors.email')}</p>}
        </div>

        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label htmlFor="phone">{t('mypraxis:profileForm.phone')}</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("phone") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`}
                data-test="client-phone-saved-check"
              />
            </div>
          </div>
          <Input
            ref={phoneRef}
            id="phone"
            value={formData.phone || ""}
            onChange={(e) => handleChange(e, "phone")}
            onBlur={(e) => handleBlur(e, "phone", true)}
            onKeyDown={(e) => handleKeyDown(e, "phone")}
            placeholder={t('mypraxis:profileForm.enterPhone')}
            data-test="client-phone-input"
            className={
              !validation.phone
                ? "border-red-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                : "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
            }
          />
          {!validation.phone && <p className="text-red-500 text-sm mt-1">{t('mypraxis:profileForm.validationErrors.phone')}</p>}
        </div>
      </div>

      <DeleteClientModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDelete={handleDeleteClient}
        clientName={client.fullName}
      />
    </div>
  )
}
