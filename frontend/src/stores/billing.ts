'use client'

import { create } from 'zustand'
import { getBillingSummary } from '@/lib/api/billing'
import type { BillingSummary } from '@/types/billing'

interface BillingState {
  summary: BillingSummary | null
  fetchSummary: () => Promise<void>
}

// クレジット残高・プランの共有ストア（ヘッダー・ダッシュボード・作成画面で共用）。
// 生成後に fetchSummary を呼んで残高を更新する。取得失敗時は表示しないだけ。
export const useBillingStore = create<BillingState>((set) => ({
  summary: null,
  fetchSummary: async () => {
    try {
      const summary = await getBillingSummary()
      set({ summary })
    } catch {
      // 取得失敗は無視（残高表示を出さない）
    }
  },
}))
