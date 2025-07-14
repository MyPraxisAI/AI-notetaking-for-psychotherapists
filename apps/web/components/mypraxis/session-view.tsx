"use client"

import "../../styles/markdown.css"
import { useEffect, useRef, useState, useTransition, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import { useAppEvents } from '@kit/shared/events'
import type { AppEvents } from '../../lib/app-events'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kit/ui/tabs"
import { SessionMetadata } from "../../types/session"
import { Textarea } from "@kit/ui/textarea"
import { Label } from "@kit/ui/label"
import { Check, Edit2, Plus, Copy, MoreVertical, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@kit/ui/button"
import { Input } from "@kit/ui/input"
import { Badge } from "@kit/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@kit/ui/dropdown-menu"
import { DeleteSessionModal } from "../mypraxis/delete-session-modal"
import type { Session } from "../../types/session"
import { useSession, useDeleteSession } from "../../app/home/(user)/mypraxis/_lib/hooks/use-sessions"
import { useSessionArtifact } from "../../app/home/(user)/mypraxis/_lib/hooks/use-session-artifacts"
import { useRecordingStatus } from "../../app/home/(user)/mypraxis/_lib/hooks/use-recording-status"
import { updateSessionAction, generateSessionTitleAction } from "../../app/home/(user)/mypraxis/_lib/server/server-actions"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import { transcriptExists } from '@kit/web-bg-common/client';
import type { TranscriptSegment } from '@kit/web-bg-common';

interface TranscriptContentProps {
  clientId: string
  sessionId: string
  session: Session | null
  handleSessionUpdate: (result: { 
    success: boolean, 
    session?: { 
      id: string; 
      title: string | null; 
      note: string | null; 
      metadata: unknown;
    } 
  }, currentSession: Session) => void
  handleCopyText: (text: string | undefined, type: 'therapist' | 'client' | 'note' | 'transcript') => void
  isTranscriptCopied: boolean
}

/**
 * Component to handle all transcript states:
 * 1. Transcript exists - show the transcript
 * 2. Recording is processing - show "Transcription in progress..."
 * 3. No transcript or recording - show empty state
 */
function TranscriptContent({ clientId, sessionId, session, handleSessionUpdate, handleCopyText, isTranscriptCopied }: TranscriptContentProps) {
  const { t } = useTranslation();
  
  // Disable polling if we already have a transcript
  const { data: recordingStatus, isLoading: isLoadingRecording } = useRecordingStatus(sessionId, {
    disablePolling: !!session?.transcript
  })
  
  // Add useTransition hook for async operations
  const [_isPending, startTransition] = useTransition()
  
  const queryClient = useQueryClient()
  
  // Handle transcript title generation when recording is complete
  useEffect(() => {
    // If recording status is defined and not processing
    if (recordingStatus !== undefined && !recordingStatus.isProcessing) {
      // Invalidate session data to ensure we have the latest transcript
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      
      // Check if we have a transcript
      if (session?.transcript) {        
        // Generate a title for the session now that the transcript is available
        startTransition(async () => {
          try {
            const result = await generateSessionTitleAction({
              id: sessionId,
              clientId: clientId
            });
          
            if (result.success && result.session) {            
              // Update the parent session component
              if (session) {
                handleSessionUpdate(result, session);
              }
            }
          } catch (error) {
            console.error("[TranscriptContent] Error generating title:", error);
          }
        });
      }
    }

    return () => {};
  }, [recordingStatus, sessionId, queryClient, session, clientId, handleSessionUpdate]);
  
  // If we have a transcript, show it
  if (!session || !session.transcript || !transcriptExists(session.transcript)) {
    // fallback/empty state handled elsewhere
    return null;
  }
  // At this point, session and session.transcript are guaranteed
  const formatTimestamp = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  const speakerLabels: Record<string, string> = {
    therapist: t('mypraxis:sessionView.transcript.speakerLabels.therapist'),
    client: t('mypraxis:sessionView.transcript.speakerLabels.client'),
  };
  const isTherapist = (sp: string) => sp === 'therapist';
  const transcriptText = session.transcript.segments
    .filter(seg => seg.content.trim().length > 0)
    .map(seg => {
      const start = formatTimestamp(seg.start_ms);
      const end = formatTimestamp(seg.end_ms);
      const speakerLabel = speakerLabels[seg.speaker] || seg.speaker;
      return `[${start}-${end}] ${speakerLabel}: ${seg.content}`;
    })
    .join('\n');
  return (
    <div className="relative group">
      <div className="bg-[#FFF9E8] rounded-lg px-4 pt-8 pb-4 flex flex-col gap-2" data-test="session-transcript-value">
        {(session.transcript.segments as TranscriptSegment[]).map((seg, idx) => {
            const start = formatTimestamp(seg.start_ms);
            const end = formatTimestamp(seg.end_ms);
            const sp = seg.speaker;
            const speakerStyle = sp === 'therapist'
              ? { color: '#9C8856', fontWeight:
                 600 }
              : { color: '#111827', fontWeight: 600 };
            // Timestamp (right-aligned)
            const timestamp = start === end ? start : `${start} - ${end}`;
            return (
              <div key={idx} className="flex flex-col gap-0 mt-2">
                <div className="flex items-baseline justify-between w-full">
                  <span className="text-[14px] leading-tight font-medium" style={speakerStyle}>{sp === 'therapist' ? speakerLabels.therapist : speakerLabels.client}</span>
                  <span className="text-xs text-[#6B7280] ml-2">{timestamp}</span>
                </div>
                <div className="text-[14px] text-[#111827] leading-snug whitespace-pre-line break-words mt-0">
                  {seg.content}
                </div>
              </div>
            );
          })}
      </div>
      <div className="absolute right-2 top-2 flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-transparent"
          onClick={() => handleCopyText(transcriptText, 'transcript')}
          data-test="copy-transcript-button"
        >
          {isTranscriptCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

interface SessionViewProps {
  clientId: string
  sessionId: string
  onDelete?: () => void
  isDemo?: boolean
}

export function SessionView({ clientId, sessionId, onDelete, isDemo = false }: SessionViewProps) {
  const { t } = useTranslation();
  const { emit } = useAppEvents<AppEvents>();
  const [userNote, setUserNote] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [noteHeight, setNoteHeight] = useState<number>(150)
  const noteRef = useRef<HTMLDivElement>(null)
  const placeholderRef = useRef<HTMLDivElement>(null)

  const [isCopied, setIsCopied] = useState(false)
  const [isClientSummaryCopied, setIsClientSummaryCopied] = useState(false)
  const [isNoteCopied, setIsNoteCopied] = useState(false)
  const [isTranscriptCopied, setIsTranscriptCopied] = useState(false)
  const [summaryView, setSummaryView] = useState<"therapist" | "client">("therapist")
  const [therapistSummary, setTherapistSummary] = useState<string | null>(null)
  const [clientSummary, setClientSummary] = useState<string | null>(null)
  const [isLoadingTherapistSummary, setIsLoadingTherapistSummary] = useState(false)
  const [isLoadingClientSummary, setIsLoadingClientSummary] = useState(false)
  const [isTherapistSummaryStale, setIsTherapistSummaryStale] = useState(false)
  const [isClientSummaryStale, setIsClientSummaryStale] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [activeTab, setActiveTabState] = useState<"summary" | "transcript">("summary")
  
  const setActiveTab = useCallback((tab: "summary" | "transcript") => {
    setActiveTabState(tab);
  }, []);
  
  const [isTitleSaved, setIsTitleSaved] = useState(false)
  const _saveTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const copyTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const clientCopyTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const titleSaveTimeout = useRef<NodeJS.Timeout | undefined>(undefined)

  // Use the session hook from Supabase to load session data
  const { data: sessionData, isLoading: isLoadingSession } = useSession(sessionId)
  
  // Track if we've emitted the initial therapist summary view event
  const [hasEmittedInitialView, setHasEmittedInitialView] = useState(false)
  
  // Always fetch both summaries regardless of active tab
  const { 
    data: therapistSummaryData, 
    isLoading: isLoadingTherapistSummaryQuery,
    refetch: refetchTherapistSummary
  } = useSessionArtifact(
    sessionId, 
    'session_therapist_summary', 
    transcriptExists(sessionData?.transcript ?? null) || !!sessionData?.note
  )
  
  // Always fetch client summary regardless of active tab
  const { 
    data: clientSummaryData, 
    isLoading: isLoadingClientSummaryQuery,
    refetch: refetchClientSummary
  } = useSessionArtifact(
    sessionId, 
    'session_client_summary', 
    !!(sessionData?.transcript || sessionData?.note) // Remove conditional based on active tab
  )
  
  // Update local state when session data changes
  useEffect(() => {
    if (sessionData) {
      // Convert SessionWithId to Session format
      const formattedSession: Session = {
        id: sessionData.id,
        date: new Date(sessionData.createdAt).toISOString().split('T')[0] || '',
        title: sessionData.title,
        createdAt: sessionData.createdAt,
        transcript: sessionData.transcript,
        notes: sessionData.note ? {
          userNote: sessionData.note
        } : undefined
      }
      
      setSession(formattedSession)
      setUserNote(sessionData.note || "")
    }
  }, [sessionData])
  
  // Listen for custom tab change events
  useEffect(() => {
    // Handler for the custom event
    const handleTabChange = (event: CustomEvent<{ tab: 'transcript' | 'notes', sessionId: string }>) => {
      const { tab, sessionId: targetSessionId } = event.detail;
      
      
      // Only handle events for this session
      if (targetSessionId === sessionId) {
        
        // Set the active tab directly using state
        if (tab === 'transcript') {
          console.log(`Setting active tab to transcript`);
          setActiveTab('transcript');
        } else if (tab === 'notes' || tab === 'summary') {
          console.log(`Setting active tab to summary (notes)`);
          setActiveTab('summary');
        }
      }
    };
    
    // Add event listener
    window.addEventListener('sessionTabChange', handleTabChange as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('sessionTabChange', handleTabChange as EventListener);
    };
  }, [sessionId, setActiveTab])
  
  // Effect to measure the displayed note's height when switching to edit mode
  useEffect(() => {
    if (!isEditing) {
      if (noteRef.current) {
        // Get the height of the displayed note
        const height = noteRef.current.clientHeight;
        // Set the height state for the textarea
        setNoteHeight(height);
      } else if (placeholderRef.current) {
        // If there's no note yet, get the height of the placeholder button
        const height = placeholderRef.current.clientHeight;
        // Set the height state for the textarea
        setNoteHeight(height);
      }
    }
  }, [isEditing, userNote]);
  
  // Update local summary state when query data changes
  useEffect(() => {
    if (therapistSummaryData) {
      setTherapistSummary(therapistSummaryData.content)
      // If the artifact is stale, set the stale state but don't show loading
      setIsTherapistSummaryStale(!!therapistSummaryData.stale)
      setIsLoadingTherapistSummary(false)
    } else {
      // If there's no data, show loading state (404 case)
      setIsLoadingTherapistSummary(true)
    }
  }, [therapistSummaryData])

  // Emit initial ArtifactViewed event for default therapist summary
  useEffect(() => {
    if (
      !hasEmittedInitialView &&
      activeTab === "summary" &&
      summaryView === "therapist" &&
      therapistSummary &&
      !isLoadingTherapistSummary
    ) {
      emit({
        type: 'ArtifactViewed',
        payload: {
          client_id: clientId,
          session_id: sessionId,
          artifact_type: 'session_therapist_summary'
        },
      });
      setHasEmittedInitialView(true);
    }
  }, [
    hasEmittedInitialView,
    activeTab,
    summaryView,
    therapistSummary,
    isLoadingTherapistSummary,
    emit,
    clientId,
    sessionId
  ])
  
  useEffect(() => {
    if (clientSummaryData) {
      setClientSummary(clientSummaryData.content)
      // If the artifact is stale, set the stale state but don't show loading
      setIsClientSummaryStale(!!clientSummaryData.stale)
      setIsLoadingClientSummary(false)
    } else {
      // If there's no data, show loading state (404 case)
      setIsLoadingClientSummary(true)
    }
  }, [clientSummaryData])
  
  // Initialize loading states based on query loading state
  useEffect(() => {
    setIsLoadingTherapistSummary(isLoadingTherapistSummaryQuery)
  }, [isLoadingTherapistSummaryQuery])
  
  useEffect(() => {
    setIsLoadingClientSummary(isLoadingClientSummaryQuery)
  }, [isLoadingClientSummaryQuery])
  
  // Reset and refetch summaries when content changes
  const resetAndRefetchSummaries = () => {
    // Reset the local state for summaries
    setTherapistSummary(null)
    setClientSummary(null)
    
    // Explicitly set loading states to true
    setIsLoadingTherapistSummary(true)
    setIsLoadingClientSummary(true)
    
    // Clear any existing summary data from the UI
    setTherapistSummary(null)
    setClientSummary(null)
  }
  
  // Force refresh all client artifacts
  const refreshClientArtifacts = () => {
    // Invalidate all client artifacts in the cache
    queryClient.invalidateQueries({ queryKey: ['client', clientId, 'artifact'] })
    
    // Force refetch by setting stale time to 0 for all client artifacts
    queryClient.setQueryDefaults(['client', clientId, 'artifact'], {
      staleTime: 0
    })
    
    // Manually refetch all client artifact queries
    queryClient.refetchQueries({ queryKey: ['client', clientId, 'artifact'] })
  }

  // Use React's useTransition for pending state
  const [_isPending, startTransition] = useTransition()
  
  // Get the query client for invalidating queries
  const queryClient = useQueryClient()
  
  /**
   * Helper method to update the session with data from a server action response
   * @param result The result from a server action
   * @param currentSession The current session state
   */
  const handleSessionUpdate = (result: { 
    success: boolean, 
    session?: { 
      id: string; 
      title: string | null; 
      note: string | null; 
      metadata: unknown;
    } 
  }, currentSession: Session) => {
    if (result.success && result.session) {
      // Update the session with the returned data including the potentially auto-generated title
      // Convert the database record to a Session object
      const updatedSession = {
        ...currentSession,
        id: result.session.id,
        title: result.session.title || '',
        // Keep the existing transcript data as it's now stored in a separate table
        notes: result.session.note ? { userNote: result.session.note } : undefined,
        metadata: result.session.metadata as SessionMetadata | undefined
      }
      
      // Update the session state
      setSession(updatedSession)
      
      // Update localStorage and dispatch event for column-4 list if title changed
      if (currentSession.title !== result.session.title) {
        const sessionsData = localStorage.getItem("sessions")
        if (sessionsData) {
          const sessions = JSON.parse(sessionsData)
          if (!sessions[clientId]) {
            sessions[clientId] = {}
          }
          sessions[clientId][sessionId] = result.session
          localStorage.setItem("sessions", JSON.stringify(sessions))
        }

        // Force parent update with the new title
        window.dispatchEvent(
          new CustomEvent("sessionTitleChanged", {
            detail: { 
              clientId, 
              sessionId, 
              title: result.session.title || '', 
              session: result.session 
            },
          }),
        )
      }
      
      return updatedSession
    }
    
    return currentSession
  }
  

  
  /**
   * Handle saving the session title
   * @param title The title to save
   */
  const handleSaveTitle = (title: string) => {
    if (session) {
      // Store the previous session for rollback if needed
      const previousSession = { ...session }
      
      // Use startTransition to indicate pending state
      startTransition(async () => {
        try {
          // Call the server action directly
          const result = await updateSessionAction({
            id: sessionId,
            clientId,
            title: title,
            note: session.notes?.userNote || ''
          });
          
          // Update the session with the returned data
          handleSessionUpdate(result, session)
          
          // Hide the title editing UI
          setIsEditingTitle(false);
          
          // Show the checkmark
          setIsTitleSaved(true);
          
          // Clear any existing timeout
          if (titleSaveTimeout.current) {
            clearTimeout(titleSaveTimeout.current);
          }
          
          // Set timeout to hide the checkmark after 1 second
          titleSaveTimeout.current = setTimeout(() => {
            setIsTitleSaved(false);
          }, 1000);
          
          // Show success toast
          toast.success("Title saved");
        } catch (error) {
          // Error handling - revert to previous state
          setSession(previousSession);
          toast.error("Failed to save title");
          console.error("Error saving title:", error);
        }
      });
    } else {
      // Just hide the editing UI if there's no session
      setIsEditingTitle(false);
    }
  }

  const handleSaveNote = (note: string) => {
    if (session) {
      // Check if the note content has actually changed
      const currentNote = session.notes?.userNote || "";
      if (note === currentNote) {
        // If the note hasn't changed, just exit edit mode without any updates
        setIsEditing(false);
        return;
      }
      
      // Calculate the change in character count for analytics
      const changeSizeChars = note.length - currentNote.length;
      
      // Optimistically update the UI
      const previousSession = { ...session };
      
      // Update the session with the new note
      const updatedSession = {
        ...session,
        notes: { userNote: note }
      };
      
      setSession(updatedSession);
      
      // Use startTransition to indicate pending state
      startTransition(async () => {
        try {
          // Call the server action directly
          const result = await updateSessionAction({
            id: sessionId,
            clientId,
            title: session.title,
            note: note
          });
          
          // Update the session with the returned data
          handleSessionUpdate(result, session);
          
          // Emit analytics event for session note update
          emit({
            type: 'SessionNoteUpdated',
            payload: {
              session_id: sessionId,
              client_id: clientId,
              change_size_chars: changeSizeChars,
            },
          });
          
          // Success handling
          toast.success("Note saved");
          
          // Reset and refetch summaries
          resetAndRefetchSummaries();
          
          // Invalidate session artifacts in the cache
          queryClient.invalidateQueries({ queryKey: ['session', sessionId, 'artifact'] });
          
          // Force refresh all client artifacts
          refreshClientArtifacts();
          
          // Force refetch of summaries
          setTimeout(() => {
            if (summaryView === 'therapist') {
              refetchTherapistSummary();
            } else {
              refetchClientSummary();
            }
          }, 500); // Small delay to ensure the invalidation has completed
        } catch (error) {
          // Error handling - revert to previous state
          setSession(previousSession);
          toast.error("Failed to save note");
          console.error("Error saving note:", error);
        }
      });
    }
  }

  const handleCopyText = (text: string | undefined, type: 'therapist' | 'client' | 'note' | 'transcript' = 'therapist') => {
    if (!text) return;
    
    navigator.clipboard.writeText(text)
    
    // Emit analytics event for artifact copy (only for summaries, not notes)
    if (type === 'therapist' || type === 'client') {
      emit({
        type: 'ArtifactCopied',
        payload: {
          client_id: clientId,
          session_id: sessionId,
          artifact_type: type === 'therapist' ? 'session_therapist_summary' : 'session_client_summary'
        },
      });
    } else if (type === 'transcript') {
      // Emit analytics event for transcript copy
      emit({
        type: 'SessionTranscriptCopied',
        payload: {
          session_id: sessionId,
          client_id: clientId,
        },
      });
    } else if (type === 'note') {
      // Emit analytics event for note copy
      emit({
        type: 'SessionNoteCopied',
        payload: {
          session_id: sessionId,
          client_id: clientId,
        },
      });
    }
    
    if (type === 'client') {
      setIsClientSummaryCopied(true)
      if (clientCopyTimeout.current) {
        clearTimeout(clientCopyTimeout.current)
      }
      clientCopyTimeout.current = setTimeout(() => {
        setIsClientSummaryCopied(false)
      }, 2000)
    } else if (type === 'note') {
      setIsNoteCopied(true)
      if (titleSaveTimeout.current) {
        clearTimeout(titleSaveTimeout.current)
      }
      titleSaveTimeout.current = setTimeout(() => {
        setIsNoteCopied(false)
      }, 2000)
    } else if (type === 'transcript') {
      setIsTranscriptCopied(true)
      if (copyTimeout.current) {
        clearTimeout(copyTimeout.current)
      }
      copyTimeout.current = setTimeout(() => {
        setIsTranscriptCopied(false)
      }, 2000)
    } else {
      setIsCopied(true)
      if (copyTimeout.current) {
        clearTimeout(copyTimeout.current)
      }
      copyTimeout.current = setTimeout(() => {
        setIsCopied(false)
      }, 2000)
    }
  }

  // Use the delete session hook from Supabase
  const deleteSession = useDeleteSession()

  const handleDeleteSession = () => {
    deleteSession.mutate({ sessionId, clientId }, {
      onSuccess: () => {
        // Emit analytics event for session deletion
        emit({
          type: 'SessionDeleted',
          payload: {
            session_id: sessionId,
            client_id: clientId,
          },
        });

        // Clear selected session if it's the current one
        const selectedSession = localStorage.getItem("selectedSession")
        if (selectedSession) {
          const parsed = JSON.parse(selectedSession)
          if (parsed.clientId === clientId && parsed.sessionId === sessionId) {
            localStorage.removeItem("selectedSession")
          }
        }

        // Notify parent component
        onDelete?.()
        setIsDeleteModalOpen(false)
        toast.success("Session deleted successfully")
      },
      onError: (error) => {
        toast.error("Failed to delete session")
        console.error("Error deleting session:", error)
        setIsDeleteModalOpen(false)
      }
    })
  }

  return (
    <div className="w-full px-6 pt-6 bg-white" data-test="session-view">
      <div className="space-y-1 mb-5">
        <div className="flex items-center justify-between group/title">
          <div className="flex items-center gap-2">
            {isEditingTitle ? (
              <Input
                value={session?.title || ""}
                onChange={(e) => {
                  const value = e.target.value
                  if (session) {
                    // Optimistically update the UI
                    const updatedSession = {
                      ...session,
                      title: value,
                    }
                    setSession(updatedSession)
                    
                    // Update localStorage and dispatch event for column-4 list
                    const sessionsData = localStorage.getItem("sessions")
                    if (sessionsData) {
                      const sessions = JSON.parse(sessionsData)
                      if (!sessions[clientId]) {
                        sessions[clientId] = {}
                      }
                      sessions[clientId][sessionId] = updatedSession
                      localStorage.setItem("sessions", JSON.stringify(sessions))
                    }

                    // Force parent update
                    window.dispatchEvent(
                      new CustomEvent("sessionTitleChanged", {
                        detail: { clientId, sessionId, title: value, session: updatedSession },
                      }),
                    )
                  }
                }}
                onBlur={() => {
                  // Save the title when the input loses focus
                  handleSaveTitle(session?.title || "")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSaveTitle(session?.title || "")
                  }
                }}
                className="h-8 text-[24px] font-semibold text-[#111827] tracking-[-0.011em] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] [&::-webkit-resizer]:appearance-none after:content-[''] after:absolute after:bottom-1 after:right-1 after:w-3 after:h-3 after:border-b-2 after:border-r-2 after:border-[#6B7280] after:cursor-se-resize relative"
                autoFocus
                data-test="session-title-input"
              />
            ) : (
              <>
                <div className="relative group">
                  {!isDemo && (
                    <div className="absolute -left-7 opacity-0 group-hover:opacity-100 transition-opacity flex items-center h-full">
                      <Edit2 className="h-4 w-4 text-gray-500" />
                    </div>
                  )}
                  <h2
                    className={`text-[24px] font-semibold text-[#111827] tracking-[-0.011em] truncate ${!isDemo ? 'cursor-pointer hover:text-[#374151] transition-colors' : ''}`}
                    onClick={() => {
                      if (!isDemo) {
                        setIsEditingTitle(true);
                      }
                    }}
                    data-test="session-title"
                  >
                    {session?.title || "New Session"}
                  </h2>
                </div>
                <div className="w-5 h-5 ml-2">
                  <Check 
                    className={`h-5 w-5 transition-opacity ${
                      isTitleSaved 
                        ? "opacity-100" 
                        : "opacity-0"
                    } text-green-500`}
                    data-test="session-title-saved-check"
                  />
                </div>
              </>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" data-test="session-options-button">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setIsDeleteModalOpen(true)}
                data-test="delete-session-option"
              >
                {t('mypraxis:sessionView.actions.deleteSession')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <span className="text-[14px] text-[#6B7280]" data-test="session-date">
          {session?.date || ""}
        </span>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={(value) => setActiveTab(value as "summary" | "transcript")} 
        className="w-full" 
        data-session-id={sessionId}
      >
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger
            value="summary"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827] data-[state=active]:bg-transparent px-4 py-2 font-medium text-[14px] text-[#6B7280] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
            data-tab="notes"
            data-test="notes-tab"
          >
            {t('mypraxis:sessionView.tabs.summary')}
          </TabsTrigger>
          <TabsTrigger
            value="transcript"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827] data-[state=active]:bg-transparent px-4 py-2 font-medium text-[14px] text-[#6B7280] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
            data-tab="transcript"
            data-test="transcript-tab"
          >
            {t('mypraxis:sessionView.tabs.transcript')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-5">
          <div className="space-y-5">
            <div className="relative space-y-3">
              <Label>{t('mypraxis:sessionView.notes.myNote')}</Label>
              {isLoadingSession ? (
                <div className="w-full h-[100px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{t('mypraxis:sessionView.loading')}</p>
                  </div>
                </div>
              ) : isEditing ? (
                <div className="relative">
                  <Textarea
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    onBlur={() => {
                      setIsEditing(false)
                      handleSaveNote(userNote)
                    }}
                    placeholder={t('mypraxis:sessionView.notes.placeholder')}
                    style={{ height: `${noteHeight}px` }}
                    className="min-h-[50px] p-6 resize-vertical focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] [&::-webkit-resizer]:appearance-none after:content-[''] after:absolute after:bottom-1 after:right-1 after:w-3 after:h-3 after:border-b-2 after:border-r-2 after:border-[#6B7280] after:cursor-se-resize relative text-[14px] leading-[1.6]"
                    autoFocus
                    data-test="session-note-input"
                  />
                </div>
              ) : userNote && userNote.trim() ? (
                <div className="relative group">
                  <div
                    ref={noteRef}
                    className={`rounded-lg bg-[#FFF9E8] p-6 text-[14px] leading-[1.6] min-h-[100px] whitespace-pre-wrap ${!isDemo ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (!isDemo) {
                        setIsEditing(true);
                      }
                    }}
                    data-test="session-note-value"
                  >
                    {userNote}
                  </div>
                  <div className="absolute right-2 top-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-transparent"
                      onClick={() => handleCopyText(userNote, 'note')}
                      data-test="copy-note-button"
                    >
                      {isNoteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    {!isDemo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  ref={placeholderRef}
                  className={`w-full h-[100px] border border-dashed border-input flex items-center justify-center ${!isDemo ? 'hover:border-input hover:bg-accent cursor-pointer' : ''}`}
                  onClick={() => {
                    if (!isDemo) {
                      setIsEditing(true);
                    }
                  }}
                  data-test="session-add-note-button"
                >
                  <span className="flex items-center gap-2">
                    {!isDemo && <Plus className="h-4 w-4" />}
                    {isDemo ? t('mypraxis:sessionView.notes.myNote') : t('mypraxis:sessionView.notes.addNote')}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Tabs
                value={summaryView}
                onValueChange={(v) => {
                  setSummaryView(v as "therapist" | "client");
                  
                  // Emit analytics event for artifact view
                  emit({
                    type: 'ArtifactViewed',
                    payload: {
                      client_id: clientId,
                      session_id: sessionId,
                      artifact_type: v === "therapist" ? 'session_therapist_summary' : 'session_client_summary'
                    },
                  });
                }}
                className="w-full"
              >
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                  <TabsTrigger
                    value="therapist"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827] data-[state=active]:bg-transparent px-4 py-2 font-medium text-[14px] text-[#6B7280] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
                    data-test="session-tab-therapist-summary"
                  >
                    {t('mypraxis:sessionView.summaryTabs.therapist')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="client"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827] data-[state=active]:bg-transparent px-4 py-2 font-medium text-[14px] text-[#6B7280] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
                    data-test="session-tab-client-summary"
                  >
                    {t('mypraxis:sessionView.summaryTabs.client')}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="therapist" className="mt-3" data-test="session-therapist-summary">
                  <div className="relative group">
                    {isLoadingTherapistSummary ? (
                      <div className="rounded-lg bg-[#FFF9E8] px-6 py-6 text-[14px] text-muted-foreground flex items-center justify-center min-h-[100px]">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t('mypraxis:sessionView.summary.loadingTherapist')}</span>
                        </div>
                      </div>
                    ) : therapistSummary ? (
                      <div className="relative">
                        <div className="rounded-lg bg-[#FFF9E8] px-6 pb-3 pt-3.5 text-[14px] leading-[1.6]">
                          {isTherapistSummaryStale && (
                            <div className="absolute right-2 top-2">
                              <Badge variant="outline" className="flex items-center gap-1 bg-white">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                <span>Updating</span>
                              </Badge>
                            </div>
                          )}
                          <div className="markdown-content">
                            <ReactMarkdown>{therapistSummary || ''}</ReactMarkdown>
                          </div>
                        </div>
                        <div className="absolute right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: isTherapistSummaryStale ? '40px' : '7px' }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-transparent"
                            onClick={() => handleCopyText(therapistSummary || '', 'therapist')}
                            data-test="copy-therapist-summary-button"
                          >
                            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>

                        </div>
                      </div>

                    ) : (
                      <div className="rounded-lg bg-[#FFF9E8] px-6 py-6 text-[14px] text-muted-foreground" data-test="therapist-summary-placeholder">
                        {t('mypraxis:sessionView.summary.therapistSummaryPlaceholder')}
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="client" className="mt-3" data-test="session-client-summary">
                  <div className="relative group">
                    {isLoadingClientSummary ? (
                      <div className="rounded-lg bg-[#FFF9E8] px-6 py-6 text-[14px] text-muted-foreground flex items-center justify-center min-h-[100px]">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t('mypraxis:sessionView.summary.loadingClient')}</span>
                        </div>
                      </div>
                    ) : clientSummary ? (
                      <div className="relative">
                        <div className="rounded-lg bg-[#FFF9E8] px-6 pb-3 pt-3.5 text-[14px] leading-[1.6]">
                          {isClientSummaryStale && (
                            <div className="absolute right-2 top-2">
                              <Badge variant="outline" className="flex items-center gap-1 bg-white">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                <span>Updating</span>
                              </Badge>
                            </div>
                          )}
                          <div className="markdown-content">
                            <ReactMarkdown>{clientSummary || ''}</ReactMarkdown>
                          </div>
                        </div>
                        <div className="absolute right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: isClientSummaryStale ? '40px' : '7px' }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-transparent"
                            onClick={() => handleCopyText(clientSummaryData?.content || '', 'client')}
                            data-test="copy-client-summary-button"
                          >
                            {isClientSummaryCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>

                        </div>
                      </div>

                    ) : (
                      <div className="rounded-lg bg-[#FFF9E8] px-6 py-6 text-[14px] text-muted-foreground" data-test="client-summary-placeholder">
                        {t('mypraxis:sessionView.summary.clientSummaryPlaceholder')}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transcript" className="relative" data-tab="transcript">
          <TranscriptContent
            clientId={clientId}
            sessionId={sessionId}
            session={session}
            handleSessionUpdate={handleSessionUpdate}
            handleCopyText={handleCopyText}
            isTranscriptCopied={isTranscriptCopied}
          />
        </TabsContent>
      </Tabs>

      {/* Delete Session Modal */}
      <DeleteSessionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDelete={handleDeleteSession}
        sessionTitle={session?.title || ""}
        data-test="delete-session-modal"
      />
    </div>
  )
}
