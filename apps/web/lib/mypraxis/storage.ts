import type { Session, SessionsState } from "../../types/session"

/**
 * Safely parses JSON from localStorage
 * @param key The localStorage key
 * @param defaultValue Default value if key doesn't exist or parsing fails
 * @returns Parsed value or default value
 */
function safeGetItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (error) {
    console.error(`Error retrieving ${key} from localStorage:`, error)
    return defaultValue
  }
}

/**
 * Safely sets JSON in localStorage
 * @param key The localStorage key
 * @param value Value to store
 * @returns True if successful, false otherwise
 */
function safeSetItem(key: string, value: any): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error)
    return false
  }
}

export function getSessions(): SessionsState {
  return safeGetItem<SessionsState>("sessions", {})
}

export function getClientSessions(clientId: string): Session[] {
  try {
    const sessions = getSessions()
    return Object.values(sessions[clientId] || {}).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  } catch (error) {
    console.error(`Error getting sessions for client ${clientId}:`, error)
    return []
  }
}

export function saveSession(clientId: string, session: Session): boolean {
  try {
    const sessions = getSessions()
    if (!sessions[clientId]) {
      sessions[clientId] = {}
    }
    sessions[clientId][session.id] = session
    return safeSetItem("sessions", sessions)
  } catch (error) {
    console.error(`Error saving session for client ${clientId}:`, error)
    return false
  }
}

export function getSelectedSession(): { clientId: string; sessionId: string } | null {
  return safeGetItem<{ clientId: string; sessionId: string } | null>("selectedSession", null)
}

export function setSelectedSession(clientId: string, sessionId: string): boolean {
  return safeSetItem("selectedSession", { clientId, sessionId })
}

export function getSessionById(clientId: string, sessionId: string): Session | null {
  try {
    const sessions = getSessions()
    return sessions[clientId]?.[sessionId] || null
  } catch (error) {
    console.error(`Error getting session ${sessionId} for client ${clientId}:`, error)
    return null
  }
}

export function updateSession(clientId: string, sessionId: string, updates: Partial<Session>): boolean {
  try {
    const sessions = getSessions()
    if (sessions[clientId]?.[sessionId]) {
      sessions[clientId][sessionId] = {
        ...sessions[clientId][sessionId],
        ...updates,
      }
      return safeSetItem("sessions", sessions)
    }
    return false
  } catch (error) {
    console.error(`Error updating session ${sessionId} for client ${clientId}:`, error)
    return false
  }
}

export function deleteSession(clientId: string, sessionId: string): boolean {
  try {
    const sessions = getSessions()
    if (sessions[clientId]?.[sessionId]) {
      delete sessions[clientId][sessionId]
      return safeSetItem("sessions", sessions)
    }
    return false
  } catch (error) {
    console.error(`Error deleting session ${sessionId} for client ${clientId}:`, error)
    return false
  }
}
