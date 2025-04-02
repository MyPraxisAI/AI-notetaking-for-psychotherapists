"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@kit/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@kit/ui/dialog"
import { Input } from "@kit/ui/input"

interface DeleteClientModalProps {
  isOpen: boolean
  onClose: () => void
  onDelete: () => void
  clientName: string
}

export function DeleteClientModal({ isOpen, onClose, onDelete, clientName }: DeleteClientModalProps) {
  const [inputName, setInputName] = useState("")
  const [error, setError] = useState(false)

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputName("")
      setError(false)
    }
  }, [isOpen])

  const handleDelete = () => {
    if (inputName.trim().toLowerCase() === clientName.trim().toLowerCase()) {
      onDelete()
      setInputName("") // Reset input
      setError(false)
      onClose()
    } else {
      setError(true)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputName(e.target.value)
    setError(false)
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setInputName("") // Reset input when closing
          setError(false)
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Client</DialogTitle>
          <DialogDescription>
            Please type <span className="font-medium">{clientName}</span> to confirm.
          </DialogDescription>
          <DialogDescription className="text-destructive mt-2">
            All client data will be perpetually deleted. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            placeholder="Enter client name"
            value={inputName}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleDelete()
              }
            }}
            className={`focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] ${error ? "border-red-500" : ""}`}
            autoComplete="off"
          />
          {error && <p className="text-sm text-red-500">Please enter the exact client name to confirm deletion</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

