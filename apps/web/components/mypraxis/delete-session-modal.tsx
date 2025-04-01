"use client"

import { Button } from "@kit/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@kit/ui/dialog"

interface DeleteSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onDelete: () => void
  sessionTitle: string
}

export function DeleteSessionModal({ isOpen, onClose, onDelete, sessionTitle }: DeleteSessionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Session</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>Are you sure you want to delete "{sessionTitle}"?</p>
            <p className="text-destructive">This action cannot be undone.</p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

