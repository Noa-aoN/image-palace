'use client'

import { Eye } from 'lucide-react'

/**
 * 「ここは見るだけ」の断り書き。
 *
 * 権限の足りない操作を黙って出しておくと、押して 403 を踏むまで分からない。
 * かといってボタンを消すだけだと、機能が無いのか権限が無いのか区別が付かない。
 * **何ができないのかを先に言う。**
 *
 * これは見た目の話であって、守りではない。守りはサーバー側（require_role!）にある。
 */
export function ReadOnlyNotice({ what, need = '運営' }: { what: string; need?: string }) {
  return (
    <p className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <Eye size={13} className="shrink-0" />
      いまの権限では閲覧のみです（{what}には{need}以上の権限が要ります）。
    </p>
  )
}
