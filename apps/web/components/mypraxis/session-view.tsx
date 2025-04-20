"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kit/ui/tabs"
import { sessionTranscripts } from "../../data/mypraxis/session-transcripts"
import { Textarea } from "@kit/ui/textarea"
import { Label } from "@kit/ui/label"
import { Check, Edit2, Plus, Copy, MoreVertical, Loader2 } from "lucide-react"
import { Button } from "@kit/ui/button"
import { Input } from "@kit/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@kit/ui/dropdown-menu"
import { DeleteSessionModal } from "../mypraxis/delete-session-modal"
import type { Session } from "../../types/session"
import { useSession, useDeleteSession } from "../../app/home/(user)/mypraxis/_lib/hooks/use-sessions"
import { useSessionArtifact } from "../../app/home/(user)/mypraxis/_lib/hooks/use-session-artifacts"
import { updateSessionAction } from "../../app/home/(user)/mypraxis/_lib/server/server-actions"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"

interface SessionViewProps {
  clientId: string
  sessionId: string
  onDelete?: () => void
}

export function SessionView({ clientId, sessionId, onDelete }: SessionViewProps) {
  const [userNote, setUserNote] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  const [isCopied, setIsCopied] = useState(false)
  const [isClientSummaryCopied, setIsClientSummaryCopied] = useState(false)
  const [summaryView, setSummaryView] = useState<"therapist" | "client">("therapist")
  const [therapistSummary, setTherapistSummary] = useState<string | null>(null)
  const [clientSummary, setClientSummary] = useState<string | null>(null)
  const [isLoadingTherapistSummary, setIsLoadingTherapistSummary] = useState(false)
  const [isLoadingClientSummary, setIsLoadingClientSummary] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false) // Added state for title editing
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState<string>("")
  const saveTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const copyTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const clientCopyTimeout = useRef<NodeJS.Timeout | undefined>(undefined)

  // Use the session hook from Supabase to load session data
  const { data: sessionData, isLoading: _isLoadingSession } = useSession(sessionId)
  
  // Fetch therapist summary when therapist tab is active
  const { 
    data: therapistSummaryData, 
    isLoading: isLoadingTherapistSummaryQuery,
    refetch: refetchTherapistSummary
  } = useSessionArtifact(
    sessionId, 
    'session_therapist_summary', 
    !!(sessionData?.transcript || sessionData?.note) && summaryView === 'therapist'
  )
  
  // Fetch client summary when client tab is active
  const { 
    data: clientSummaryData, 
    isLoading: isLoadingClientSummaryQuery,
    refetch: refetchClientSummary
  } = useSessionArtifact(
    sessionId, 
    'session_client_summary', 
    !!(sessionData?.transcript || sessionData?.note) && summaryView === 'client'
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
        transcript: sessionData.transcript ? {
          content: sessionData.transcript
        } : undefined,
        notes: sessionData.note ? {
          userNote: sessionData.note
        } : undefined
      }
      
      setSession(formattedSession)
      setUserNote(sessionData.note || "")
    }
  }, [sessionData])
  
  // Update local summary state when query data changes
  useEffect(() => {
    if (therapistSummaryData) {
      setTherapistSummary(therapistSummaryData.content)
      setIsLoadingTherapistSummary(false)
    }
  }, [therapistSummaryData])
  
  useEffect(() => {
    if (clientSummaryData) {
      setClientSummary(clientSummaryData.content)
      setIsLoadingClientSummary(false)
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
  const [isPending, startTransition] = useTransition()
  
  // Get the query client for invalidating queries
  const queryClient = useQueryClient()

  const handleSaveNote = (note: string) => {
    if (session) {
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
          await updateSessionAction({
            id: sessionId,
            clientId,
            title: session.title,
            transcript: session.transcript?.content || '',
            note: note
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

  const handleSaveTranscript = () => {
    if (session && editedTranscript !== undefined) {
      // Optimistically update the UI
      const previousSession = { ...session };
      
      // Update the session with the new transcript
      const updatedSession = {
        ...session,
        transcript: { content: editedTranscript }
      };
      
      setSession(updatedSession);
      setIsEditingTranscript(false);
      
      // Use startTransition to indicate pending state
      startTransition(async () => {
        try {
          // Call the server action directly
          await updateSessionAction({
            id: sessionId,
            clientId,
            title: session.title,
            transcript: editedTranscript,
            note: session.notes?.userNote || ''
          });
          
          // Reset summaries first to show loading state
          resetAndRefetchSummaries()
          
          // Invalidate session artifacts in the cache
          queryClient.invalidateQueries({ queryKey: ['session', sessionId, 'artifact'] })
          
          // Force refresh all client artifacts
          refreshClientArtifacts()
          
          // Force refetch of summaries
          setTimeout(() => {
            if (summaryView === 'therapist') {
              refetchTherapistSummary()
            } else {
              refetchClientSummary()
            }
          }, 500) // Small delay to ensure the invalidation has completed
          
          toast.success("Transcript saved");
        } catch (error) {
          // Error handling - revert to previous state
          setSession(previousSession);
          setIsEditingTranscript(true);
          toast.error("Failed to save transcript");
          console.error("Error saving transcript:", error);
        }
      });
    }
  }

  const handleCopyText = (text: string | undefined, isClientSummary = false) => {
    if (!text) return;
    
    navigator.clipboard.writeText(text)
    if (isClientSummary) {
      setIsClientSummaryCopied(true)
      if (clientCopyTimeout.current) {
        clearTimeout(clientCopyTimeout.current)
      }
      clientCopyTimeout.current = setTimeout(() => {
        setIsClientSummaryCopied(false)
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
    <div className="w-full h-full flex flex-col overflow-hidden" data-test="session-view">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="space-y-1 mb-5">
          <div className="flex items-center justify-between group/title">
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <Input
                  value={session?.title || ""}
                  onChange={(e) => {
                    const value = e.target.value
                    if (session) {
                      const updatedSession = {
                        ...session,
                        title: value,
                      }
                      setSession(updatedSession)

                      // Update localStorage
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
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      setIsEditingTitle(false)
                    }
                  }}
                  className="h-8 text-[24px] font-semibold text-[#111827] tracking-[-0.011em] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] [&::-webkit-resizer]:appearance-none after:content-[''] after:absolute after:bottom-1 after:right-1 after:w-3 after:h-3 after:border-b-2 after:border-r-2 after:border-[#6B7280] after:cursor-se-resize relative"
                  autoFocus
                  data-test="session-title-input"
                />
              ) : (
                <>
                  <h2
                    className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em] truncate cursor-pointer hover:text-[#374151] transition-colors"
                    onClick={() => setIsEditingTitle(true)}
                    data-test="session-title"
                  >
                    {session?.title || "New Session"}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover/title:opacity-100 transition-opacity"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
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
                  Delete session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <span className="text-[14px] text-[#6B7280]" data-test="session-date">
            {session?.date || ""}
          </span>
        </div>

        <Tabs defaultValue="summary" className="w-full flex-1 flex flex-col">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger
              value="summary"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827] data-[state=active]:bg-transparent px-4 py-2 font-medium text-[14px] text-[#6B7280] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
              data-test="session-tab-summary"
            >
              Summary & Notes
            </TabsTrigger>
            <TabsTrigger
              value="transcript"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827] data-[state=active]:bg-transparent px-4 py-2 font-medium text-[14px] text-[#6B7280] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
              data-test="session-tab-transcript"
            >
              Transcript
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-5 flex-1 overflow-y-auto">
            <div className="space-y-5">
              <div className="relative space-y-3">
                <Label>Your note</Label>
                {isEditing ? (
                  <div className="relative">
                    <Textarea
                      value={userNote}
                      onChange={(e) => setUserNote(e.target.value)}
                      onBlur={() => {
                        setIsEditing(false)
                        handleSaveNote(userNote)
                      }}
                      placeholder="Write anything"
                      className="min-h-[72px] resize-vertical focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] [&::-webkit-resizer]:appearance-none after:content-[''] after:absolute after:bottom-1 after:right-1 after:w-3 after:h-3 after:border-b-2 after:border-r-2 after:border-[#6B7280] after:cursor-se-resize relative"
                      autoFocus
                      data-test="session-note-input"
                    />
                  </div>
                ) : userNote && userNote.trim() ? (
                  <div className="relative group">
                    <div
                      className="rounded-lg bg-[#FFF9E8] p-6 text-[14px] leading-[1.6] min-h-[100px] cursor-pointer"
                      onClick={() => setIsEditing(true)}
                      data-test="session-note-value"
                    >
                      {userNote}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full h-[100px] border border-dashed border-input hover:border-input hover:bg-accent"
                    onClick={() => setIsEditing(true)}
                    data-test="session-add-note-button"
                  >
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Click to add a note
                  </span>
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <Tabs
                  value={summaryView}
                  onValueChange={(v) => setSummaryView(v as "therapist" | "client")}
                  className="w-full"
                >
                  <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                    <TabsTrigger
                      value="therapist"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827] data-[state=active]:bg-transparent px-4 py-2 font-medium text-[14px] text-[#6B7280] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
                    >
                      Therapist Summary
                    </TabsTrigger>
                    <TabsTrigger
                      value="client"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827] data-[state=active]:bg-transparent px-4 py-2 font-medium text-[14px] text-[#6B7280] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
                    >
                      Client Summary
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="therapist" className="mt-3">
                    <div className="relative group">
                      {isLoadingTherapistSummary ? (
                        <div className="rounded-lg bg-[#FFF9E8] px-6 py-6 text-[14px] text-muted-foreground flex items-center justify-center min-h-[100px]">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Generating therapist summary...</span>
                          </div>
                        </div>
                      ) : therapistSummary ? (
                        <div className="relative">
                          <div className="rounded-lg bg-[#FFF9E8] px-6 pb-6 pt-7 text-[14px] leading-[1.6]">
                            <div className="markdown-content">
                              <ReactMarkdown>{therapistSummary || ''}</ReactMarkdown>
                            </div>
                          </div>
                          <div className="absolute right-2 top-[7px] flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-transparent"
                              onClick={() => handleCopyText(therapistSummary || '')}
                              data-test="copy-therapist-summary-button"
                            >
                              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>

                          </div>
                        </div>
                      ) : session?.summary?.therapist ? (
                        <div className="relative">
                          <div className="rounded-lg bg-[#FFF9E8] px-6 pb-6 pt-7 text-[14px] leading-[1.6] whitespace-pre-wrap">
                            {session.summary?.therapist}
                          </div>
                          <div className="absolute right-2 top-[7px] flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-transparent"
                              onClick={() => handleCopyText(session.summary?.therapist)}
                            >
                              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>

                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-[#FFF9E8] px-6 py-6 text-[14px] text-muted-foreground" data-test="therapist-summary-placeholder">
                          Therapist summary will be generated automatically once you add either a transcript or session notes
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="client" className="mt-3">
                    <div className="relative group">
                      {isLoadingClientSummary ? (
                        <div className="rounded-lg bg-[#FFF9E8] px-6 py-6 text-[14px] text-muted-foreground flex items-center justify-center min-h-[100px]">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Generating client summary...</span>
                          </div>
                        </div>
                      ) : clientSummary ? (
                        <div className="relative">
                          <div className="rounded-lg bg-[#FFF9E8] px-6 pb-6 pt-7 text-[14px] leading-[1.6]">
                            <div className="markdown-content">
                              <ReactMarkdown>{clientSummary || ''}</ReactMarkdown>
                            </div>
                          </div>
                          <div className="absolute right-2 top-[7px] flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-transparent"
                              onClick={() => handleCopyText(clientSummaryData.content, true)}
                              data-test="copy-client-summary-button"
                            >
                              {isClientSummaryCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>

                          </div>
                        </div>
                      ) : session?.summary?.client ? (
                        <div className="relative">
                          <div className="rounded-lg bg-[#FFF9E8] px-6 pb-6 pt-7 text-[14px] leading-[1.6] whitespace-pre-wrap">
                            {session.summary?.client}
                          </div>
                          <div className="absolute right-2 top-[7px] flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-transparent"
                              onClick={() => handleCopyText(session.summary?.client, true)}
                            >
                              {isClientSummaryCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>

                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-[#FFF9E8] px-6 py-6 text-[14px] text-muted-foreground" data-test="client-summary-placeholder">
                          Client summary will be generated automatically once you add either a transcript or session notes
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transcript" className="mt-5 flex-1 overflow-y-auto">
            {isEditingTranscript ? (
              <div className="relative">
                <Textarea
                  value={editedTranscript || session?.transcript?.content || ""}
                  onChange={(e) => setEditedTranscript(e.target.value)}
                  onBlur={() => handleSaveTranscript()}
                  className="min-h-[300px] resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                  placeholder="Paste or type transcript here..."
                  autoFocus
                  data-test="session-transcript-input"
                />
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSaveTranscript()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : session?.transcript ? (
              <div className="relative group">
                <div className="rounded-lg bg-[#FFF9E8] px-6 pb-6 pt-7 text-[14px] leading-[1.6] whitespace-pre-wrap" data-test="session-transcript-value">
                  {session.transcript?.content}
                </div>
                <div className="absolute right-2 top-[7px] flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-transparent"
                    onClick={() => {
                      setIsEditingTranscript(true)
                      setEditedTranscript(session.transcript?.content || "")
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="w-full h-[100px] border border-dashed border-input hover:border-input hover:bg-accent"
                onClick={() => {
                  setIsEditingTranscript(true)
                  setEditedTranscript("")
                }}
                data-test="session-add-transcript-button"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Click to add a transcript
                </span>
              </Button>
            )}
          </TabsContent>
        </Tabs>
        <DeleteSessionModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onDelete={handleDeleteSession}
          sessionTitle={session?.title || ""}
          data-test="delete-session-modal"
        />
      </div>
    </div>
  )
}
