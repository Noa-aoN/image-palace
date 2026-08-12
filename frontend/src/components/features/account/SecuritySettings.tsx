'use client'

import { useEffect } from 'react'
import { useAdminStore } from '@/stores/admin'
import { PasskeySettings } from '@/components/features/account/PasskeySettings'
import { TwoFactorSettings } from '@/components/features/account/TwoFactorSettings'

/**
 * セキュリティの設定をまとめる場所。
 *
 * **パスキーはいまのところ運営だけに出す。** 仕組み（DB・API）は
 * 全利用者に配れる形にしてあるが、運用が固まるまでは出す先を絞る。
 * 一般の人には、これまでどおりの入り方だけで足りる。
 *
 * 二要素認証（認証アプリ）は誰でも使える。パスキーが使えない端末や、
 * 端末を失ったときの控えになるので、片方だけを強いない。
 */
export function SecuritySettings() {
  const isAdmin = useAdminStore((s) => s.session?.admin ?? false)
  const fetchSession = useAdminStore((s) => s.fetchSession)

  // ヘッダーが既に読み込んでいればそれを使い、直接開かれたときだけ取りに行く
  useEffect(() => {
    void fetchSession()
  }, [fetchSession])

  return (
    <div className="space-y-4">
      {isAdmin && <PasskeySettings />}
      <TwoFactorSettings />
    </div>
  )
}
