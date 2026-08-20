'use client'

import { useEffect } from 'react'
import { useAdminStore } from '@/stores/admin'
import { needsStrongAuth } from '@/lib/auth/capabilities'
import { PasskeySettings } from '@/components/features/account/PasskeySettings'
import { TwoFactorSettings } from '@/components/features/account/TwoFactorSettings'

/**
 * セキュリティの設定をまとめる場所。**奥の部屋に入る人にだけ出す。**
 *
 * 仕組み（DB・API）は全利用者に配れる形にしてあるが、本リリース時点で
 * パスキーも二要素認証も運営・制作の運用のためのもので、一般の人には
 * これまでどおりの入り方（Google / Apple / メール）だけで足りる。
 *
 * **使わせないものを見せない。** 設定できるように見えて意味が無いものが
 * 並んでいると、必要な設定なのかを毎回考えることになる。
 *
 * ただし**役割では決めない。** 執務室と工房はどちらも本人確認を求めるので、
 * どちらかに入れる人には必要になる。工房は役割が `user` の口座も使うため、
 * 役割で見ていると**設定できないまま閉め出される**（実際そうなった）。
 *
 * ログイン方法・メールアドレスは「登録情報」に、退会は「退会」にあるので、
 * ここを隠しても一般の人が失うものは無い。
 */
export function SecuritySettings() {
  const session = useAdminStore((s) => s.session)
  const fetchSession = useAdminStore((s) => s.fetchSession)

  // ヘッダーが既に読み込んでいればそれを使い、直接開かれたときだけ取りに行く
  useEffect(() => {
    void fetchSession()
  }, [fetchSession])

  // ここでの出し分けは見た目の話であって、守りではない。
  // 権限の判定はサーバー側で毎リクエスト行われる
  if (!needsStrongAuth(session)) return null

  return (
    <div className="space-y-4">
      <PasskeySettings />
      <TwoFactorSettings />
    </div>
  )
}
