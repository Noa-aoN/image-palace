'use client'

import { create } from 'zustand'
import { getAdminSession } from '@/lib/api/admin'
import type { AdminSession } from '@/types/admin'

interface AdminState {
  session: AdminSession | null
  fetchSession: () => Promise<void>
}

/**
 * 運営権限の有無。サイドバーに「運営」を出すかどうかの判断にだけ使う。
 *
 * これは見た目の出し分けであって、守りではない。
 * 実際の判定はサーバー側で毎リクエスト行われるので、ここを書き換えても何も開かない。
 */
export const useAdminStore = create<AdminState>((set) => ({
  session: null,

  fetchSession: async () => {
    try {
      set({ session: await getAdminSession() })
    } catch {
      // 取得失敗は無視（運営ではないものとして描く）
    }
  },
}))
