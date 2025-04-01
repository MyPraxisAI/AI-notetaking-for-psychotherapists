"use client"

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import { useClientManagement } from '../../hooks/use-client-management'
import type { Client } from '../../types/client'
import type { Session } from '../../types/session'

// Define the types for menu and detail items
export type MenuItem = 'clients' | 'inbox' | 'settings'
export type DetailItem = 'prep-note' | 'overview' | 'client-bio' | string

// Define the context type
type AppContextType = {
  // Client management
  clients: Client[]
  selectedClient: string | null
  setSelectedClient: (clientId: string) => void
  sessions: Session[]
  selectedSession: string | null
  setSelectedSession: (clientId: string, sessionId: string) => void
  addClient: (client: Client) => boolean
  updateClient: (clientId: string, updates: Partial<Client>) => boolean
  deleteClient: (clientId: string) => boolean
  addSession: (clientId: string, session: Session) => boolean
  updateSession: (clientId: string, sessionId: string, updates: Partial<Session>) => boolean
  deleteSession: (clientId: string, sessionId: string) => boolean
  
  // Navigation
  selectedMenuItem: MenuItem
  setSelectedMenuItem: (item: MenuItem) => void
  selectedDetailItem: DetailItem
  setSelectedDetailItem: (item: DetailItem) => void
  isNavVisible: boolean
  setIsNavVisible: (visible: boolean) => void
}

// Create the context with a default value
const AppContext = createContext<AppContextType | undefined>(undefined)

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const clientManagement = useClientManagement()
  
  // Navigation state from localStorage or defaults
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem>(() => {
    try {
      const savedMenuItem = localStorage.getItem('selectedMenuItem')
      return (savedMenuItem as MenuItem) || 'clients'
    } catch {
      return 'clients'
    }
  })
  
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem>(() => {
    try {
      const savedDetailItem = localStorage.getItem('selectedDetailItem')
      return savedDetailItem || 'prep-note'
    } catch {
      return 'prep-note'
    }
  })
  
  const [isNavVisible, setIsNavVisible] = useState(true)
  
  // Save navigation state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('selectedMenuItem', selectedMenuItem)
    } catch (error) {
      console.error('Error saving selected menu item:', error)
    }
  }, [selectedMenuItem])
  
  useEffect(() => {
    try {
      localStorage.setItem('selectedDetailItem', selectedDetailItem)
    } catch (error) {
      console.error('Error saving selected detail item:', error)
    }
  }, [selectedDetailItem])
  
  const value = {
    ...clientManagement,
    selectedMenuItem,
    setSelectedMenuItem,
    selectedDetailItem,
    setSelectedDetailItem,
    isNavVisible,
    setIsNavVisible,
  }
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// Custom hook to use the context
export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
