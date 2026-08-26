'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { fetchStudioSettings, updateStudioSettings, type StudioSettings } from '@/lib/api/studio'
import { useAdminStore } from '@/stores/admin'

/**
 * 全体設定。**部屋をまたいで効くものだけを置く。**
 *
 * 体験の入口は体験宮殿設定へ移した。ここに残るのは
 * 本人確認・公式のアカウント・制作枠のように、どの部屋にも関わるもの。
 *
 * 枠の上限は執務室（`/admin`）の奥にもある。だが制作だけの人は
 * 執務室に入れないので、同じ栓をここにも出す。
 * 触っているのは同じ行なので、どちらから変えても効く。
 */
export function StudioSettingsPanel() {
  const adminSession = useAdminStore((s) => s.session)
  const [settings, setSettings] = useState<StudioSettings | null>(null)
  const [limit, setLimit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchStudioSettings()
      .then((data) => {
        setSettings(data)
        setLimit(String(data.allowance_limit_credits))
      })
      .catch(() => setError('設定を読めませんでした'))
  }, [])

  async function save(patch: Parameters<typeof updateStudioSettings>[0]) {
    if (saving) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const next = await updateStudioSettings(patch)
      setSettings(next)
      setLimit(String(next.allowance_limit_credits))
      setSaved(true)
    } catch {
      setError('変えられませんでした')
    } finally {
      setSaving(false)
    }
  }

  if (error && !settings) return <p className="py-12 text-center text-muted-foreground">{error}</p>
  if (!settings) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger-deep)' }}>
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-muted-foreground">変えました</p> : null}

      {/* **保存先は二重化していない。** 執務室と同じ行を触っている。
          そう書いておかないと、片方で変えたときもう片方に効いている確信が持てない */}
      <p className="rounded-lg border border-dashed border-border px-4 py-2 text-xs text-muted-foreground">
        ここの設定は、執務室（<code>/admin</code>）の機能設定と共通です。
        どちらで変更しても同じ値が更新されます。
      </p>

      {/* 工房は公開まで届く場所。**合鍵ひとつで公開まで開くのを避ける。**
          執務室と同じ関門を使っているので、案内も同じ場所へ向ける */}
      <section className="space-y-2 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">本人確認</h2>
        <p className="text-xs text-muted-foreground">
          工房に入るときは、もう一度ご本人か確かめます。**執務室と同じ仕組みです**
        </p>
        <StrongAuthState session={adminSession} />
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">公式コンテンツのアカウント</h2>
        {settings.official_account.configured ? (
          <p className="text-sm">
            {settings.official_account.email}
            <span className="ml-2 text-xs text-muted-foreground">
              カード {settings.official_account.items} 枚
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            設定されていません（<code>OFFICIAL_CONTENT_USER_ID</code>）。原本を選べません
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold">公式制作枠</h2>
          <p className="text-xs text-muted-foreground">
            公式コンテンツを作るときに使う枠。**買ったクレジットは減りません。**毎月戻ります
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="studio-limit">月あたりの上限（cr）</Label>
            <Input
              id="studio-limit"
              type="number"
              min={0}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-32"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={saving || limit === String(settings.allowance_limit_credits)}
            onClick={() => save({ allowance_limit_credits: Number(limit) })}
          >
            変える
          </Button>
        </div>
      </section>

    </div>
  )
}

/**
 * 本人確認の状態。
 *
 * **求めていないときも、そうと言う。** 何も出さないと
 * 「設定できていないのか、求められていないのか」が分からない。
 */
function StrongAuthState({ session }: { session: { strong_auth?: { required: boolean; prepared?: boolean } } | null }) {
  const strongAuth = session?.strong_auth

  if (!strongAuth?.required) {
    return (
      <p className="text-sm text-muted-foreground">
        いまは求めていません。
        <Link href="/account#security" className="ml-1 underline underline-offset-2">
          パスキー・認証アプリを設定する
        </Link>
      </p>
    )
  }

  if (!strongAuth.prepared) {
    return (
      <p className="text-sm" style={{ color: 'var(--gold-ink)' }}>
        手立てがありません。
        <Link href="/account#security" className="ml-1 underline underline-offset-2">
          パスキーか認証アプリを設定してください
        </Link>
      </p>
    )
  }

  return (
    <p className="text-sm text-muted-foreground">
      設定済みです。
      <Link href="/account#security" className="ml-1 underline underline-offset-2">
        設定を見る
      </Link>
    </p>
  )
}
