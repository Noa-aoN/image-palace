'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RotateCw, X } from 'lucide-react'
import { failedCount, useSaveStatusStore } from '@/stores/saveStatus'
import { flushPending } from '@/lib/api/persist'

/**
 * 「保存できませんでした」を画面の隅に出す。
 *
 * キャンバスとスペースの編集は画面を先に動かすので、書き込みが落ちても
 * 見た目は変わらない。**言わなければ、リロードするまで気づけない。**
 *
 * ## 出し方の決めごと
 *
 * **保存中は出さない。** ふだんの操作でいちいち「保存中」が瞬くと、
 * それが普通になって、本当に失敗したときの札も読み飛ばされる。
 *
 * **邪魔をしない。** 盤面の上に重ねるが、`pointer-events` は札の中だけ。
 *
 * **通信が戻ったら黙って送り直す。** 利用者が押すのを待たない。
 * 送れたぶんから札の数が減り、全部送れたら札ごと消える。
 */
export function SaveStatusNotice() {
  const queued = useSaveStatusStore((s) => s.queued)
  const lost = useSaveStatusStore((s) => s.lost)
  const dismiss = useSaveStatusStore((s) => s.dismiss)
  const [sending, setSending] = useState(false)

  const failed = failedCount({ queued, lost })
  const canResend = queued.length > 0

  // 通信が戻ったら自動で送り直す。
  // **戻った瞬間はまだ細いことがある**ので、少し置いてから送る
  useEffect(() => {
    if (queued.length === 0) return

    const onOnline = () => {
      const timer = setTimeout(() => {
        setSending(true)
        flushPending().finally(() => setSending(false))
      }, 600)
      return () => clearTimeout(timer)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [queued.length])

  if (failed === 0) return null

  const resend = async () => {
    setSending(true)
    try {
      await flushPending()
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4 sm:justify-end sm:pr-6"
    >
      <div className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-lg">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 text-xs leading-relaxed">
          <p className="font-medium">保存できませんでした{failed > 1 && `（${failed}件）`}</p>
          {/* **何が起きるかを書く。** 「失敗しました」だけだと、
              いま画面に見えているものが残るのかどうかが分からない */}
          <p className="mt-0.5">
            {canResend
              ? '通信が戻ると自動で送り直します。いますぐ送ることもできます。'
              : '通信を確かめて、もう一度お試しください。この操作は画面を読み込み直すと元に戻ります。'}
          </p>
          {canResend && (
            <button
              type="button"
              onClick={resend}
              disabled={sending}
              className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white/70 px-2 py-1 font-medium transition hover:bg-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <RotateCw size={12} className={sending ? 'animate-spin' : ''} aria-hidden />
              {sending ? '送っています…' : 'いま送り直す'}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="閉じる"
          className="-mr-1 -mt-1 shrink-0 rounded p-1 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
