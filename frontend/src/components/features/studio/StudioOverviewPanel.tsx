'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  changeStatus,
  discardPreview,
  fetchStudio,
  previewPackage,
  setDelivery,
  type Delivery,
  type StudioOverview,
  type StudioPackage,
} from '@/lib/api/studio'
import { actionsFor, canPreview, STATUS_LABEL, STATUS_NOTE, STATUS_TONE } from '@/lib/studio/status'

/**
 * 工房室の概要。**いま何を配っているかと、原本の様子。**
 *
 * 荷物ごとにできることを並べる。
 * 戻せない操作（終える）だけ、押す前に確かめる。
 */
export function StudioOverviewPanel() {
  const router = useRouter()
  const [data, setData] = useState<StudioOverview | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchStudio()
      .then(setData)
      .catch(() => setError('工房を開けませんでした'))
  }, [])

  useEffect(load, [load])

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

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">荷物</h2>
          <Button size="sm" onClick={() => router.push('/studio/publish')}>
            新しく作る
          </Button>
        </div>

        {data.packages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            まだ1つもありません。「新しく作る」から、公式宮殿の中身を選んでください
          </p>
        ) : (
          <ul className="space-y-2">
            {data.packages.map((pkg) => (
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
                      onClick={() =>
                        act(
                          pkg,
                          async () => {
                            const result = await previewPackage(pkg.key, pkg.version)
                            if (result.box_id) router.push(`/boxes/${result.box_id}`)
                          },
                          `${pkg.id}-preview`
                        )
                      }
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

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => act(pkg, () => discardPreview(pkg.key, pkg.version), `${pkg.id}-discard`)}
                    title="下見で自分の宮殿に入れたものを片付けます"
                  >
                    下見を片付ける
                  </Button>
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
