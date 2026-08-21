'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { createDraft, fetchStudioSources, type StudioSources } from '@/lib/api/studio'
import { validateKey } from '@/lib/studio/status'

const KINDS = [
  { value: 'starter', label: 'Starter', note: '登録した人が受け取れる' },
  { value: 'demo', label: 'Demo', note: '体験用の宮殿に配る' },
  { value: 'advance', label: 'Advance', note: '将来の有料コンテンツ' },
] as const

/**
 * 公式宮殿の中から、公開するものを選ぶ。
 *
 * **宮殿にあるもの全部が公開物ではない。**
 * 宮殿は原本・制作の場として自由に使い、その中から出すものだけをここで選ぶ。
 *
 * 選んだら**下書き**として起こす。出すのはそのあと（下見してから）。
 */
export function StudioPublishPanel() {
  const router = useRouter()
  const [sources, setSources] = useState<StudioSources | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [kind, setKind] = useState<'starter' | 'demo' | 'advance'>('starter')
  const [boxIds, setBoxIds] = useState<Set<string>>(new Set())
  const [viewIds, setViewIds] = useState<Set<string>>(new Set())

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStudioSources()
      .then(setSources)
      .catch((e) => {
        const code = (e as { response?: { data?: { code?: string } } }).response?.data?.code
        setLoadError(
          code === 'official_account_missing'
            ? '公式コンテンツのアカウントが設定されていません'
            : '原本を読めませんでした'
        )
      })
  }, [])

  function toggle(set: Set<string>, id: string, update: (next: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    update(next)
  }

  const keyError = key ? validateKey(key) : null
  const nothingSelected = boxIds.size === 0 && viewIds.size === 0
  const canSubmit = !saving && !keyError && key && name && !nothingSelected

  async function handleSubmit() {
    if (!canSubmit) return

    setSaving(true)
    setError(null)
    try {
      await createDraft({
        key,
        kind,
        name,
        summary: summary || undefined,
        box_ids: [...boxIds],
        view_ids: [...viewIds],
      })
      router.push('/studio')
    } catch (e) {
      const res = (e as { response?: { data?: { error?: string; errors?: string[] } } }).response
      setError(res?.data?.error ?? res?.data?.errors?.join(' / ') ?? '下書きを作れませんでした')
      setSaving(false)
    }
  }

  if (loadError) return <p className="py-12 text-center text-muted-foreground">{loadError}</p>
  if (!sources) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        公式宮殿の中から、公開するものを選びます。**選んだものだけ**が荷物に入ります。
        まず下書きとして起こし、下見してから公開します。
      </p>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">1. 何を出すか</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="studio-key">鍵</Label>
            <Input
              id="studio-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="starter_it"
              aria-invalid={Boolean(keyError)}
            />
            {keyError ? (
              <p className="text-xs" style={{ color: '#9E3226' }}>
                {keyError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                同じ鍵でもう一度出すと、版が1つ上がります
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="studio-name">名前</Label>
            <Input
              id="studio-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ITのことば"
            />
            <p className="text-xs text-muted-foreground">受け取る画面に出ます</p>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="studio-summary">紹介文</Label>
          <Input
            id="studio-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="言葉だけでは掴みにくい、技術のことば"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">種別</legend>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                aria-pressed={kind === k.value}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  kind === k.value ? 'border-[var(--palace)] bg-[var(--ivory-dark)]' : 'border-border'
                }`}
              >
                <span className="block font-medium">{k.label}</span>
                <span className="block text-xs text-muted-foreground">{k.note}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">2. 原本を選ぶ</h2>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">箱</h3>
          {sources.boxes.length === 0 ? (
            <p className="text-sm text-muted-foreground">公式宮殿に箱がありません</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {sources.boxes.map((box) => (
                <li key={box.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={boxIds.has(box.id)}
                      onChange={() => toggle(boxIds, box.id, setBoxIds)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{box.name}</span>
                      <span className="block text-xs text-muted-foreground">{box.items} 枚</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">キャンバス</h3>
          {sources.views.length === 0 ? (
            <p className="text-sm text-muted-foreground">公式宮殿にキャンバスがありません</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {sources.views.map((view) => (
                <li key={view.id}>
                  <label
                    className={`flex items-start gap-2 rounded-lg border border-border p-3 text-sm ${
                      view.portable ? 'cursor-pointer hover:bg-muted' : 'cursor-not-allowed opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={viewIds.has(view.id)}
                      disabled={!view.portable}
                      onChange={() => toggle(viewIds, view.id, setViewIds)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{view.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {view.portable
                          ? `カード ${view.items} / 線 ${view.edges}`
                          : '宮殿に結びついているため、まだ配れません'}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* キャンバスに置かれているカードは、箱を選ばなくても一緒に入る */}
        {viewIds.size > 0 ? (
          <p className="text-xs text-muted-foreground">
            キャンバスに置かれているカードは、箱を選ばなくても一緒に入ります
          </p>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="text-sm" style={{ color: '#9E3226' }}>
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {saving ? '作っています…' : '下書きを作る'}
        </Button>
        <p className="text-xs text-muted-foreground">
          {nothingSelected ? '箱かキャンバスを1つ以上選んでください' : 'まだ誰にも配りません'}
        </p>
      </div>
    </div>
  )
}
