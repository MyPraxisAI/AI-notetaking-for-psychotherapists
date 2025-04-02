export interface Client {
  id: string
  createdAt: string
  fullName: string
  email: string
  phone: string
}

export interface ValidationState {
  email: boolean
  phone: boolean
}

