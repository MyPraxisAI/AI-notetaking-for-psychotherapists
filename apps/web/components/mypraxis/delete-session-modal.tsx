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
import { useTranslation } from "react-i18next"

interface DeleteSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onDelete: () => void
  sessionTitle: string
}

export function DeleteSessionModal({ isOpen, onClose, onDelete, sessionTitle }: DeleteSessionModalProps) {
  const { t } = useTranslation();
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('mypraxis:deleteSessionModal.title')}</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>{t('mypraxis:deleteSessionModal.confirmationText', { sessionTitle })}</p>
            <p className="text-destructive">{t('mypraxis:deleteSessionModal.warningText')}</p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('mypraxis:deleteSessionModal.cancelButton')}
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            {t('mypraxis:deleteSessionModal.deleteButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

