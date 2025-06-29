'use client';

import { useClientArtifact } from '../../app/home/(user)/mypraxis/_lib/hooks/use-client-artifacts';
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppEvents } from '@kit/shared/events';
import type { AppEvents } from '../../lib/app-events';

interface ClientConceptualizationProps {
  clientId: string;
}

export function ClientConceptualization({ clientId }: ClientConceptualizationProps) {
  const { t } = useTranslation();
  const { emit } = useAppEvents<AppEvents>();
  
  // Fetch the conceptualization for the client
  const { 
    data: conceptualizationData, 
    isLoading: isLoadingConceptualization,
    error,
    refetch: _refetch // Renamed to indicate it's unused
  } = useClientArtifact(clientId, 'client_conceptualization', !!clientId);
  
  // We no longer need to force refetch as we're using prefetching
  // This commented code is kept for reference
  /*
  useEffect(() => {
    // Force refetch when component mounts
    refetch();
    
    // Also refetch when component becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset cache and force refetch
        queryClient.resetQueries({ queryKey: ['client', clientId, 'artifact', 'client_conceptualization'] });
        refetch();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clientId, refetch, queryClient]);
  */
  
  // Track if the conceptualization is stale (being updated)
  const [isConceptualizationStale, setIsConceptualizationStale] = useState(false);
  
  // Update stale state when data changes
  useEffect(() => {
    if (conceptualizationData) {
      setIsConceptualizationStale(conceptualizationData.stale);
    }
  }, [conceptualizationData]);
  
  // Copy functionality
  const [isCopied, setIsCopied] = useState(false);
  const copyTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const handleCopyText = (text: string | undefined) => {
    if (!text) return;
    
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    
    // Emit analytics event for artifact copy
    emit({
      type: 'ArtifactCopied',
      payload: {
        client_id: clientId,
        artifact_type: 'client_conceptualization'
      },
    });
    
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
        {t('mypraxis:clientConceptualization.title')}
      </h2>
      
      {isLoadingConceptualization ? (
        <div className="mt-5 flex items-center justify-center min-h-[200px]" data-test="client-conceptualization-loading">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('mypraxis:clientConceptualization.loading')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="mt-5 rounded-lg bg-destructive/10 p-3 text-destructive" data-test="client-conceptualization-error">
          <p className="font-medium">{t('mypraxis:clientConceptualization.error')}</p>
          <p className="text-sm mt-1">{t('mypraxis:clientConceptualization.tryAgain')}</p>
        </div>
      ) : !conceptualizationData ? (
        <div className="mt-5 rounded-lg bg-[#FFF9E8] p-3" data-test="client-conceptualization-empty">
          <p className="text-[#374151] text-[14px] leading-[1.6]">
            {t('mypraxis:clientConceptualization.notAvailable')}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-lg bg-[#FFF9E8] pb-10 pt-3 p-6 relative group" data-test="client-conceptualization-content">
          {isConceptualizationStale && (
            <div className="absolute right-2 top-2">
              <Badge variant="outline" className="flex items-center gap-1 bg-white">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>{t('mypraxis:clientConceptualization.updating')}</span>
              </Badge>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-transparent absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ top: isConceptualizationStale ? '40px' : '3px' }}
            onClick={() => handleCopyText(conceptualizationData.content)}
            data-test="copy-conceptualization-button"
          >
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <div className="markdown-content text-[#374151] text-[14px] leading-[1.6]">
            <ReactMarkdown>{conceptualizationData.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
