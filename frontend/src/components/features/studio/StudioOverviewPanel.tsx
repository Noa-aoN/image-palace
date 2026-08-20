'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  changeStatus,
  endPreview,
  fetchCurrentPreview,
  fetchStudio,
  previewPackage,
  setDelivery,
  type Delivery,
  type PreviewState,
  type StudioOverview,
  type StudioPackage,
} from '@/lib/api/studio'
import {
  actionsFor,
  canPreview,
  countByStatus,
  filterPackages,
  PACKAGE_FILTERS,
  STATUS_LABEL,
  STATUS_NOTE,
  STATUS_TONE,
  type PackageFilter,
} from '@/lib/studio/status'
import { previewEntryPath } from '@/lib/studio/preview'

/**
 * 工房室の概要。**いま何を配っているかと、原本の様子。**
 *
 * 荷物ごとにできることを並べる。
 * 戻せない操作（終える）だけ、押す前に確かめる。
 */
export function StudioOverviewPanel() {
  const router = useRouter()
  const [data, setData] = useState<StudioOverview | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ active: false })
  const [filter, setFilter] = useState<PackageFilter>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchStudio()
      .then(setData)
      .catch(() => setError('工房を開けませんでした'))
    fetchCurrentPreview()
      .then(setPreview)
      .catch(() => setPreview({ active: false }))
  }, [])

  useEffect(load, [load])

  const counts = useMemo(() => (data ? countByStatus(data.packages) : null), [data])
  const shown = useMemo(
    () => (data ? filterPackages(data.packages, filter) : []),
    [data, filter]
  )

  /**
   * 下見を始めて、**新しいタブで普通の画面を開く。**
   *
   * 工房室を閉じずに、受け取った人と同じ見え方を確かめられるようにする。
   * タブは押した瞬間に開ける（返事を待ってから開くと、覗き窓の妨げに止められる）。
   */
  async function openPreview(pkg: StudioPackage) {
    if (busy) return
    const tab = window.open('about:blank', '_blank', 'noopener')

    setBusy(`${pkg.id}-preview`)
    setError(null)
    try {
      const result = await previewPackage(pkg.key, pkg.version)
      setPreview(result)

      const path = previewEntryPath(result)
      if (tab) tab.location.href = path
      else router.push(path)
    } catch (e) {
      tab?.close()
      const message = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(message ?? '下見を始められませんでした')
    } finally {
      setBusy(null)
    }
  }

  async function stopPreview() {
    if (busy) return
    setBusy('preview-end')
    try {
      await endPreview()
      setPreview({ active: false })
      load()
    } finally {
      setBusy(null)
    }
  }

  async function act(pkg: StudioPackage, fn: () => Promise<unknown>, key: string) {
    if (busy) return
    setBusy(key)
    setError(null)
    try {
      await fn()
      load()
    } catch (e) {
      const message = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(message ?? '操作できませんでした')
    } finally {
      setBusy(null)
    }
  }

  if (error && !data) {
    return <p className="py-12 text-center text-muted-foreground">{error}</p>
  }
  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="text-sm" style={{ color: '#9E3226' }}>
          {error}
        </p>
      ) : null}

      {/* 原本の様子。**公式宮殿にあるもの全部が公開物ではない**ので、
          ここは「持ち物」であって「配っているもの」ではない */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">公式宮殿（原本）</h2>
        {data.owner ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Stat label="口座" value={data.owner.email} />
            <Stat label="カード" value={`${data.owner.items} 枚`} />
            <Stat label="箱" value={`${data.owner.boxes}`} />
            <Stat label="キャンバス" value={`${data.owner.views}`} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            公式コンテンツの口座が設定されていません（<code>OFFICIAL_CONTENT_USER_ID</code>）
          </p>
        )}
      </section>

      {data.allowance ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 text-base font-semibold">公式制作枠</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            公式コンテンツを作るときはこちらを使います。**買ったクレジットは減りません。**毎月戻ります
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {data.allowance.used_credits}
            <span className="text-base font-normal text-muted-foreground">
              {' / '}
              {data.allowance.limit_credits} cr
            </span>
          </p>
        </section>
      ) : null}

      {/* 下見中であることは、工房室でも見えたほうがよい。
          ただし「工房室へ戻る」は要らない（いまそこ）ので、帯とは別の形で出す */}
      {preview.active ? (
        <section
          className="flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm"
          style={{ borderColor: '#4A3B6B', backgroundColor: 'color-mix(in srgb, #4A3B6B 6%, transparent)' }}
        >
          <span className="flex-1">
            いま <strong>{preview.name ?? preview.key}</strong> v{preview.version} を下見しています
            （カード {preview.items} 枚）
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(previewEntryPath(preview), '_blank', 'noopener')}
          >
            下見を開く
          </Button>
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={stopPreview}>
            {busy === 'preview-end' ? '片付けています…' : '下見を終了'}
          </Button>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">荷物</h2>
          <Button size="sm" onClick={() => router.push('/studio/publish')}>
            新しく作る
          </Button>
        </div>

        {/* 扱いで絞る。**大きな検索は要らない。** 数が見えれば、どこを見ればよいか分かる */}
        {data.packages.length > 0 && counts ? (
          <div className="flex flex-wrap gap-2">
            {PACKAGE_FILTERS.map((f) => {
              const n = f.value === 'all' ? data.packages.length : counts[f.value]
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  aria-pressed={filter === f.value}
                  disabled={n === 0 && f.value !== 'all'}
                  className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-40 ${
                    filter === f.value
                      ? 'border-[var(--palace)] font-medium'
                      : 'border-border text-muted-foreground'
                  }`}
                  style={
                    filter === f.value ? { backgroundColor: 'var(--palace)', color: '#fff' } : undefined
                  }
                >
                  {f.label} <span className="tabular-nums">{n}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {data.packages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            まだ1つもありません。「新しく作る」から、公式宮殿の中身を選んでください
          </p>
        ) : shown.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            あてはまる荷物がありません
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((pkg) => (
              <li
                key={pkg.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-background p-4"
              >
                <StatusChip status={pkg.status} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {pkg.name}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      {pkg.key} v{pkg.version} / {pkg.kind}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    カード {pkg.counts.items} / 箱 {pkg.counts.boxes} / キャンバス {pkg.counts.views}
                    {pkg.installs > 0 ? ` ・ ${pkg.installs} 人が受け取り済み` : ''}
                  </p>
                </div>

                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  {canPreview(pkg.status) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => openPreview(pkg)}
                    >
                      {busy === `${pkg.id}-preview` ? '入れています…' : '下見する'}
                    </Button>
                  ) : null}

                  {actionsFor(pkg.status).map((spec) => (
                    <Button
                      key={spec.action}
                      size="sm"
                      variant={spec.action === 'publish' || spec.action === 'resume' ? 'default' : 'outline'}
                      disabled={busy !== null}
                      onClick={() => {
                        if (spec.confirm && !window.confirm(spec.confirm)) return
                        act(pkg, () => changeStatus(pkg.key, pkg.version, spec.action), `${pkg.id}-${spec.action}`)
                      }}
                    >
                      {spec.label}
                    </Button>
                  ))}

                </div>

                {/* 届け先。**どこで配るか。**
                    版ではなく鍵に付くので、出し直しても引き継がれる。
                    配布中でなければ、入れても届かないので添えて言う */}
                <div className="w-full border-t pt-3" style={{ borderColor: 'var(--ivory-dark)' }}>
                  <p className="mb-2 text-xs text-muted-foreground">
                    届け先
                    {pkg.status !== 'published'
                      ? '（この荷物はいま配っていないので、入れても届きません）'
                      : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pkg.deliveries.map((d) => (
                      <DeliveryToggle
                        key={d.channel}
                        delivery={d}
                        busy={busy !== null}
                        onToggle={() =>
                          act(pkg, () => setDelivery(pkg.key, d.channel, !d.enabled), `${pkg.id}-${d.channel}`)
                        }
                      />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  )
}

function StatusChip({ status }: { status: StudioPackage['status'] }) {
  const tone = STATUS_TONE[status]
  const style =
    tone === 'active'
      ? { backgroundColor: 'var(--palace)', color: '#fff' }
      : tone === 'paused'
        ? { backgroundColor: 'var(--ivory-dark)', color: '#4A4A4A' }
        : { backgroundColor: 'transparent', color: '#8A8A8A' }

  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
      style={style}
      title={STATUS_NOTE[status]}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

/**
 * 届け先ひとつ。
 *
 * **受け取る側の仕組みがまだ無いものは、そうと言う。**
 * 設定できるのに届かない、を黙って起こさない。
 */
function DeliveryToggle({
  delivery,
  busy,
  onToggle,
}: {
  delivery: Delivery
  busy: boolean
  onToggle: () => void
}) {
  const disabled = busy || delivery.pending

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={delivery.enabled}
      title={delivery.pending ? '受け取る側の仕組みがまだありません' : delivery.note}
      className={`rounded-full border px-3 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
        delivery.enabled ? 'border-[var(--palace)] font-medium' : 'border-border text-muted-foreground'
      }`}
      style={delivery.enabled ? { backgroundColor: 'var(--palace)', color: '#fff' } : undefined}
    >
      {delivery.label}
      {delivery.pending ? '（準備中）' : ''}
    </button>
  )
}
