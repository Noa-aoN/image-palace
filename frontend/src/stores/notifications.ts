'use client'

import { create } from 'zustand'
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/api/notifications'

interface NotificationsState {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  fetchUnreadCount: () => Promise<void>
  fetchList: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

// お知らせの共有ストア（ヘッダーの巻物アイコンから使う）。
// 未読数はポーリングで更新し、一覧はドロップダウンを開いたときだけ取りに行く。
// 取得失敗は billing ストアと同じく握りつぶす（表示しないだけ）。
export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchUnreadCount: async () => {
    try {
      set({ unreadCount: await getUnreadCount() })
    } catch {
      // 取得失敗は無視（バッジを更新しないだけ）
    }
  },

  fetchList: async () => {
    set({ loading: true })
    try {
      const page = await getNotifications()
      set({ notifications: page.notifications, unreadCount: page.unread_count })
    } catch {
      // 取得失敗は無視（前回の内容を残す）
    } finally {
      set({ loading: false })
    }
  },

  markRead: async (id) => {
    const target = get().notifications.find((n) => n.id === id)
    if (!target || target.read) return

    // 遷移と同時に呼ばれるので、先に画面へ反映してから API を叩く
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
    try {
      await markNotificationRead(id)
    } catch {
      // 失敗しても次のポーリングで整合するので無視
    }
  },

  markAllRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
    try {
      await markAllNotificationsRead()
    } catch {
      // 失敗しても次のポーリングで整合するので無視
    }
  },
}))
