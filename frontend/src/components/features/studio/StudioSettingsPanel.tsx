'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { fetchStudioSettings, updateStudioSettings, type StudioSettings } from '@/lib/api/studio'
import { enterDemo } from '@/lib/api/demo'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'
import { useAdminStore } from '@/stores/admin'
import { DEMO_STAGE_LABEL, DEMO_STAGE_NOTE, type DemoStage } from '@/lib/studio/status'

/**
 * 工房の設定。**ここだけで完結するようにする。**
 *
 * 枠の上限も体験の入口も、執務室（`/admin`）の奥にある。
 * だが制作だけの人は執務室に入れないので、同じ栓をここにも出す。
 * 触っているのは同じ行なので、どちらから変えても効く。
 */
export function StudioSettingsPanel() {
  const router = useRouter()
  const adminSession = useAdminStore((s) => s.session)
  const [settings, setSettings] = useState<StudioSettings | null>(null)
  const [limit, setLimit] = useState('')
  const [saving, setSaving] = useState(false)
  const [entering, setEntering] = useState(false)
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

  // 体験を確かめる。**いまのログインから離れる**ので、先に断る
  async function enterDemoForCheck() {
    if (entering) return
    if (
      !window.confirm(
        '体験用の宮殿へ入ります。いまのログインからは離れるので、確かめ終わったら入り直してください。'
      )
    ) {
      return
    }

    setEntering(true)
    setError(null)
    try {
      const session = await enterDemo()
      useItemsStore.getState().resetItems()
      useAuthStore.getState().setAuth(session.user, session.tokens)
      router.push('/entrance')
    } catch {
      setError('体験用の宮殿へ入れませんでした')
      setEntering(false)
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

  const stage = settings.demo_entry_stage as DemoStage

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="text-sm" style={{ color: '#9E3226' }}>
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-muted-foreground">変えました</p> : null}

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
        <h2 className="text-base font-semibold">公式コンテンツの口座</h2>
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

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold">体験用の宮殿の入口</h2>
          <p className="text-xs text-muted-foreground">
            LP と登録・ログイン画面のボタンが、一般の方にどう見えるか。
            **制作の権限があれば、準備中でも確かめられます**
          </p>
        </div>

        {/* 体験の宮殿は「届け先が体験の荷物を全部」入れて組む。
            **何が入るのかを、ここで見えるようにする** */}
        {settings.demo_package.published ? (
          <div className="text-xs text-muted-foreground">
            <p>
              いま置いているもの: {settings.demo_package.packages?.length} 件 / カード{' '}
              {settings.demo_package.items} 枚
            </p>
            <ul className="mt-1 list-disc pl-5">
              {settings.demo_package.packages?.map((p) => (
                <li key={p.key}>
                  {p.name}（{p.key} v{p.version} / {p.items} 枚）
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs" style={{ color: '#8A6210' }}>
            置いているものがありません。開いても入れません
            （荷物の届け先に「体験の宮殿に置く」を入れてください）
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {settings.demo_entry_stages.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => save({ demo_entry_stage: s })}
              disabled={saving}
              aria-pressed={stage === s}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${
                stage === s ? 'border-[var(--palace)] bg-[var(--ivory-dark)]' : 'border-border'
              }`}
            >
              <span className="block font-medium">{DEMO_STAGE_LABEL[s as DemoStage] ?? s}</span>
              <span className="block text-xs text-muted-foreground">
                {DEMO_STAGE_NOTE[s as DemoStage] ?? ''}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t pt-3" style={{ borderColor: 'var(--ivory-dark)' }}>
          <Button size="sm" variant="outline" onClick={enterDemoForCheck} disabled={entering}>
            {entering ? 'ご案内しています…' : '体験を確かめる'}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            準備中のままでも入れます。**いまのログインからは離れます**
          </p>
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
      <p className="text-sm" style={{ color: '#8A6210' }}>
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
