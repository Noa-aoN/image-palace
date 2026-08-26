'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { fetchStudioSettings, updateStudioSettings, type StudioSettings } from '@/lib/api/studio'
import { enterDemo } from '@/lib/api/demo'
import { DEMO_HOME } from '@/lib/demo/guide'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'
import { useStudioRoom } from '@/hooks/useStudioRoom'
import { DEMO_STAGE_LABEL, DEMO_STAGE_NOTE, DEMO_STAGES, type DemoStage } from '@/lib/studio/status'
import { PreviewStrip } from './PreviewStrip'
import { StudioPackageList } from './StudioPackageList'
import { QuickLookDialog } from './QuickLookDialog'

/**
 * 体験宮殿設定。**体験用の宮殿に、何を置くか。**
 *
 * 置くものを「配置物」と呼ぶ。人に渡す「配布物」とは役割が違うので、
 * 名前も部屋も分けてある。同じ荷物が両方に出ることはあるが、
 * **触っている栓が違う**ので重複ではない。
 */
export function StudioDemoPanel() {
  const router = useRouter()
  const { data, preview, busy, error, act, openPreview, stopPreview } = useStudioRoom()

  const [settings, setSettings] = useState<StudioSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [entering, setEntering] = useState(false)
  // 置いている荷物を、入り直さずに見る
  const [looking, setLooking] = useState<{ key: string; version: number } | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    fetchStudioSettings()
      .then(setSettings)
      .catch(() => setLocalError('設定を読めませんでした'))
  }, [])

  async function saveStage(stage: string) {
    if (saving) return
    setSaving(true)
    setLocalError(null)
    try {
      setSettings(await updateStudioSettings({ demo_entry_stage: stage }))
    } catch {
      setLocalError('変えられませんでした')
    } finally {
      setSaving(false)
    }
  }

  // 体験を確かめる。**いまのログインから離れる**ので、先に断る。
  // 別のタブで開いても合鍵は同じ引き出しにあるので、離れることは避けられない
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
    setLocalError(null)
    try {
      const session = await enterDemo()
      useItemsStore.getState().resetItems()
      useAuthStore.getState().setAuth(session.user, session.tokens)
      // 体験はカード一覧から（DemoEntryButton と同じ入口にそろえる）
      router.push(DEMO_HOME)
    } catch {
      setLocalError('体験用の宮殿へ入れませんでした')
      setEntering(false)
    }
  }

  const shown = error ?? localError

  if (shown && !data) return <p className="py-12 text-center text-muted-foreground">{shown}</p>
  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const stage = settings?.demo_entry_stage as DemoStage | undefined

  return (
    <div className="space-y-6">
      {shown ? (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger-deep)' }}>
          {shown}
        </p>
      ) : null}

      <PreviewStrip preview={preview} busy={busy === 'preview-end'} onStop={stopPreview} />

      {settings ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="text-base font-semibold">入口</h2>
            <p className="text-xs text-muted-foreground">
              LP と登録・ログイン画面のボタンが、一般の方にどう見えるか。
              制作の権限があれば、準備中でも確かめられます
            </p>
          </div>

          {/* 体験の宮殿は「置く」にした配置物を全部入れて組む。
              **何が入るのかを、ここで見えるようにする** */}
          {settings.demo_package.published ? (
            <div className="text-xs text-muted-foreground">
              <p>
                いま置いているもの: {settings.demo_package.packages?.length} 件 / カード{' '}
                {settings.demo_package.items} 枚
              </p>
              {/* **ここからそのまま中身を見られるようにする。**
                  体験の宮殿に何が置いてあるかを確かめたいだけなら、
                  入り直さずに済む（ログインからも離れない） */}
              <ul className="mt-1 space-y-1">
                {settings.demo_package.packages?.map((p) => (
                  <li key={p.key} className="flex flex-wrap items-center gap-2">
                    <span>
                      {p.name}（{p.key} v{p.version} / {p.items} 枚）
                    </span>
                    <button
                      type="button"
                      onClick={() => setLooking({ key: p.key, version: p.version })}
                      className="rounded-full border border-border px-2 py-0.5 transition hover:bg-muted"
                    >
                      さっと見る
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--gold-ink)' }}>
              置いているものがありません。開いても入れません
              （下の配置物で「体験の宮殿に置く」を入れてください）
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {/* サーバーが返す4段のうち、体験の入口で意味があるものだけを出す
                （試作は「触れる」意味だが、体験の入口は公開でないと開かない） */}
            {settings.demo_entry_stages
              .filter((s) => DEMO_STAGES.includes(s as DemoStage))
              .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => saveStage(s)}
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
              {entering ? 'ご案内しています…' : '体験宮殿に入ってみる'}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              実際に入って、来た人と同じ画面で確かめます。
              <strong className="text-foreground">いまのログインからは離れます</strong>
              （合鍵は同じ引き出しにあるので、別のタブでも同じことが起きます）。
              中身を見るだけなら、上の「さっと見る」で済みます。
            </p>
          </div>
        </section>
      ) : null}

      {looking ? (
        <QuickLookDialog
          packageKey={looking.key}
          version={looking.version}
          onClose={() => setLooking(null)}
          onPreview={() => setLooking(null)}
        />
      ) : null}

      <StudioPackageList
        room="demo"
        packages={data.packages}
        busy={busy}
        onAct={act}
        onPreview={openPreview}
      />
    </div>
  )
}
