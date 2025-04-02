"use client"

import { useState, useEffect, useCallback } from 'react'
import type { Client } from '../types/client'
import type { Session } from '../types/session'
import { 
  getSessions, 
  getClientSessions, 
  saveSession, 
  getSelectedSession, 
  setSelectedSession as setStoredSelectedSession,
  getSessionById,
  updateSession
} from '../lib/mypraxis/storage'

export function useClientManagement() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSessionState] = useState<string | null>(null)

  // Load clients from localStorage
  useEffect(() => {
    try {
      const clientsData = localStorage.getItem('clients')
      if (clientsData) {
        setClients(JSON.parse(clientsData))
      } else {
        // Initialize with default client if none exists
        const initialClients = [
          {
            id: 'mike',
            createdAt: new Date().toISOString(),
            fullName: 'Mike',
            email: '',
            phone: '',
            address: '',
            emergencyContact: {
              name: '',
              phone: '',
            },
          },
        ]
        localStorage.setItem('clients', JSON.stringify(initialClients))
        setClients(initialClients)
      }

      // Load selected client from localStorage
      const savedClient = localStorage.getItem('selectedClient')
      if (savedClient) {
        setSelectedClient(savedClient)
      } else if (clientsData) {
        const parsedClients = JSON.parse(clientsData)
        if (parsedClients.length > 0) {
          setSelectedClient(parsedClients[0].id)
        }
      } else {
        setSelectedClient('mike')
      }
    } catch (error) {
      console.error('Error loading clients:', error)
      // Fallback to default state
      setClients([])
      setSelectedClient(null)
    }
  }, [])

  // Load sessions when selected client changes
  useEffect(() => {
    if (selectedClient) {
      try {
        const clientSessions = getClientSessions(selectedClient)
        setSessions(clientSessions)

        // Load selected session from localStorage
        const selected = getSelectedSession()
        if (selected && selected.clientId === selectedClient) {
          setSelectedSessionState(selected.sessionId)
        } else {
          setSelectedSessionState(null)
        }
      } catch (error) {
        console.error('Error loading sessions:', error)
        setSessions([])
        setSelectedSessionState(null)
      }
    }
  }, [selectedClient])

  // Save selected client to localStorage
  useEffect(() => {
    if (selectedClient) {
      localStorage.setItem('selectedClient', selectedClient)
    }
  }, [selectedClient])

  // Add a new client
  const addClient = useCallback((client: Client) => {
    try {
      const newClients = [...clients, client]
      localStorage.setItem('clients', JSON.stringify(newClients))
      setClients(newClients)
      return true
    } catch (error) {
      console.error('Error adding client:', error)
      return false
    }
  }, [clients])

  // Update an existing client
  const updateClient = useCallback((clientId: string, updates: Partial<Client>) => {
    try {
      const clientIndex = clients.findIndex(c => c.id === clientId)
      if (clientIndex === -1) {
        console.error('Client not found:', clientId)
        return false
      }

      const updatedClients = [...clients]
      // Ensure all required properties are present
      const currentClient = updatedClients[clientIndex];
      // TypeScript check to ensure currentClient is defined
      if (currentClient) {
        updatedClients[clientIndex] = {
          id: currentClient.id,
          createdAt: currentClient.createdAt,
          fullName: currentClient.fullName,
          email: currentClient.email,
          phone: currentClient.phone,
          address: currentClient.address,
          emergencyContact: currentClient.emergencyContact,
          ...updates
        }
      }

      localStorage.setItem('clients', JSON.stringify(updatedClients))
      setClients(updatedClients)
      return true
    } catch (error) {
      console.error('Error updating client:', error)
      return false
    }
  }, [clients])

  // Delete a client
  const deleteClient = useCallback((clientId: string) => {
    try {
      const updatedClients = clients.filter(c => c.id !== clientId)
      localStorage.setItem('clients', JSON.stringify(updatedClients))
      setClients(updatedClients)

      // Remove client's sessions
      const sessions = getSessions()
      if (sessions[clientId]) {
        delete sessions[clientId]
        localStorage.setItem('sessions', JSON.stringify(sessions))
      }

      // Update selected client if needed
      if (selectedClient === clientId) {
        if (updatedClients.length > 0 && updatedClients[0]) {
          setSelectedClient(updatedClients[0].id)
        } else {
          setSelectedClient(null)
        }
      }

      return true
    } catch (error) {
      console.error('Error deleting client:', error)
      return false
    }
  }, [clients, selectedClient])

  // Add a new session
  const addSession = useCallback((clientId: string, session: Session) => {
    try {
      saveSession(clientId, session)
      if (clientId === selectedClient) {
        setSessions(prev => [session, ...prev])
      }
      return true
    } catch (error) {
      console.error('Error adding session:', error)
      return false
    }
  }, [selectedClient])

  // Update a session
  const updateSessionData = useCallback((clientId: string, sessionId: string, updates: Partial<Session>) => {
    try {
      const currentSession = getSessionById(clientId, sessionId)
      if (!currentSession) {
        console.error('Session not found:', sessionId)
        return false
      }

      const updatedSession = {
        ...currentSession,
        ...updates,
      }

      updateSession(clientId, sessionId, updates)
      
      if (clientId === selectedClient) {
        setSessions(prev => 
          prev.map(s => s.id === sessionId ? { ...s, ...updates } : s)
        )
      }
      
      return true
    } catch (error) {
      console.error('Error updating session:', error)
      return false
    }
  }, [selectedClient])

  // Delete a session
  const deleteSession = useCallback((clientId: string, sessionId: string) => {
    try {
      // Remove from localStorage
      const sessionsData = localStorage.getItem('sessions')
      if (sessionsData) {
        const sessions = JSON.parse(sessionsData)
        if (sessions[clientId]) {
          delete sessions[clientId][sessionId]
          localStorage.setItem('sessions', JSON.stringify(sessions))
        }
      }

      // Clear selected session if it's the current one
      const selectedSession = localStorage.getItem('selectedSession')
      if (selectedSession) {
        const parsed = JSON.parse(selectedSession)
        if (parsed.clientId === clientId && parsed.sessionId === sessionId) {
          localStorage.removeItem('selectedSession')
        }
      }

      // Update sessions list if needed
      if (clientId === selectedClient) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
      }

      return true
    } catch (error) {
      console.error('Error deleting session:', error)
      return false
    }
  }, [selectedClient])

  // Set selected session
  const setSelectedSession = useCallback((clientId: string, sessionId: string) => {
    try {
      setStoredSelectedSession(clientId, sessionId)
      if (clientId === selectedClient) {
        setSelectedSessionState(sessionId)
      }
    } catch (error) {
      console.error('Error setting selected session:', error)
    }
  }, [selectedClient])

  return {
    clients,
    selectedClient,
    setSelectedClient,
    sessions,
    selectedSession,
    setSelectedSession,
    addClient,
    updateClient,
    deleteClient,
    addSession,
    updateSession: updateSessionData,
    deleteSession,
  }
}
