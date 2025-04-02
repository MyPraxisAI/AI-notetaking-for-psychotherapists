"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@kit/ui/input"
import { Label } from "@kit/ui/label"
import { Check, MoreVertical } from "lucide-react"
import type { Client, ValidationState } from "../../types/client"
import { Button } from "@kit/ui/button"
import { DeleteClientModal } from "../mypraxis/delete-client-modal"
import { useRouter } from "next/navigation"
import type React from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@kit/ui/dropdown-menu"

interface ProfileFormProps {
  clientId: string
  onNameChange?: (name: string) => void
  onClientDeleted: (clientId: string) => void
}

export function ProfileForm({ clientId, onNameChange, onClientDeleted }: ProfileFormProps) {
  const [client, setClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState<Partial<Client>>({})
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set())
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [validation, setValidation] = useState<ValidationState>({
    email: true,
    phone: true,
    emergencyPhone: true,
  })
  // Add a new state to track the last saved values
  const [savedValues, setSavedValues] = useState<Partial<Client>>({})

  // Refs for all input fields
  const fullNameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)

  const saveTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const router = useRouter()

  // Update the useEffect that loads client data to also set the initial saved values
  useEffect(() => {
    const clientsData = localStorage.getItem("clients")
    if (clientsData) {
      const clients = JSON.parse(clientsData)
      const currentClient = clients.find((c: Client) => c.id === clientId)
      if (currentClient) {
        setClient(currentClient)
        setFormData(currentClient)
        setSavedValues(currentClient) // Initialize saved values with current client data
      }
    }
  }, [clientId])

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
    return /^\d*$/.test(phone)
  }

  // Modify the saveField function to update the savedValues state
  const saveField = (field: string, value: any) => {
    if (!client) return

    // Check if the value has actually changed
    if (savedValues[field as keyof Client] === value) {
      return // Don't save or show checkmark if no change
    }

    const updatedClient = {
      ...client,
      [field]: value,
    }

    const clientsData = localStorage.getItem("clients")
    const clients = clientsData ? JSON.parse(clientsData) : []
    const updatedClients = clients.map((c: Client) => (c.id === clientId ? updatedClient : c))
    localStorage.setItem("clients", JSON.stringify(updatedClients))

    setClient(updatedClient)

    // Update the saved values with the new value
    setSavedValues((prev) => ({
      ...prev,
      [field]: value,
    }))

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
    isPhone = false,
    isEmail = false,
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
        [field === "phone" ? "phone" : "emergencyPhone"]: isValid,
      }))
      if (!isValid) return
    }

    saveField(field, value)
  }

  const handleDeleteClient = () => {
    const clientsData = localStorage.getItem("clients")
    if (clientsData) {
      const clients = JSON.parse(clientsData)

      // Find the client to be deleted
      const clientToDelete = clients.find((c: Client) => c.id === clientId)
      if (!clientToDelete) {
        console.error("Client not found:", clientId)
        return
      }

      // Filter out the client
      const updatedClients = clients.filter((c: Client) => c.id !== clientId)

      // Update localStorage
      localStorage.setItem("clients", JSON.stringify(updatedClients))

      // Clear any selected session for this client
      const selectedSession = localStorage.getItem("selectedSession")
      if (selectedSession) {
        const parsed = JSON.parse(selectedSession)
        if (parsed.clientId === clientId) {
          localStorage.removeItem("selectedSession")
        }
      }

      // Clear any sessions for this client
      const sessionsData = localStorage.getItem("sessions")
      if (sessionsData) {
        const sessions = JSON.parse(sessionsData)
        delete sessions[clientId]
        localStorage.setItem("sessions", JSON.stringify(sessions))
      }

      // Notify parent component about deletion
      onClientDeleted(clientId)
    }
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

  if (!client || !formData) return null

  return (
    <div className="w-full px-6 pt-6 border-r border-[#E5E7EB] bg-white">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em]">Client Profile</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setIsDeleteModalOpen(true)}
            >
              Delete client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-5 space-y-4">
        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("fullName") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
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
            placeholder="Enter full name"
            className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
          />
        </div>

        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label htmlFor="email">Email</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("email") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
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
            placeholder="Enter email address"
            className={
              !validation.email
                ? "border-red-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                : "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
            }
          />
          {!validation.email && <p className="text-red-500 text-sm mt-1">Please enter a valid email address</p>}
        </div>

        <div className="relative space-y-3">
          <div className="flex items-center">
            <Label htmlFor="phone">Phone</Label>
            <div className="w-5 h-5 ml-2">
              <Check 
                className={`h-5 w-5 transition-opacity ${
                  savedFields.has("phone") 
                    ? "opacity-100" 
                    : "opacity-0"
                } text-green-500`} 
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
            placeholder="Enter phone number"
            className={
              !validation.phone
                ? "border-red-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                : "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
            }
          />
          {!validation.phone && <p className="text-red-500 text-sm mt-1">Please enter numbers only</p>}
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
