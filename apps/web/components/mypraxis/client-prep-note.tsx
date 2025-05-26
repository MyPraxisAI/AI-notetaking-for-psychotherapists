'use client';

import { useClientArtifact } from '../../app/home/(user)/mypraxis/_lib/hooks/use-client-artifacts';
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

interface ClientPrepNoteProps {
  clientId: string;
}

export function ClientPrepNote({ clientId }: ClientPrepNoteProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Fetch the prep note for the client
  const { 
    data: prepNoteData, 
    isLoading: isLoadingPrepNote,
    isFetching,
    error,
    refetch: _refetch // Renamed to indicate it's unused
  } = useClientArtifact(clientId, 'client_prep_note', !!clientId);

  // Track if the prep note is stale (being updated)
  const [isPrepNoteStale, setIsPrepNoteStale] = useState(false);
  
  // Update stale state when data changes
  useEffect(() => {
    if (prepNoteData) {
      setIsPrepNoteStale(prepNoteData.stale);
    }
  }, [prepNoteData]);
  
  // Copy functionality
  const [isCopied, setIsCopied] = useState(false);
  const copyTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const handleCopyText = (text: string | undefined) => {
    if (!text) return;
    
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    
    if (copyTimeout.current) {
      clearTimeout(copyTimeout.current);
    }
    
    copyTimeout.current = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <div className="w-full px-6 pt-6 bg-white">
      <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em]">
        {t('mypraxis:clientPrepNote.title')}
      </h2>
      
      {isLoadingPrepNote ? (
        <div className="mt-5 flex items-center justify-center min-h-[200px]" data-test="client-prep-note-loading">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('mypraxis:clientPrepNote.loading')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="mt-5 rounded-lg bg-destructive/10 p-3 text-destructive" data-test="client-prep-note-error">
          <p className="font-medium">{t('mypraxis:clientPrepNote.error')}</p>
          <p className="text-sm mt-1">{t('mypraxis:clientPrepNote.tryAgain')}</p>
        </div>
      ) : !prepNoteData ? (
        <div className="mt-5 rounded-lg bg-[#FFF9E8] p-3" data-test="client-prep-note-empty">
          <p className="text-[#374151] text-[14px] leading-[1.6]">
            {t('mypraxis:clientPrepNote.notAvailable')}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-lg bg-[#FFF9E8] pb-10 pt-3 p-6 relative group" data-test="client-prep-note-content">
          {isPrepNoteStale && (
            <div className="absolute right-2 top-2">
              <Badge variant="outline" className="flex items-center gap-1 bg-white">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>{t('mypraxis:clientPrepNote.updating')}</span>
              </Badge>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-transparent absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ top: isPrepNoteStale ? '40px' : '3px' }}
            onClick={() => handleCopyText(prepNoteData.content)}
            data-test="copy-prep-note-button"
          >
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <div className="markdown-content text-[#374151] text-[14px] leading-[1.6]">
            <ReactMarkdown>{prepNoteData.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
