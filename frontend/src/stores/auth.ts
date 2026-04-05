'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, AuthTokens } from '@/types/auth'

interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  hasHydrated: boolean
  setAuth: (user: User, tokens: AuthTokens) => void
  updateTokens: (tokens: AuthTokens) => void
  clearAuth: () => void
  setHasHydrated: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      hasHydrated: false,
      setAuth: (user, tokens) => set({ user, tokens, isAuthenticated: true }),
      updateTokens: (tokens) => set((state) => ({ ...state, tokens })),
      clearAuth: () => set({ user: null, tokens: null, isAuthenticated: false }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
