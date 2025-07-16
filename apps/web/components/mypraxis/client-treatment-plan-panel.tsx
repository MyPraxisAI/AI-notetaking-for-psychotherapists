"use client";

import { useState, useRef, useEffect } from 'react';
import { Loader2, Copy, Check, Edit2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { useTranslation } from 'react-i18next';
import { useAppEvents } from '@kit/shared/events';
import type { AppEvents } from '../../lib/app-events';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@kit/ui/textarea';
import { toast } from 'sonner';

interface ClientTreatmentPlanPanelProps {
  clientId: string;
}

export function ClientTreatmentPlanPanel({ clientId }: ClientTreatmentPlanPanelProps) {
  const { t } = useTranslation();
  const { emit } = useAppEvents<AppEvents>();
  const queryClient = useQueryClient();

  // Fetch the client treatment plan
  const {
    data: client,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}`);
      if (!res.ok) throw new Error('Failed to fetch client');
      return res.json();
    },
    enabled: !!clientId,
  });

  // Local state for editing and optimistic UI
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [textValueLocal, setTextValueLocal] = useState<string | undefined>(undefined);
  const [isCopied, setIsCopied] = useState(false);
  // Remove all height state, ResizeObserver, and setTimeout logic
  // Only keep refs for textarea (for auto-resize)
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea on value change
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editValue]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editValue.length, editValue.length);
    }
  }, [isEditing, editValue]);

  // When entering edit mode, set editValue and textValueLocal
  useEffect(() => {
    if (isEditing) {
      setEditValue(textValueLocal ?? client?.treatment_plan ?? '');
    }
  }, [isEditing, client?.treatment_plan, textValueLocal]);

  // Keep showing the optimistic value until the server value matches it
  useEffect(() => {
    if (textValueLocal !== undefined && client?.treatment_plan === textValueLocal) {
      setTextValueLocal(undefined);
    }
  }, [client?.treatment_plan, textValueLocal]);

  // Save mutation (PATCH)
  const { mutate: saveTreatmentPlan, isPending: isSaving } = useMutation({
    mutationFn: async (newPlan: string) => {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treatment_plan: newPlan }),
      });
      if (!res.ok) throw new Error('Failed to update treatment plan');
      return res.json();
    },
    onMutate: (newPlan) => {
      // Optimistically update local state
      setTextValueLocal(newPlan);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setIsEditing(false);
      // Do not reset textValueLocal here; let the effect above handle it
    },
    onError: (error) => {
      toast.error(
        t('mypraxis:clientTreatmentPlan.saveError')
      );
      setTextValueLocal(client?.treatment_plan ?? ''); // Revert on error
    },
  });

  // Emit TreatmentPlanViewed when the treatment plan is loaded
  useEffect(() => {
    if (client && client.treatment_plan !== undefined) {
      emit({
        type: 'TreatmentPlanViewed',
        payload: { client_id: clientId },
      });
    }
  }, [client, clientId, emit]);

  // Handle copy
  const handleCopy = () => {
    if (!client?.treatment_plan) return;
    navigator.clipboard.writeText(client.treatment_plan);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1200);
    emit({
      type: 'TreatmentPlanCopied',
      payload: { client_id: clientId },
    });
  };

  // Handle save on blur
  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== client?.treatment_plan) {
      saveTreatmentPlan(editValue ?? '');
    }
  };

  // In display mode, show textValueLocal if defined, else server value
  const displayTreatmentPlan =
    typeof textValueLocal === 'string' && textValueLocal !== client?.treatment_plan
      ? textValueLocal
      : client?.treatment_plan;

  const title = t('mypraxis:clientTreatmentPlan.title');
  const loadingText = t('mypraxis:clientTreatmentPlan.loading');
  const errorText = t('mypraxis:clientTreatmentPlan.error');
  const tryAgainText = t('mypraxis:clientTreatmentPlan.tryAgain');
  const notAvailableText = t('mypraxis:clientTreatmentPlan.notCreated');

  return (
    <div className="w-full px-6 pt-6 bg-white">
      <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em] truncate">
        {title}
      </h2>
      <div className="mt-6">{/* Add spacing between title and text field */}
        {isLoading ? (
          <div className="mt-5 flex items-center justify-center min-h-[120px]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{loadingText}</p>
            </div>
          </div>
        ) : error ? (
          <div className="mt-5 rounded-lg bg-destructive/10 p-3 text-destructive">
            <p className="font-medium">{errorText}</p>
            <p className="text-sm mt-1">{tryAgainText}</p>
          </div>
        ) : (
          <div className="w-full">
            <div className={isEditing ? "bg-white rounded-lg min-h-[100px] w-full" : "rounded-lg bg-[#FFF9E8] p-6 min-h-[100px] w-full relative group"}>
              {isEditing ? (
                <Textarea
                  ref={textareaRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={handleBlur}
                  style={{ height: 'auto', overflow: 'hidden' }}
                  className="min-h-[150px] p-6 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] [&::-webkit-resizer]:appearance-none after:content-[''] after:absolute after:bottom-1 after:right-1 after:w-3 after:h-3 after:border-b-2 after:border-r-2 after:border-[#6B7280] after:cursor-se-resize relative text-[14px] leading-[1.6]"
                  autoFocus
                  data-test="treatment-plan-input"
                />
              ) : (
                <>
                  <div
                    className="w-full h-full min-h-[100px] text-[14px] leading-[1.6] whitespace-pre-wrap cursor-pointer"
                    onClick={() => {
                      setEditValue(displayTreatmentPlan || '');
                      setIsEditing(true);
                    }}
                  >
                    {isLoading ? null : (displayTreatmentPlan || notAvailableText)}
                  </div>
                  <div className="absolute right-2 top-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-transparent"
                      onClick={handleCopy}
                    >
                      {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 transition-opacity ${isSaving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      onClick={() => setIsEditing(true)}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Edit2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 