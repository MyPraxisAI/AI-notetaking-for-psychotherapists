/**
 * Central export file for all types
 */

// Re-export all types from their respective files
export * from './client'
export * from './session'
export * from './navigation'

// Additional common types

/**
 * Generic ID type
 */
export type ID = string

/**
 * Generic status type
 */
export type Status = 'idle' | 'loading' | 'success' | 'error'

/**
 * Generic result type for async operations
 */
export interface Result<T> {
  data: T | null
  error: Error | null
  status: Status
}

/**
 * Generic pagination parameters
 */
export interface PaginationParams {
  page: number
  limit: number
}

/**
 * Generic pagination result
 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/**
 * Generic sort direction
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Generic sort parameters
 */
export interface SortParams<T> {
  field: keyof T
  direction: SortDirection
}

/**
 * Generic filter operator
 */
export type FilterOperator = 
  | 'eq' // equals
  | 'neq' // not equals
  | 'gt' // greater than
  | 'gte' // greater than or equal
  | 'lt' // less than
  | 'lte' // less than or equal
  | 'contains' // string contains
  | 'startsWith' // string starts with
  | 'endsWith' // string ends with

/**
 * Generic filter condition
 */
export interface FilterCondition<T> {
  field: keyof T
  operator: FilterOperator
  value: string | number | boolean | null | undefined
}

/**
 * Generic filter parameters
 */
export interface FilterParams<T> {
  conditions: FilterCondition<T>[]
  logic: 'and' | 'or'
}

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * User preferences
 */
export interface UserPreferences {
  theme: ThemeMode
  fontSize: 'small' | 'medium' | 'large'
  notifications: boolean
  autoSave: boolean
  language: string
}

/**
 * Toast notification type
 */
export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info'

/**
 * Toast notification
 */
export interface Toast {
  id: ID
  type: ToastType
  title: string
  description?: string
  duration?: number
}

/**
 * Modal size
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
