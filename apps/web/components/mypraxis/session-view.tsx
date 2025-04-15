"use client"

import { useEffect, useRef, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kit/ui/tabs"
import { sessionTranscripts } from "../../data/mypraxis/session-transcripts"
import { Textarea } from "@kit/ui/textarea"
import { Label } from "@kit/ui/label"
import { Check, Edit2, Plus, Copy, MoreVertical } from "lucide-react"
import { Button } from "@kit/ui/button"
import { Input } from "@kit/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@kit/ui/dropdown-menu"
import { DeleteSessionModal } from "../mypraxis/delete-session-modal"
import type { Session } from "../../types/session"
import { useSession, useUpdateSession, useDeleteSession } from "../../app/home/(user)/mypraxis/_lib/hooks/use-sessions"
import { toast } from "sonner"

interface SessionViewProps {
  clientId: string
  sessionId: string
  onDelete?: () => void
}

export function SessionView({ clientId, sessionId, onDelete }: SessionViewProps) {
  const [userNote, setUserNote] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingClientSummary, setIsEditingClientSummary] = useState(false)
  const [isEditingTherapistSummary, setIsEditingTherapistSummary] = useState(false)
  const [_isSaved, setIsSaved] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isClientSummaryCopied, setIsClientSummaryCopied] = useState(false)
  const [summaryView, setSummaryView] = useState<"therapist" | "client">("therapist")
  const [editedClientSummary, setEditedClientSummary] = useState<string | null>(null)
  const [editedTherapistSummary, setEditedTherapistSummary] = useState<string | null>(null)
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

  // Update local state when session data changes
  useEffect(() => {
    if (sessionData) {
      // Convert SessionWithId to Session format
      const formattedSession: Session = {
        id: sessionData.id,
        date: new Date(sessionData.createdAt).toISOString().split('T')[0]!,
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
      
      // For demo sessions, handle summaries (to be implemented in future)
      if (sessionId.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const demoSession = sessionTranscripts[clientId as "mike"]?.[sessionId as keyof typeof sessionTranscripts["mike"]]
        if (demoSession?.summary?.client) {
          setEditedClientSummary(demoSession.summary.client)
        }
        if (demoSession?.summary?.therapist) {
          setEditedTherapistSummary(demoSession.summary.therapist)
        }
      }
    }
  }, [sessionData, clientId, sessionId])

  // Use the update session hook from Supabase
  const updateSessionMutation = useUpdateSession()

  const handleSaveNote = (note: string) => {
    if (session) {
      // Update the session with the new note
      updateSessionMutation.mutate({
        id: sessionId,
        clientId,
        title: session.title,
        transcript: session.transcript?.content || '',
        note: note, // Save the note properly
        createdAt: session.createdAt
      }, {
        onSuccess: () => {
          setIsSaved(true)
          if (saveTimeout.current) {
            clearTimeout(saveTimeout.current)
          }
          saveTimeout.current = setTimeout(() => {
            setIsSaved(false)
          }, 2000)
        },
        onError: (error) => {
          toast.error("Failed to save note")
          console.error("Error saving note:", error)
        }
      })
    }
  }

  const handleSaveClientSummary = (_summary: string) => {
    if (session) {
      // Client summary will be implemented in a future update
      // For now, just update the UI state
      setIsEditingClientSummary(false)
      toast.info('Client summaries will be saved in a future update')
    }
  }

  const handleSaveTherapistSummary = (_summary: string) => {
    if (session) {
      // Therapist summary will be implemented in a future update
      // For now, just update the UI state
      setIsEditingTherapistSummary(false)
      toast.info('Therapist summaries will be saved in a future update')
    }
  }

  const handleSaveTranscript = () => {
    if (session) {
      // Update the session with the new transcript
      updateSessionMutation.mutate({
        id: sessionId,
        clientId,
        title: session.title,
        transcript: editedTranscript, // Save the transcript as plain text
        note: session.notes?.userNote || '',
        createdAt: session.createdAt
      }, {
        onSuccess: () => {
          setIsEditingTranscript(false)
          toast.success('Transcript saved successfully')
        },
        onError: (error) => {
          toast.error('Failed to save transcript')
          console.error('Error saving transcript:', error)
        }
      })
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
    <div className="w-full px-6 pt-6 border-r border-[#E5E7EB] bg-white">
      <div className="flex flex-col h-[calc(100vh-32px)]">
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
                />
              ) : (
                <>
                  <h2
                    className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em] truncate cursor-pointer hover:text-[#374151] transition-colors"
                    onClick={() => setIsEditingTitle(true)}
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
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  Delete session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-[14px] text-[#6B7280]">{session?.date || ""}</p>
        </div>

        <Tabs defaultValue="summary" className="w-full flex-1 flex flex-col">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger
              value="summary"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827] data-[state=active]:bg-transparent px-4 py-2 font-medium text-[14px] text-[#6B7280] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
            >
              Summary & Notes
            </TabsTrigger>
            <TabsTrigger
              value="transcript"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827] data-[state=active]:bg-transparent px-4 py-2 font-medium text-[14px] text-[#6B7280] data-[state=active]:text-[#111827] data-[state=active]:shadow-none"
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
                    />
                  </div>
                ) : userNote && userNote.trim() ? (
                  <div className="relative group">
                    <div
                      className="rounded-lg bg-[#FFF9E8] p-6 text-[14px] leading-[1.6] min-h-[100px] cursor-pointer"
                      onClick={() => setIsEditing(true)}
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
                  >
                    Click to add a note
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
                      {isEditingTherapistSummary ? (
                        <div className="relative">
                          <Textarea
                            value={editedTherapistSummary || ""}
                            onChange={(e) => setEditedTherapistSummary(e.target.value)}
                            onBlur={() => {
                              if (editedTherapistSummary) {
                                handleSaveTherapistSummary(editedTherapistSummary)
                              }
                            }}
                            className="resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                            style={{
                              height: editedTherapistSummary
                                ? `${
                                    editedTherapistSummary.split("\n").reduce((acc, line) => {
                                      return acc + Math.ceil(line.length / 65) // Approximate characters per line
                                    }, 2) * 24
                                  }px`
                                : "100px",
                            }}
                            autoFocus
                          />
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-transparent"
                              onClick={() => setIsEditingTherapistSummary(true)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-[#FFF9E8] px-6 py-6 text-[14px] text-muted-foreground">
                          Therapist summary will be generated automatically once you add a transcript to this session
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="client" className="mt-3">
                    <div className="relative group">
                      {isEditingClientSummary ? (
                        <div className="relative">
                          <Textarea
                            value={editedClientSummary || ""}
                            onChange={(e) => setEditedClientSummary(e.target.value)}
                            onBlur={() => {
                              if (editedClientSummary) {
                                handleSaveClientSummary(editedClientSummary)
                              }
                            }}
                            className="resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                            style={{
                              height: editedClientSummary
                                ? `${
                                    editedClientSummary.split("\n").reduce((acc, line) => {
                                      return acc + Math.ceil(line.length / 65) // Approximate characters per line
                                    }, 2) * 24
                                  }px`
                                : "100px",
                            }}
                            autoFocus
                          />
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-transparent"
                              onClick={() => setIsEditingClientSummary(true)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-[#FFF9E8] px-6 py-6 text-[14px] text-muted-foreground">
                          Client summary will be generated automatically once you add a transcript to this session
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
                <div className="rounded-lg bg-[#FFF9E8] px-6 pb-6 pt-7 text-[14px] leading-[1.6] whitespace-pre-wrap">
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
        />
      </div>
    </div>
  )
}
