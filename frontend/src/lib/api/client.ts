import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'

function resolveApiBaseUrl(): string | undefined {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL
}

export function getBrowserApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const tokens = useAuthStore.getState().tokens
  if (tokens?.accessToken && tokens.uid && tokens.client) {
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
      useAuthStore.getState().updateTokens({
        accessToken,
        uid: response.headers['uid'] ?? '',
        client: response.headers['client'] ?? '',
        tokenType: response.headers['token-type'] ?? 'Bearer',
        expiry: response.headers['expiry'] ?? '',
      })
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      useItemsStore.getState().resetItems()
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
