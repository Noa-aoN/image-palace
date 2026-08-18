'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useSaveStatusStore } from '@/stores/saveStatus'

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
 * 閉じるまで残るが、下のカードは掴める。
 *
 * **やり直す釦は出さない。** 何を失敗したかを持っていないので、
 * 押しても同じ操作をやり直せない。できることを正直に書く。
 */
export function SaveStatusNotice() {
  const failed = useSaveStatusStore((s) => s.failed)
  const dismiss = useSaveStatusStore((s) => s.dismiss)

  if (failed === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4 sm:justify-end sm:pr-6"
    >
      <div className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-lg">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 text-xs leading-relaxed">
          <p className="font-medium">
            保存できませんでした{failed > 1 && `（${failed}件）`}
          </p>
          {/* **何が起きるかを書く。** 「失敗しました」だけだと、
              いま画面に見えているものが残るのかどうかが分からない */}
          <p className="mt-0.5">
            通信を確かめて、もう一度お試しください。
            この操作は画面を読み込み直すと元に戻ります。
          </p>
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
