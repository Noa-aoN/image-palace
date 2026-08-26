'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertTriangle, Megaphone, X } from 'lucide-react'
import { useNotificationsStore } from '@/stores/notifications'
import { formatRelativeTime } from '@/lib/datetime'
import type { NotificationKind } from '@/lib/api/notifications'

// お知らせの種別ごとのアイコン
function notificationIcon(kind: NotificationKind) {
  switch (kind) {
    case 'item_generation_completed':
      return <CheckCircle2 size={16} className="text-green-600" />
    case 'item_generation_failed':
      return <AlertTriangle size={16} className="text-red-600" />
    default:
      return <Megaphone size={16} style={{ color: 'var(--palace)' }} />
  }
}

/**
 * お知らせ一覧のパネル。ヘッダーの巻物アイコンから開き、アイコンの真下・右寄せに出す。
 * 面（bg-popover / rounded-lg / ring / shadow-md）と行のホバーはアカウントメニュー
 * （ui/dropdown-menu）に合わせ、幅と余白だけは読むための余裕を持たせている。
 * 各お知らせをクリックすると既読にして、その行き先（カード詳細など）へ遷移する。
 */
export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const notifications = useNotificationsStore((s) => s.notifications)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const loading = useNotificationsStore((s) => s.loading)
  const fetchList = useNotificationsStore((s) => s.fetchList)
  const markRead = useNotificationsStore((s) => s.markRead)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)

  // 開いたときに最新を取りに行く。
  useEffect(() => {
    if (open) fetchList()
  }, [open, fetchList])

  // Escape で閉じる（メニューと同じ作法）。
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // 開くのはユーザー操作の後（＝クライアント側）なので、SSR 中はここに来ない。
  if (!open || typeof document === 'undefined') return null

  const handleSelect = (id: string, url: string | null) => {
    markRead(id)
    onClose()
    if (url) router.push(url)
  }

  // ヘッダー（relative z-30）の内側だと重なり文脈に閉じ込められ、同じ z-30 の
  // サイドバーが前面に出てしまうので body 直下に出す。
  return createPortal(
    <>
      {/* 外側をクリックで閉じる（メニューと同じ。背景は暗くしない） */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="お知らせ"
        className="fixed right-2 top-[calc(3.5rem+0.25rem)] z-50 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">お知らせ</span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                すべて既読にする
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="閉じる"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 区切り線はメニュー（DropdownMenuSeparator）と同じ寸法・色にする */}
        <div className="-mx-1.5 my-1.5 h-px bg-border" aria-hidden />

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">読み込み中…</p>
          ) : notifications.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">お知らせはありません</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(n.id, n.url)}
                    className="flex w-full items-start gap-2.5 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="mt-0.5 shrink-0">{notificationIcon(n.kind)}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-snug ${n.read ? 'text-muted-foreground' : 'font-medium'}`}>
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                      )}
                      <span className="mt-1 block text-2xs text-muted-foreground/70">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </span>
                    {!n.read && (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: 'var(--palace)' }}
                        aria-label="未読"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
