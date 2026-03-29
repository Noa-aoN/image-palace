export interface User {
  id: string
  uid: string
  email: string
  name: string | null
  provider: string
}

export interface AuthTokens {
  accessToken: string
  uid: string
  client: string
  tokenType: string
  expiry: string
}
