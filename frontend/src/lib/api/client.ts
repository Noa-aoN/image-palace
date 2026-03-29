import axios from 'axios'

const TOKEN_KEY = 'auth-storage'

function getTokens() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.tokens ?? null
  } catch {
    return null
  }
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const tokens = getTokens()
  if (tokens) {
    config.headers['access-token'] = tokens.accessToken
    config.headers['uid'] = tokens.uid
    config.headers['client'] = tokens.client
    config.headers['token-type'] = tokens.tokenType
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const accessToken = response.headers['access-token']
    if (accessToken) {
      // ストアを直接 import すると循環依存になるため、カスタムイベントで通知
      const tokens = {
        accessToken,
        uid: response.headers['uid'] ?? '',
        client: response.headers['client'] ?? '',
        tokenType: response.headers['token-type'] ?? 'Bearer',
        expiry: response.headers['expiry'] ?? '',
      }
      window.dispatchEvent(new CustomEvent('auth:tokens-updated', { detail: tokens }))
    }
    return response
  },
  (error) => Promise.reject(error)
)
