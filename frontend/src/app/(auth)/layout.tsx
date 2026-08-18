import { Suspense } from 'react'
import { AuthFooter } from '@/components/features/layout/AuthFooter'
import { GuestOnly } from '@/components/features/auth/GuestOnly'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  /*
    背景画像の preload はここに置かない。

    **`(auth)` 限定のつもりが、限定にならない。** LP には「ログイン」の
    導線があり、Next が `/login` を先読みする。そのとき この layout の
    preload も一緒に効いて、門と風景（合わせて 307KB）が
    LP・使い方・読みもので毎回読まれていた（実測）。

    CSS の背景として、要素が出た時点で取りに行けば足りる。
  */
  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 flex items-center justify-center py-6 px-4">
        {/* 既に入っている人には門を見せない（中へ戻す）。
            `next` を読むので Suspense の内側に置く（静的化を外さないため） */}
        <Suspense fallback={null}>
          <GuestOnly>{children}</GuestOnly>
        </Suspense>
      </main>
      <AuthFooter />
    </div>
  )
}
