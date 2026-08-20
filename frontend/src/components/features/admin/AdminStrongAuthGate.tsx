'use client'

import Link from 'next/link'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { StrongAuthPrompt } from '@/components/features/account/StrongAuthPrompt'

/**
 * 奥の部屋の扉。一次認証を通ったあと、もう一度ご本人か確かめる。
 *
 * **合鍵ひとつで奥まで開くのを避ける。** ログインの情報は漏れうるが、
 * 手元の鍵（パスキー・認証アプリ）まで同時に奪うのは桁違いに難しい。
 *
 * **入る場所の名前で言う。** 執務室と工房室で同じ扉を使うが、
 * 「執務室に入る準備が必要です」と出ると、工房室へ来た人は
 * 別の部屋の話をされているように読む。
 *
 * ここでの出し分けは見た目の話であって、守りではない。
 * 実際の判定はサーバー側で毎リクエスト行われる。
 *
 * 手立てを持っていない人は**締め出さず、用意する場所へ案内する**。
 * 扉の外は変わらず開くので、登録して戻ってこられる。
 */
export function AdminStrongAuthGate({
  prepared,
  onDone,
  room = '執務室',
  reason = '運営の画面を開くため、もう一度ご本人か確かめさせてください。',
  preparation = '運営として入るときは、ログインに加えてもう一度ご本人か確かめています。',
}: {
  /** パスキーか認証アプリを持っているか */
  prepared: boolean
  /** 確かめ終わったとき。呼び出し側が権限を取り直す */
  onDone: () => void
  /** どこへ入ろうとしているか。**扉に出る名前** */
  room?: string
  /** 確かめるときの一言 */
  reason?: string
  /** まだ手立てが無いときの一言 */
  preparation?: string
}) {
  // 何も持っていない人に確認画面を出しても、押せるものが無い。
  // 行き止まりにせず、用意する場所へ送る
  if (!prepared) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-24 text-center">
        <ShieldAlert size={32} className="mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">{room}に入る準備が必要です</h1>
        <p className="text-sm text-muted-foreground">
          {preparation}
          パスキーか認証アプリを登録してから、あらためてお越しください。
        </p>
        <Link
          href="/account#security"
          className="inline-flex h-9 items-center rounded-lg bg-[var(--palace)] px-4 text-sm font-medium text-white transition hover:opacity-90"
        >
          セキュリティの設定を開く
        </Link>
        <p className="text-xs text-muted-foreground">
          ふだんの機能はこれまでどおりお使いいただけます。
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-24">
      <div className="flex items-center justify-center gap-2">
        <ShieldCheck size={22} style={{ color: 'var(--palace)' }} />
        <h1 className="text-xl font-semibold">{room}</h1>
      </div>
      <StrongAuthPrompt reason={reason} onDone={onDone} />
    </div>
  )
}
