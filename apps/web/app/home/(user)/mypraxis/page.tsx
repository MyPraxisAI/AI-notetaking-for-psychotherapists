"use client"

import { useState, useEffect, useRef, useTransition as _useTransition, useCallback } from "react"
import { Avatar, AvatarFallback } from "@kit/ui/avatar"
import { Badge } from "@kit/ui/badge"
import { Button } from "@kit/ui/button"
import { useSignOut } from '@kit/supabase/hooks/use-sign-out'
import { useUserData } from './_lib/hooks/use-user-data'
import { useCreateSession, useSessions } from "./_lib/hooks/use-sessions"
import { usePrefetchSessionArtifacts } from './_lib/hooks/use-session-artifacts'
import { usePrefetchClientArtifacts } from "./_lib/hooks/use-client-artifacts"
import { SessionWithId } from "./_lib/schemas/session"
import {
  Users2,

  Settings,
  Wallet,
  HelpCircle,
  Gift,
  LogOut,
  Plus,
  ClipboardEdit,
  Menu,
  Edit2,
  Mic,
  User,
  ClipboardList,
  Brain,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { PrepNote as _PrepNote } from "../../../../components/mypraxis/prep-note"
import { ProfileForm } from "../../../../components/mypraxis/profile-form"
import { SettingsForm } from "../../../../components/mypraxis/settings-form"
import { SessionView } from "../../../../components/mypraxis/session-view"
import { RecordingModal } from "../../../../components/mypraxis/recording-modal"
import { ClientPrepNote } from '../../../../components/mypraxis/client-prep-note';
import { ClientConceptualization } from '../../../../components/mypraxis/client-conceptualization';
import { ClientBio } from '../../../../components/mypraxis/client-bio';
import { useClients, useCreateClient, useDeleteClient } from "./_lib/hooks/use-clients"
import { OnboardingModal } from "../../../../components/mypraxis/onboarding-modal"
import { useUserSettings } from "./_lib/hooks/use-user-settings"
import { ClientCreationModal } from "../../../../components/mypraxis/client-creation-modal"

// Menu item type


type MenuItem = "clients" | "settings" | "billing" | "help" | "gift" | "logout"

// Client types
type DemoClientId = "mike" | "yossi" | "jacob"
type ClientId = string

// Client type guards
const isDemoClient = (id: string): id is DemoClientId => {
  return ["mike", "yossi", "jacob"].includes(id as DemoClientId)
}

// Function to ensure type safety when setting client ID
const setClientId = (id: string): ClientId => {
  return id
}

type DetailItem = "profile" | "prep-note" | "overview" | "client-bio" | "2024-03-28" | "2024-02-15" | "2024-01-25" | string

interface Session {
  id: string
  date: string
  title: string
  createdAt: string
}

const sessionTranscripts: {
  mike: {
    [key: string]: { title: string }
  }
} = {
  mike: {
    "2024-03-28": { title: "Setting Boundaries" },
    "2024-02-15": { title: "Grandmother's Memory" },
    "2024-01-25": { title: "Over-Responsibility" },
  },
}

export default function Page() {
  const [selectedItem, setSelectedItem] = useState<MenuItem>("clients")
  const [selectedClient, setSelectedClient] = useState<ClientId>("")
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem>("prep-note")
  
  // Initialize hooks for prefetching artifacts
  const prefetchClientArtifacts = usePrefetchClientArtifacts()
  const { data: clients = [], isLoading: _isLoadingClients } = useClients()
  const [sessions, setSessions] = useState<Session[]>([])
  const [localClientNames, setLocalClientNames] = useState<Record<string, string>>({})
  
  // Get user data from Supabase with improved loading state handling
  const { user, refreshUserData: _refreshUserData, isDataReady } = useUserData()
  
  // Track avatar image loading state
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false)
  const avatarUrl = user?.user_metadata?.avatar_url
  
  // Preload the avatar image
  useEffect(() => {
    if (avatarUrl) {
      const img = new Image()
      img.onload = () => setIsAvatarLoaded(true)
      img.onerror = () => setIsAvatarLoaded(false)
      img.src = avatarUrl
    } else {
      setIsAvatarLoaded(false)
    }
  }, [avatarUrl])
  
  // Fetch sessions for the selected client from Supabase
  const { data: sessionsData, isLoading: _isLoadingSessions, refetch: refetchSessions } = useSessions(selectedClient)
  
  // Update sessions state when Supabase data changes
  useEffect(() => {
    if (sessionsData) {
      // Map Supabase SessionWithId to local Session type
      const mappedSessions = sessionsData.map(session => ({
        id: session.id,
        date: new Date(session.createdAt).toISOString().split('T')[0]!,
        title: session.title,
        createdAt: session.createdAt,
        transcript: session.transcript ? {
          content: session.transcript
        } : undefined,
        notes: session.note ? {
          userNote: session.note
        } : undefined
      }))
      setSessions(mappedSessions)
    }
  }, [sessionsData])
  const [_selectedSession, setSelectedSessionState] = useState<string | null>(null)
  const [_isDeleteModalOpen, _setIsDeleteModalOpen] = useState(false)
  const [isNavVisible, setIsNavVisible] = useState(true)
  const [isClientListVisible, setIsClientListVisible] = useState(true)
  const [isDetailsColumnVisible, setIsDetailsColumnVisible] = useState(true)
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [isMobileView, setIsMobileView] = useState(false)
  const isNavVisibleRef = useRef(true)
  const isInitialNavVisibilitySet = useRef(false)

  // Track newly created clients
  const [_newClientIds, setNewClientIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Load selected menu item from localStorage
    const savedMenuItem = localStorage.getItem("selectedMenuItem")
    if (savedMenuItem && isMenuItem(savedMenuItem)) {
      setSelectedItem(savedMenuItem as MenuItem)
    }

    // Load selected detail item from localStorage
    const savedDetailItem = localStorage.getItem("selectedDetailItem")
    if (savedDetailItem && isDetailItem(savedDetailItem)) {
      setSelectedDetailItem(savedDetailItem as DetailItem)
    }

    // Handle client selection with validation against available clients
    if (clients.length > 0) {
      const savedClient = localStorage.getItem("selectedClient")
      
      // Check if the saved client exists in the available clients
      const savedClientExists = savedClient && clients.some(client => client.id === savedClient)
      
      if (savedClientExists) {
        // If saved client exists, select it
        setSelectedClient(setClientId(savedClient!))
      } else {
        // If no valid saved client or no selection, select the first available client
        const initialClient = clients[0]
        if (initialClient) {
          setSelectedClient(setClientId(initialClient.id))
          localStorage.setItem("selectedClient", initialClient.id)
          console.log(`Auto-selected first available client: ${initialClient.id}`)
        }
      }
    }
    
    // Load selected session from localStorage
    const savedSession = localStorage.getItem("selectedSession")
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession)
        if (parsedSession && parsedSession.clientId && parsedSession.sessionId) {
          // Check if the client exists in our list
          const clientExists = clients.some(client => client.id === parsedSession.clientId)
          if (clientExists) {
            // Navigate to the session (this will also handle setting the detail item)
            navigateToSession(parsedSession.sessionId)
            console.log(`Restored session from localStorage: ${parsedSession.sessionId}`)
          }
        }
      } catch (error) {
        console.error("Error parsing saved session:", error)
        localStorage.removeItem("selectedSession") // Clear invalid data
      }
    }
  }, [clients]) // eslint-disable-line react-hooks/exhaustive-deps
  // We're intentionally omitting navigateToSession and isDetailItem from the deps array
  // because they're defined later in the file and would cause circular dependencies

  useEffect(() => {
    const handleSessionTitleChange = (event: CustomEvent) => {
      const { clientId: _clientId, sessionId, title } = event.detail
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)))

      // Update demo sessions if needed
      if (sessionTranscripts.mike[sessionId]) {
        sessionTranscripts.mike[sessionId].title = title
      }
    }

    window.addEventListener("sessionTitleChanged", handleSessionTitleChange as EventListener)
    return () => {
      window.removeEventListener("sessionTitleChanged", handleSessionTitleChange as EventListener)
    }
  }, [])

  // Type guards
  const isMenuItem = (item: string): item is MenuItem => {
    return ["clients", "settings", "billing", "help", "gift", "logout"].includes(item)
  }

  const isDetailItem = (item: string): item is DetailItem => {
    return (
      ["profile", "prep-note", "overview", "client-bio"].includes(item) ||
      /^\d{4}-\d{2}-\d{2}$/.test(item) || // Match date format YYYY-MM-DD
      sessions.some((session) => session.id === item) // Match session IDs
    )
  }

  // Initialize the sign out mutation from Makerkit
  const signOut = useSignOut();

  const handleMenuClick = (item: MenuItem) => {
    // Always close navigation on small screens, regardless of whether the item is already selected
    if (window.innerWidth <= 1430) {
      setIsNavVisible(false);
    }
    
    // Skip the rest of the processing if the item is already selected
    if (item === selectedItem) {
      return;
    }
    
    // Handle special menu items
    if (item === "help") {
      window.location.href = "mailto:hello@mypraxis.ai";
      return;
    }

    // Handle logout
    if (item === "logout") {
      void signOut.mutateAsync(); // Correctly call mutateAsync
      return;
    }
    
    setSelectedItem(item);
    localStorage.setItem("selectedMenuItem", item);
    
    // Only hide client list on small screens when switching to a different item
    if (window.innerWidth <= 1430) {
      setIsClientListVisible(false);
    }
  }

  const handleClientClick = (clientId: string) => {
    setSelectedClient(setClientId(clientId))
    localStorage.setItem("selectedClient", clientId)
    
    // Prefetch client artifacts to avoid loading flash
    prefetchClientArtifacts(clientId);
    
    // Close client list on small screens when a client is clicked
    if (window.innerWidth <= 1050) {
      setIsClientListVisible(false)
    }
  }

  const handleDetailItemClick = (item: DetailItem) => {
    setSelectedDetailItem(item)
    localStorage.setItem("selectedDetailItem", item)

    // If the item is a session ID, update selected session
    if (sessions.find((s) => s.id === item)) {
      setSelectedSessionState(item)
    }
  }

  const createClient = useCreateClient()

  const handleNewClient = () => {
    // Open the client creation modal instead of immediately creating a client
    setIsClientCreationModalOpen(true);
  }
  
  // Handle client creation from modal
  const handleCreateClient = (clientName: string) => {
    createClient.mutate({
      fullName: clientName,
      email: "",
      phone: ""
    }, {
      onSuccess: (newClient) => {
        // Track this as a new client
        setNewClientIds((prev) => new Set(prev).add(newClient.id))

        // Select the new client and switch to profile view
        setSelectedClient(setClientId(newClient.id))
        setSelectedDetailItem("profile")
        localStorage.setItem("selectedClient", newClient.id)
        localStorage.setItem("selectedDetailItem", "profile")

        // Close client list on small screens when new client button is clicked
        if (window.innerWidth <= 1050) {
          setIsClientListVisible(false)
        }
      }
    })
  }

  const createSession = useCreateSession()

  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false)
  const [_newSessionId, _setNewSessionId] = useState<string | null>(null)
  
  // Client creation modal state
  const [isClientCreationModalOpen, setIsClientCreationModalOpen] = useState(false)

  // Get the prefetch function from our custom hook
  const prefetchSessionArtifacts = usePrefetchSessionArtifacts();

  /**
   * Navigate to a specific session and optionally open a specific tab
   */
  const navigateToSession = async (sessionId: string, openTab?: 'transcript' | 'notes') => {
    console.log(`Navigating to session ${sessionId}${openTab ? ` (${openTab} tab)` : ''}`)
    
    // Prefetch session artifacts to avoid loading flash
    prefetchSessionArtifacts(sessionId);
    
    // First, ensure we have the session in our sessions list
    const sessionExists = sessions.some(s => s.id === sessionId);
    if (!sessionExists) {
      console.log('Session not found in sessions list, fetching it');
      // Trigger a refetch of sessions to ensure the new session is loaded
      await refetchSessions();
      
      // Wait a moment for the refetch to complete before continuing
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Update selected session state - this is what triggers the view change
    setSelectedSessionState(sessionId);
    setSelectedDetailItem(sessionId);
    localStorage.setItem("selectedDetailItem", sessionId);

    // Save selected session to localStorage for UI state
    const sessionData = {
      clientId: selectedClient,
      sessionId: sessionId
    };
    localStorage.setItem("selectedSession", JSON.stringify(sessionData));
    
    // If a specific tab was requested, dispatch a custom event
    if (openTab) {
      // Create a custom event to signal which tab should be active
      // This is a more appropriate way to handle internal app navigation
      // than using data-test attributes which are meant for testing
      setTimeout(() => {
        const tabChangeEvent = new CustomEvent('sessionTabChange', {
          detail: { tab: openTab, sessionId }
        });
        window.dispatchEvent(tabChangeEvent);
      }, 500);
    }
  }
  
  // Core function to create a new session without opening the recording modal
  const handleNewSession = () => {
    if (!selectedClient) return

    createSession.mutate({
      clientId: selectedClient,
      title: "New session",
      transcript: "",
      note: ""
    }, {
      onSuccess: (newSession: SessionWithId) => {
        // Navigate to the new session
        navigateToSession(newSession.id);
      }
    })
  }
  
  // Temporary function for the recording workflow - will be refactored in future
  const handleRecordingSession = () => {
    if (!selectedClient) return
    setIsRecordingModalOpen(true)
  }
  
  // Handle recording modal close
  const handleRecordingModalClose = () => {
    setIsRecordingModalOpen(false)
  }
  
  // Handle recording save
  const handleRecordingSave = async (sessionId?: string) => {
    setIsRecordingModalOpen(false)
    
    // There should always be a session ID
    if (!sessionId) {
      console.warn('No sessionId provided, this should not happen');
      return;
    }
    
    // Navigate to the session and open the transcript tab
    await navigateToSession(sessionId, 'transcript');
  }

  const handleNameChange = (name: string) => {
    setLocalClientNames((prev) => ({ ...prev, [selectedClient]: name }));
  }

  const deleteClient = useDeleteClient()

  const handleClientDeleted = (deletedClientId: string) => {
    deleteClient.mutate(deletedClientId, {
      onSuccess: () => {
        // If the deleted client was selected, select the first remaining client
        if (selectedClient === deletedClientId) {
          const remainingClients = clients.filter((c) => c.id !== deletedClientId)
          if (remainingClients.length > 0) {
            const nextClient = remainingClients[0]
            if (nextClient) {
              setSelectedClient(setClientId(nextClient.id))
              localStorage.setItem("selectedClient", nextClient.id)
              setSelectedDetailItem("prep-note")
              localStorage.setItem("selectedDetailItem", "prep-note")
            }
          }
        }

        // Clear any selected session for this client
        const selectedSession = localStorage.getItem("selectedSession")
        if (selectedSession) {
          const parsed = JSON.parse(selectedSession)
          if (parsed.clientId === deletedClientId) {
            localStorage.removeItem("selectedSession")
          }
        }

        // Clear any sessions for this client
        const sessionsData = localStorage.getItem("sessions")
        if (sessionsData) {
          const sessions = JSON.parse(sessionsData)
          const updatedSessions = sessions.filter((session: { clientId: string }) => session.clientId !== deletedClientId)
          localStorage.setItem("sessions", JSON.stringify(updatedSessions))
        }
      }
    })
  }

  const getButtonClass = (item: MenuItem) => {
    const baseClass =
      "w-full justify-start gap-3 py-2 px-3 h-auto text-[14px] tracking-[-0.011em] leading-[1.5] rounded-md"
    const selectedClass = "bg-[#1F2937] text-[#D1D5DB] font-semibold"
    const unselectedClass = "text-[#D1D5DB] font-medium"
    const hoverClass = item === "billing" || item === "gift" ? "" : "hover:bg-[#1F2937] hover:text-white"

    return `${baseClass} ${selectedItem === item ? selectedClass : unselectedClass} ${hoverClass}`
  }

  const getClientButtonClass = (clientId: string) => {
    const baseClass = "w-full justify-start gap-2 text-[14px] font-medium h-auto py-2 px-3 rounded-md"
    const selectedClass = "bg-[#F3F4F6] text-[#111827] hover:bg-[#F3F4F6]"
    const unselectedClass = "text-[#6B7280] hover:bg-[#F3F4F6]"
    return `${baseClass} ${clientId === selectedClient ? selectedClass : unselectedClass}`
  }

  const getTabButtonClass = (tab: DetailItem) => {
    const baseClass = "w-full justify-start px-3 py-2 h-auto text-[14px] rounded hover:bg-[#F3F4F6]"
    const selectedClass = "font-semibold text-[#111827] bg-[#F3F4F6]"
    const unselectedClass = "font-medium text-[#374151]"

    return `${baseClass} ${selectedDetailItem === tab ? selectedClass : unselectedClass}`
  }

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}`
  }

  const handleDeleteSession = (sessionId: string) => {
    // Find the current session index
    const currentIndex = sessions.findIndex((s) => s.id === sessionId)

    // Find the next session to select
    let nextSessionId: string | null = null
    const previousSession = sessions[currentIndex - 1]
    const nextAvailableSession = sessions[currentIndex + 1] // Use currentIndex + 1 for next

    if (currentIndex > 0 && previousSession) {
      // Select previous session if available
      nextSessionId = previousSession.id
    } else if (nextAvailableSession) {
      // Select next session if available (Corrected logic)
      nextSessionId = nextAvailableSession.id
    } else if (sessions.length === 1) {
      // If it was the only session, select null or a default
      nextSessionId = null // Or perhaps a default state like 'prep-note'
    }

    // Update sessions list
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))

    // Navigate to next session or prep-note
    if (nextSessionId) {
      setSelectedDetailItem(nextSessionId)
      setSelectedSessionState(nextSessionId)
    } else {
      setSelectedDetailItem("prep-note")
      setSelectedSessionState(null)
    }
  }

  const formatTherapistName = (fullName: string) => {
    if (!fullName) return "Therapist";
    
    const nameParts = fullName.trim().split(" ");
    if (nameParts.length === 1 || !nameParts[1]) return nameParts[0];
    
    return `${nameParts[0]} ${nameParts[1][0]}`;
  };

  const getTherapistInitials = (fullName: string) => {
    if (!fullName || !fullName.trim()) return "T";
    
    return fullName.trim().split(' ')
      .filter(part => part.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const renderContent = () => {
    // If there are no clients, return empty content
    if (clients.length === 0 && selectedItem === "clients") {
      return <div className="border-r border-[#E5E7EB] bg-white h-full" />
    }

    // If settings is selected, show settings form
    if (selectedItem === "settings") {
      return <SettingsForm setIsNavVisible={setIsNavVisible} isSmallScreen={isSmallScreen} />
    }

    // Profile tab
    if (selectedDetailItem === "profile") {
      return (
        <ProfileForm 
          clientId={selectedClient} 
          onNameChange={handleNameChange} 
          onClientDeleted={handleClientDeleted} 
          onNewSession={handleNewSession}
          onRecordingStart={handleRecordingSession}
        />
      )
    }

    // Check if the selected detail item is a session ID
    const selectedSession = sessions.find((s) => s.id === selectedDetailItem)
    if (selectedSession) {
      return (
        <SessionView
          clientId={selectedClient}
          sessionId={selectedDetailItem}
          onDelete={() => handleDeleteSession(selectedDetailItem)}
        />
      )
    }

    // Check if the selected detail item is a demo date
    if (selectedDetailItem.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return <SessionView clientId={selectedClient} sessionId={selectedDetailItem} />
    }


    // Using static imports with stable keys to prevent remounting
    // Each component gets a stable key based on the client ID, not the selected tab
    return (
      <div className="w-full h-full">
        {selectedDetailItem === 'overview' && (
          <ClientConceptualization 
            key={`conceptualization-${selectedClient}`} 
            clientId={selectedClient} 
          />
        )}
        
        {selectedDetailItem === 'client-bio' && (
          <ClientBio 
            key={`bio-${selectedClient}`}
            clientId={selectedClient}
            clientName={localClientNames[selectedClient] || clients.find(c => c.id === selectedClient)?.fullName || ""} 
          />
        )}
        
        {(selectedDetailItem === 'prep-note' || 
          (selectedDetailItem !== 'overview' && 
           selectedDetailItem !== 'client-bio' && 
           !sessions.find(s => s.id === selectedDetailItem))) && (
          <ClientPrepNote 
            key={`prep-note-${selectedClient}`}
            clientId={selectedClient} 
          />
        )}
      </div>
    )
  }

  // Update isNavVisibleRef when isNavVisible changes
  useEffect(() => {
    isNavVisibleRef.current = isNavVisible;
  }, [isNavVisible]);

  // Show client list when switching to clients view on larger screens
  useEffect(() => {
    if (selectedItem === "clients" && window.innerWidth > 1050) {
      setIsClientListVisible(true);
    }
  }, [selectedItem]);

  // Add window resize handler
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      // Set small screen flag (for layout adjustments)
      setIsSmallScreen(width < 1430);
      
      // Set mobile view flag (for recording button)
      setIsMobileView(width <= 768);
      
      // Set navigation visibility based on screen width
      // Only visible by default on large screens (> 1430px)
      const shouldShowNav = width > 1430;
      setIsNavVisible(shouldShowNav);
      isNavVisibleRef.current = shouldShowNav;
      
      // Set client list visibility based on screen width
      // Visible on medium and large screens (> 1050px)
      setIsClientListVisible(width > 1050);
      
      // Set details column visibility based on screen width
      // Visible on screens wider than 970px
      setIsDetailsColumnVisible(width > 970);
      
      isInitialNavVisibilitySet.current = true;
    }

    // Initial check
    handleResize()

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Get user settings to check if onboarding has been completed
  const { settings, isLoading: isLoadingSettings } = useUserSettings()
  
  // Determine if mandatory onboarding should be shown
  const showMandatoryOnboarding = !isLoadingSettings && settings ? !settings.onboarding_completed : false

  // Handler for closing the onboarding modal - memoized to prevent unnecessary re-renders
  const handleCloseOnboardingModal = useCallback(() => {
    // This handler is kept for the mandatory onboarding modal
    // No state to update since we're using settings directly
  }, [])

  return (
    <div className="flex h-screen w-full relative">
      {/* Navigation Overlay */}
      <div 
        className={`nav-overlay ${isNavVisible ? 'active' : ''}`}
        onClick={() => {
          setIsNavVisible(false);
          // Only hide client list on smaller screens
          if (window.innerWidth <= 1050) {
            setIsClientListVisible(false);
          }
        }}
      ></div>

      {/* Navigation Column */}
      <nav className={`nav-column bg-[#111827] text-white w-[182px] min-w-[182px] max-w-[182px] flex flex-col px-3 ${
        isNavVisible ? 'visible' : ''
      } h-screen overflow-hidden`}>
        {/* Avatar Section */}
        <div 
          className="flex items-center gap-3 p-4 mb-4 cursor-pointer hover:brightness-110 transition-all"
          onClick={() => handleMenuClick("settings")}
          role="button"
          aria-label="Go to settings"
          data-test="profile-settings-link"
        >
          {/* Show loading skeleton until data is ready and avatar is loaded (if applicable) */}
          {!isDataReady || (avatarUrl && !isAvatarLoaded) ? (
            <div className="flex items-center gap-3 h-[32px] animate-pulse">
              <div className="w-[32px] h-[32px] rounded-full bg-gray-700"></div>
              <div className="h-4 w-20 bg-gray-700 rounded"></div>
            </div>
          ) : user ? (
            <>
              {/* Avatar - only show when fully loaded */}
              {avatarUrl && isAvatarLoaded ? (
                <div className="relative h-[32px] w-[32px] rounded-full overflow-hidden" data-test="sidebar-avatar-container">
                  <img 
                    src={avatarUrl}
                    alt={user.user_metadata?.full_name || ""}
                    className="object-cover w-full h-full"
                    data-test="sidebar-avatar-image"
                  />
                </div>
              ) : (
                <Avatar className="h-[32px] w-[32px] bg-[#22C55E] text-white">
                  <AvatarFallback className="bg-[#22C55E] text-white font-medium">
                    {getTherapistInitials(user.user_metadata?.full_name || "")}
                  </AvatarFallback>
                </Avatar>
              )}
              <span 
                className="text-[14px] font-medium text-[#E5E7EB] tracking-[-0.011em]"
                data-test="sidebar-therapist-name"
              >
                {formatTherapistName(user.user_metadata?.full_name || "")}
              </span>
            </>
          ) : (
            <div className="flex items-center gap-3 h-[32px] animate-pulse">
              <div className="w-[32px] h-[32px] rounded-full bg-gray-700"></div>
              <div className="h-4 w-20 bg-gray-700 rounded"></div>
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <div className="flex-1 flex flex-col">
          <div className="px-2 mb-[1px]">
            <Button variant="ghost" className={getButtonClass("clients")} onClick={() => handleMenuClick("clients")} data-test="clients-nav-button">
              <Users2 className="h-3.5 w-3.5" />
              Clients
            </Button>
          </div>

          {/* Trial Period Indicator - Commented out for now, can be re-added in the future
          <div className="px-2 relative flex flex-col items-start justify-center min-h-[120px] my-auto">
            <div className="absolute left-5 right-5 top-4 h-[1px] bg-[#1F2937]" />
            <div className="mb-2 px-3 text-[12px] italic font-medium text-[#D1D5DB] tracking-[-0.011em]">
              Free trial ends in <span className="font-bold">3 days</span>
            </div>
            <div className="relative w-[126px] h-8 flex items-center pl-3">
              <div className="relative flex-1 h-full border-2 border-[#D1D5DB] rounded-md overflow-hidden group p-[1px] cursor-pointer">
                <div className="absolute inset-[1px] bg-[#FFBA00] w-[40%] group-hover:w-[calc(100%-2px)] group-hover:bg-[#22C55E] transition-all duration-700 ease-out rounded-[4px]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-1.5 text-white text-sm font-medium z-10">
                    <span className="hidden group-hover:inline">
                      <Zap className="h-3.5 w-3.5" />
                    </span>
                    <span className="group-hover:hidden">3 days left</span>
                    <span className="hidden group-hover:inline">Upgrade</span>
                  </span>
                </div>
              </div>
              <div className="h-2 w-1 bg-[#D1D5EB] rounded-r-sm ml-[1px]" />
            </div>
          </div>
          */}

          {/* Bottom Navigation */}
          <div className="mt-auto space-y-[1px] pb-4">
            {/* Inactive Menu Items */}
            <div className="px-2">
              <Button 
                variant="ghost" 
                className={`${getButtonClass("billing")} opacity-50 cursor-default`} 
                onClick={() => {}}
                disabled={true}
              >
                <Wallet className="h-[18px] w-[18px]" />
                Billing
              </Button>
            </div>
            <div className="px-2">
              <Button 
                variant="ghost" 
                className={`${getButtonClass("gift")} opacity-50 cursor-default`} 
                onClick={() => {}}
                disabled={true}
              >
                <Gift className="h-[18px] w-[18px]" />
                Gift Praxis
              </Button>
            </div>
            
            {/* Active Menu Items */}
            <div className="mt-4 px-2">
              <Button
                variant="ghost"
                data-test="settings-nav-button"
                className={getButtonClass("settings")}
                onClick={() => handleMenuClick("settings")}
              >
                <Settings className="h-[18px] w-[18px]" />
                Settings
              </Button>
            </div>
            <div className="px-2">
              <Button variant="ghost" className={getButtonClass("help")} onClick={() => handleMenuClick("help")}>
                <HelpCircle className="h-[18px] w-[18px]" />
                Get help
              </Button>
            </div>
            <div className="px-2">
              <Button
                variant="ghost"
                data-test="logout-button"
                className={getButtonClass("logout")}
                onClick={() => {
                  handleMenuClick("logout"); // Call the main handler
                  // Add direct call as fallback with delay
                  setTimeout(() => {
                    void signOut.mutateAsync(); // Correctly call mutateAsync
                  }, 100);
                }}
              >
                <LogOut className="h-5 w-5" />
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Logo at the bottom */}
        <div className="px-2 mt-auto">
          <div 
            className="w-full flex justify-center py-4 relative"
          >
            <img
              src="/logo.svg"
              alt="My Praxis Logo"
              className="h-12 w-auto relative -left-2.5"
            />
          </div>
        </div>
      </nav>

      {/* Client List Overlay */}
      <div 
        className={`client-list-overlay ${isClientListVisible ? 'active' : ''}`}
        onClick={() => setIsClientListVisible(false)}
      ></div>

      {/* Clients Column */}
      <div className={`client-list-column min-w-0 ${
        isClientListVisible && selectedItem !== "settings" ? 'visible w-[20%] min-w-[182px] max-w-[250px]' : 'w-0 overflow-hidden'
      } border-r border-[#E5E7EB] bg-white flex flex-col relative transition-all duration-300 h-screen overflow-y-auto`}>
        {/* Top section with burger menu and new client button */}
        <div className="flex items-center justify-between px-2.5 pt-3 pb-2">
          {isSmallScreen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 border border-gray-200 hover:bg-gray-100"
              onClick={() => setIsNavVisible(!isNavVisible)}
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-4 w-4 text-gray-700" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            className={`${isSmallScreen ? 'ml-2 flex-grow' : 'w-[80%] mx-auto'} justify-center gap-2 text-[14px] font-medium text-white bg-[#FFBA00] border border-[#E5E7EB] hover:bg-[#FFBA00]/90 transition-colors duration-150 h-8 px-3 rounded-md min-w-fit`}
            onClick={handleNewClient}
            data-test="new-client-button"
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">New client</span>
          </Button>
        </div>

        <div className="mt-3 px-2.5 space-y-0.5">
          {clients.map((client) => (
            <div key={client.id} className="relative group hover:bg-[#F3F4F6] rounded">
              <Button
                key={client.id}
                variant="ghost"
                className={getClientButtonClass(client.id)}
                onClick={() => handleClientClick(client.id)}
                data-test={`client-row-${client.id}`}
              >
                <span data-test="client-name-cell">{localClientNames[client.id] || client.fullName}</span>
                {client.id === "mike" && (
                  <Badge
                    variant="secondary"
                    className="ml-0.5 mr-6 text-xs font-medium bg-white text-[#6B7280] px-2.5 py-0.5 rounded-full border border-[#E5E7EB]"
                  >
                    Demo
                  </Badge>
                )}
              </Button>
              <div
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClientClick(client.id)
                  handleDetailItemClick("profile")
                }}
                title="View Profile"
              >
                <Edit2 className="h-4 w-4 cursor-pointer" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Column */}
      <div className={`column-3 min-w-[320px] flex-1 relative ${
        selectedItem === "settings" ? 'settings-mode' : ''
      }`}>
        {/* Control Line - visible below 1050px when Column 2 collapses */}
        <div className="control-line sticky top-0 h-[30px] w-full items-center justify-between z-10">
          <div className="flex-1 flex items-center justify-between">
            {!isClientListVisible && selectedItem !== "settings" && (
              <Button
                variant="ghost"
                className="h-8 px-3 flex items-center gap-0.5 text-[14px] font-medium ml-[3px]"
                onClick={() => setIsClientListVisible(true)}
              >
                <ChevronLeft className="h-4 w-4" />
                Clients
              </Button>
            )}
            {(isClientListVisible || selectedItem === "settings") && (
              <div className="h-8 px-3 ml-[3px]"></div> /* Spacer when button is not visible */
            )}
            
            {!isDetailsColumnVisible && selectedItem !== "settings" && (
              <Button
                variant="ghost"
                className="h-8 px-3 flex items-center gap-0.5 text-[14px] font-medium mr-[3px]"
                onClick={() => setIsDetailsColumnVisible(true)}
              >
                Sessions
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {(isDetailsColumnVisible || selectedItem === "settings") && (
              <div className="h-8 px-3 mr-[3px]"></div> /* Spacer when button is not visible */
            )}
          </div>
        </div>
        
        <div className="column-3-content p-5">
          {renderContent()}
        </div>
      </div>

      {/* Details Column Overlay */}
      <div 
        className={`details-overlay ${isDetailsColumnVisible && selectedItem !== "settings" ? 'active' : ''}`}
        onClick={() => setIsDetailsColumnVisible(false)}
      ></div>

      {/* Details Column */}
      <div className={`column-4 w-[250px] min-w-[200px] max-w-[250px] border-l border-[#E5E7EB] bg-white flex flex-col ${
        !isDetailsColumnVisible || selectedItem === "settings" ? "hidden" : ""
      } h-screen overflow-y-auto`}>
        <div className="px-5 pt-5 relative">
          {/* Navigation Menu */}
          <div className="space-y-0.5">
            <Button
              variant="ghost"
              className={`${getTabButtonClass("prep-note")} ${clients.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => handleDetailItemClick("prep-note")}
              disabled={clients.length === 0}
            >
              <ClipboardEdit className="h-4 w-4 mr-2" />
              Prep Note
            </Button>
            <Button
              variant="ghost"
              className={`${getTabButtonClass("overview")} ${clients.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => handleDetailItemClick("overview")}
              disabled={clients.length === 0}
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Conceptualization
            </Button>
            <Button
              variant="ghost"
              className={`${getTabButtonClass("client-bio")} ${clients.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => handleDetailItemClick("client-bio")}
              disabled={clients.length === 0}
            >
              <User className="h-4 w-4 mr-2" />
              Client Bio
            </Button>
            <Button
              variant="ghost"
              className="flex items-center w-full justify-start px-3 py-2 text-[14px] font-medium text-muted-foreground opacity-50"
              disabled={true}
            >
              <Brain className="h-4 w-4 mr-2" />
              AI Supervision
            </Button>
          </div>

          {/* Add Session Button */}
          <div className="mt-3 mb-3">
            <Button
              className={`w-full bg-[#22C55E] hover:bg-[#22C55E]/90 text-white text-[14px] font-medium h-auto py-2.5 transition-colors duration-150 border border-[#E5E7EB] ${
                clients.length === 0 ? "opacity-50 cursor-not-allowed" : ""
              } ${isMobileView ? "mobile-disabled-button" : ""}`}
              onClick={handleRecordingSession}
              disabled={clients.length === 0 || isMobileView}
              data-test="start-recording-button"
            >
              <Mic className="h-4 w-4 mr-2" />
              Start recording
            </Button>
            <p className="text-[12px] text-muted-foreground text-center mt-2">
              {isMobileView ? "Available on desktop" : "transcript, notes, recap"}
            </p>
          </div>

          {/* Date List */}
          <div className="space-y-0.5">
            {/* Only show sessions if there are clients */}
            {clients.length > 0 && (
              <>
                {/* Sessions */}
                <div className="mt-4 space-y-0.5">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`w-full px-4 py-2 rounded cursor-pointer transition-colors ${
                        selectedDetailItem === session.id
                          ? "bg-[#F3F4F6] font-semibold text-[#111827]"
                          : "font-medium text-[#374151] hover:bg-[#F3F4F6]"
                      }`}
                      onClick={() => handleDetailItemClick(session.id)}
                      data-test="session-item"
                    >
                      <div className="flex flex-col items-start w-full">
                        <div className="text-[14px] font-medium text-[#111827] w-full break-words" data-test="sessions-list-title">
                          {session.title}
                        </div>
                        <div className="text-[12px] text-[#6B7280]" data-test="sessions-list-date">
                          {session.date}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sample sessions for Mike */}
                {isDemoClient(selectedClient) && selectedClient === "mike" && (
                  <div className="mt-4 space-y-0.5">
                    {Object.entries(sessionTranscripts.mike).map(([date, { title }]) => (
                      <div
                        key={date}
                        className={`w-full px-4 py-2 rounded cursor-pointer transition-colors ${
                          selectedDetailItem === date
                            ? "bg-[#F3F4F6] font-semibold text-[#111827]"
                            : "font-medium text-[#374151] hover:bg-[#F3F4F6]"
                        }`}
                        onClick={() => handleDetailItemClick(date)}
                        data-test="session-item"
                      >
                        <div className="flex flex-col items-start w-full">
                          <div className="text-[14px] font-medium text-[#111827] w-full break-words" data-test="session-list-title">
                            {title}
                          </div>
                          <div className="text-[12px] text-[#6B7280]" data-test="sessions-list-date">
                            {formatDisplayDate(date)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recording Modal */}
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={handleRecordingModalClose}
        onSave={handleRecordingSave}
        clientId={selectedClient}
        clientName={localClientNames[selectedClient] || clients.find(c => c.id === selectedClient)?.fullName || ""}
      />

      {/* Mandatory onboarding modal - shown when onboarding_completed is false */}
      <OnboardingModal
        isOpen={showMandatoryOnboarding}
        onClose={handleCloseOnboardingModal}
        isMandatory={true}
      />

      {/* Client Creation Modal */}
      <ClientCreationModal
        isOpen={isClientCreationModalOpen}
        onClose={() => setIsClientCreationModalOpen(false)}
        onSave={handleCreateClient}
      />
    </div>
  )
}
