'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  changeStatus,
  setDelivery,
  type Delivery,
  type PackageHistory,
  type StudioPackage,
} from '@/lib/api/studio'
import {
  actionsFor,
  canPreview,
  countByStatus,
  deliveryNoteFor,
  filterPackages,
  PACKAGE_FILTERS,
  STATUS_LABEL,
  STATUS_NOTE,
  STATUS_TONE,
  type PackageFilter,
} from '@/lib/studio/status'
import { deliveriesFor, ROOM_NOUN, type StudioRoom } from '@/lib/studio/channels'
import { QuickLookDialog } from './QuickLookDialog'

/**
 * 荷物の一覧。**部屋ごとに、触れる栓だけを出す。**
 *
 * 体験宮殿の部屋では「体験の宮殿に置く」だけ、
 * 配布の部屋では残りの届け先だけ。
 *
 * 同じ荷物が両方に出ることはあるが、重複ではない。
 * **部屋ごとに答えている問いが違う**（置くか / 配るか）。
 *
 * 扱いを変える操作（出す・止める・終える）は荷物そのものの話なので、
 * どちらの部屋からも同じように押せる。
 */
export function StudioPackageList({
  room,
  packages,
  busy,
  onAct,
  onPreview,
}: {
  room: StudioRoom
  packages: StudioPackage[]
  busy: string | null
  onAct: (fn: () => Promise<unknown>, key: string) => void
  onPreview: (pkg: StudioPackage) => void
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<PackageFilter>('all')
  // さっと見る。**何も作らないので、宮殿は汚れない**
  const [looking, setLooking] = useState<StudioPackage | null>(null)

  const counts = useMemo(() => countByStatus(packages), [packages])
  const shown = useMemo(() => filterPackages(packages, filter), [packages, filter])
  const noun = ROOM_NOUN[room]

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{noun}</h2>
        <Button size="sm" onClick={() => router.push('/studio/publish')}>
          新しく作る
        </Button>
      </div>

      {/* 扱いで絞る。**大きな検索は要らない。** 数が見えれば、どこを見ればよいか分かる */}
      {packages.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {PACKAGE_FILTERS.map((f) => {
            const n = f.value === 'all' ? packages.length : counts[f.value]
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

      {packages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          まだ1つもありません。「新しく作る」から、公式宮殿の中身を選んでください
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          あてはまる{noun}がありません
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
                {/* **まず「さっと見る」を置く。** 見た目だけ確かめたいことのほうが多く、
                    そちらは何も作らないので宮殿が汚れない */}
                <Button size="sm" variant="outline" onClick={() => setLooking(pkg)}>
                  さっと見る
                </Button>

                {canPreview(pkg.status) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => onPreview(pkg)}
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
                      onAct(
                        () => changeStatus(pkg.key, pkg.version, spec.action),
                        `${pkg.id}-${spec.action}`
                      )
                    }}
                  >
                    {spec.label}
                  </Button>
                ))}
              </div>

              {/* 届け先。**この部屋の栓だけ。**
                  版ではなく鍵に付くので、出し直しても引き継がれる。
                  いま実際に何が届くのかは版で変わるので、ずれていたら添えて言う */}
              <div className="w-full border-t pt-3" style={{ borderColor: 'var(--ivory-dark)' }}>
                <p className="mb-2 text-xs text-muted-foreground">
                  {room === 'demo' ? '体験の宮殿' : '届け先'}
                  {deliveryNoteFor(pkg) ? `（${deliveryNoteFor(pkg)}）` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {deliveriesFor(pkg, room).map((d) => (
                    <DeliveryToggle
                      key={d.channel}
                      delivery={d}
                      busy={busy !== null}
                      onToggle={() =>
                        onAct(
                          () => setDelivery(pkg.key, d.channel, !d.enabled),
                          `${pkg.id}-${d.channel}`
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              {pkg.history.length > 0 ? <History versions={pkg.history} /> : null}
            </li>
          ))}
        </ul>
      )}

      {looking ? (
        <QuickLookDialog
          packageKey={looking.key}
          version={looking.version}
          onClose={() => setLooking(null)}
          onPreview={() => onPreview(looking)}
        />
      ) : null}
    </section>
  )
}

/**
 * 前の版。**畳んでおく。**
 *
 * 出し直しても記録として残る（何を配っていたのかを後から辿れるように）。
 * ここから押せることは無い
 */
function History({ versions }: { versions: PackageHistory[] }) {
  return (
    <details className="w-full">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        前の版 {versions.length} 件
      </summary>
      <ul className="mt-2 space-y-1">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">v{v.version}</span>
            <span>{STATUS_LABEL[v.status]}</span>
            {v.installs > 0 ? <span>{v.installs} 人が受け取り済み</span> : null}
          </li>
        ))}
      </ul>
    </details>
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
