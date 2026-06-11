'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** unset: 未選択（バナー表示） / accepted: 解析Cookie許可 / rejected: 拒否 */
export type ConsentValue = 'unset' | 'accepted' | 'rejected'

interface ConsentState {
  consent: ConsentValue
  /** localStorage からの復元完了フラグ。SSR とのちらつき防止に使う */
  hasHydrated: boolean
  accept: () => void
  reject: () => void
  /** 選択をリセットして再度バナーを表示する（同意の撤回） */
  reset: () => void
  setHasHydrated: (value: boolean) => void
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      consent: 'unset',
      hasHydrated: false,
      accept: () => set({ consent: 'accepted' }),
      reject: () => set({ consent: 'rejected' }),
      reset: () => set({ consent: 'unset' }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'ip-cookie-consent',
      // consent のみ永続化（hasHydrated は揮発させる）
      partialize: (state) => ({ consent: state.consent }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
