'use client';

import { useClientArtifact } from '../../app/home/(user)/mypraxis/_lib/hooks/use-client-artifacts';
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ClientBioProps {
  clientId: string;
  clientName: string;
}

export function ClientBio({ clientId, clientName }: ClientBioProps) {
  const { t } = useTranslation();
  
  // Fetch the bio for the client
  const { 
    data: bioData, 
    isLoading: isLoadingBio,
    error
  } = useClientArtifact(clientId, 'client_bio', !!clientId);
  
  // Track if the bio is stale (being updated)
  const [isBioStale, setIsBioStale] = useState(false);
  
  // Update stale state when data changes
  useEffect(() => {
    if (bioData) {
      setIsBioStale(bioData.stale);
    }
  }, [bioData]);
  
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
      <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em] truncate">
        {t('mypraxis:clientBio.title')}
      </h2>
      
      {isLoadingBio ? (
        <div className="mt-5 flex items-center justify-center min-h-[200px]" data-test="client-bio-loading">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('mypraxis:clientBio.loading')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="mt-5 rounded-lg bg-destructive/10 p-6 text-destructive" data-test="client-bio-error">
          <p className="font-medium">{t('mypraxis:clientBio.error')}</p>
          <p className="text-sm mt-1">{t('mypraxis:clientBio.tryAgain')}</p>
        </div>
      ) : !bioData ? (
        <div className="mt-5 rounded-lg bg-[#FFF9E8] p-6" data-test="client-bio-empty">
          <p className="text-[#374151] text-[14px] leading-[1.6]">
            {t('mypraxis:clientBio.notAvailable')}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-lg bg-[#FFF9E8] p-6 relative group" data-test="client-bio-content">
          {isBioStale && (
            <div className="absolute right-2 top-2">
              <Badge variant="outline" className="flex items-center gap-1 bg-white">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>{t('mypraxis:clientBio.updating')}</span>
              </Badge>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-transparent absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ top: isBioStale ? '40px' : '3px' }}
            onClick={() => handleCopyText(bioData.content)}
            data-test="copy-bio-button"
          >
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <div className="markdown-content text-[#374151] text-[14px] leading-[1.6]">
            <ReactMarkdown>{bioData.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
