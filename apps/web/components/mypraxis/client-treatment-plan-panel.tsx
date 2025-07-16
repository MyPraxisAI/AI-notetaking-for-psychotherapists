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
import { EditableTextField } from './editable-text-field';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
    },
    onError: (error) => {
      toast.error(
        t('mypraxis:clientTreatmentPlan.saveError')
      );
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
  };

  // In display mode, show textValueLocal if defined, else server value

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
            <EditableTextField
              value={client?.treatment_plan || ''}
              onSave={newValue => {
                saveTreatmentPlan(newValue);
              }}
              isSaving={isSaving}
              placeholder={t('mypraxis:clientTreatmentPlan.placeholder')}
              minHeight={150}
              onCopy={() => {
                if (client?.treatment_plan) {
                  emit({
                    type: 'TreatmentPlanCopied',
                    payload: { client_id: clientId },
                  });
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
} 