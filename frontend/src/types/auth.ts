export interface User {
  id: string
  uid: string
  email: string
  name: string | null
  provider: string
  role?: string | null
  avatar_url?: string | null
  avatar_thumb_url?: string | null
  avatar_generation_status?: string | null
}

export interface AuthTokens {
  accessToken: string
  uid: string
  client: string
  tokenType: string
  expiry: string
}
