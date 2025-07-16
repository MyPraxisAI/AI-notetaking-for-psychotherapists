"use client";

import { useClientArtifact } from '../../app/home/(user)/mypraxis/_lib/hooks/use-client-artifacts';
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppEvents } from '@kit/shared/events';
import type { AppEvents } from '../../lib/app-events';
import { useSessions } from '../../app/home/(user)/mypraxis/_lib/hooks/use-sessions';

type ArtifactType = 'client_bio' | 'client_conceptualization' | 'client_prep_note';
type I18nObject = 'clientBio' | 'clientConceptualization' | 'clientPrepNote';

interface ClientArtifactPanelProps {
  clientId: string;
  artifactType: ArtifactType;
  i18nObject: I18nObject;
}

export function ClientArtifactPanel({ clientId, artifactType, i18nObject }: ClientArtifactPanelProps) {
  const { t } = useTranslation();
  const { emit } = useAppEvents<AppEvents>();

  // Fetch the artifact for the client
  const {
    data: artifactData,
    isLoading,
    error
  } = useClientArtifact(clientId, artifactType, !!clientId);

  // Fetch sessions for the client
  const { data: sessions = [] } = useSessions(clientId);
  const hasSessions = sessions.length > 0;

  // Track if the artifact is stale (being updated)
  const [isStale, setIsStale] = useState(false);
  useEffect(() => {
    if (artifactData) {
      setIsStale(artifactData.stale);
    }
  }, [artifactData]);

  // Copy functionality
  const [isCopied, setIsCopied] = useState(false);
  const copyTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleCopyText = (text: string | undefined) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    emit({
      type: 'ArtifactCopied',
      payload: {
        client_id: clientId,
        artifact_type: artifactType
      },
    });
    if (copyTimeout.current) {
      clearTimeout(copyTimeout.current);
    }
    copyTimeout.current = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  // i18n keys
  const title = t(`mypraxis:${i18nObject}.title`);
  const loadingText = t(`mypraxis:${i18nObject}.loading`);
  const errorText = t(`mypraxis:${i18nObject}.error`);
  const tryAgainText = t(`mypraxis:${i18nObject}.tryAgain`);
  const notAvailableText = t(`mypraxis:${i18nObject}.notAvailable`);
  const updatingText = t(`mypraxis:${i18nObject}.updating`);

  return (
    <div className="w-full px-6 pt-6 bg-white">
      <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em] truncate">
        {title}
      </h2>
      {isLoading ? (
        <div className="mt-5 flex items-center justify-center min-h-[200px]" data-test={`client-${artifactType}-loading`}>
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{loadingText}</p>
          </div>
        </div>
      ) : error ? (
        <div className="mt-5 rounded-lg bg-destructive/10 p-3 text-destructive" data-test={`client-${artifactType}-error`}>
          <p className="font-medium">{errorText}</p>
          <p className="text-sm mt-1">{tryAgainText}</p>
        </div>
      ) : !artifactData ? (
        <div className="mt-5 rounded-lg bg-[#FFF9E8] p-3 relative" data-test={`client-${artifactType}-empty`}>
          {hasSessions && (
            <div className="absolute right-2 top-2">
              <Badge variant="outline" className="flex items-center gap-1 bg-white">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>{updatingText}</span>
              </Badge>
            </div>
          )}
          <p className="text-[#374151] text-[14px] leading-[1.6]">
            {notAvailableText}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-lg bg-[#FFF9E8] pb-10 pt-3 p-6 relative group" data-test={`client-${artifactType}-content`}>
          {isStale && (
            <div className="absolute right-2 top-2">
              <Badge variant="outline" className="flex items-center gap-1 bg-white">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>{updatingText}</span>
              </Badge>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-transparent absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ top: isStale ? '40px' : '3px' }}
            onClick={() => handleCopyText(artifactData.content)}
            data-test={`copy-${artifactType}-button`}
          >
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <div className="markdown-content text-[#374151] text-[14px] leading-[1.6]">
            <ReactMarkdown>{artifactData.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
} 