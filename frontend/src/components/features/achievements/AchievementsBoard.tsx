'use client'

import { useEffect, useState } from 'react'
import { Crown, Lock, Medal, Sparkles, Trophy, Award, Gem } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import {
  getAchievements,
  equipTitle,
  toggleFeatured,
  type AchievementsPage,
  type RewardKind,
  type RewardRow,
  type Rarity,
} from '@/lib/api/achievements'

/**
 * 栄誉の間。
 *
 * 未獲得のものも**名前と条件を出す**。何を目指せるか分からないと目標にならない。
 * ただし持っていないものは色を落とし、鍵を掛けて、持っているものと見分けが付くようにする。
 *
 * 並びは「いまの自分 → もうすぐ取れる → 今日やること → 集めたもの → 積み上げた数字」。
 * 眺めて嬉しくなる順ではなく、**次の行動が決まる順**にしてある。
 */
export function AchievementsBoard() {
  const [page, setPage] = useState<AchievementsPage | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | RewardKind | 'locked'>('all')

  useEffect(() => {
    getAchievements()
      .then(setPage)
      .catch(() => setError(true))
  }, [])

  const act = async (key: string, fn: () => Promise<AchievementsPage>) => {
    setBusy(key)
    try {
      setPage(await fn())
    } catch {
      // 失敗しても画面は壊さない。もう一度押せばよい
    } finally {
      setBusy(null)
    }
  }

  if (error) return <p className="text-sm text-destructive">読み込めませんでした。</p>
  if (!page) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={14} /> 読み込み中…
      </p>
    )
  }

  const rewards = page.rewards.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'locked') return !r.owned
    return r.kind === filter
  })

  return (
    <div className="space-y-8">
      {/* ── いまの自分 ── */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Crown size={20} style={{ color: 'var(--palace)' }} />
            <span className="text-lg font-semibold">{page.summary.title?.name ?? '称号はまだありません'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {page.summary.featured.map((reward) => (
              <RewardIcon key={reward.key} reward={reward} size={26} />
            ))}
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <Stat label="獲得" value={page.summary.rewards_earned} unit="個" />
          <Stat label="達成した実績" value={page.summary.achievements_completed} unit="件" />
          <Stat label="続いている日数" value={page.summary.streak_days} unit="日" />
        </dl>
      </section>

      {/* ── もうすぐ獲得 ── */}
      {page.upcoming.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon={<Sparkles size={18} />}>もうすぐ獲得</SectionTitle>
          <ul className="space-y-2">
            {page.upcoming.map((row) => (
              <li key={row.key} className="space-y-1.5 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    あと {row.remaining} で「{row.rewards[0]?.name ?? row.name}」
                  </span>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {row.progress} / {row.target}
                  </span>
                </div>
                <Bar value={row.progress} max={row.target} />
                {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 進行中のミッション ── */}
      {page.missions.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon={<Trophy size={18} />}>ミッション</SectionTitle>
          <ul className="space-y-2">
            {page.missions.map((mission) => (
              <li
                key={mission.key}
                className={`space-y-1.5 rounded-xl border p-4 ${
                  mission.completed ? 'border-[var(--palace)]/40 bg-card' : 'border-border bg-card'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {mission.cadence_label}
                    </span>
                    <span className={mission.completed ? 'text-muted-foreground line-through' : 'font-medium'}>
                      {mission.name}
                    </span>
                  </span>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {mission.completed ? '達成' : `${mission.progress} / ${mission.target}`}
                  </span>
                </div>
                {!mission.completed && <Bar value={mission.progress} max={mission.target} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 獲得物 ── */}
      <section className="space-y-3">
        <SectionTitle icon={<Medal size={18} />}>獲得物</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'すべて'],
              ['title', '称号'],
              ['medal', '勲章'],
              ['treasure', '褒賞'],
              ['honor', '表彰'],
              ['locked', '未獲得'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                filter === value ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
              style={filter === value ? { backgroundColor: 'var(--palace)' } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rewards.map((reward) => (
            <li
              key={reward.key}
              className={`space-y-2 rounded-xl border p-3 text-center ${
                reward.owned ? 'border-border bg-card' : 'border-dashed border-border/70 bg-card/40'
              }`}
            >
              <div className="flex justify-center">
                <RewardIcon reward={reward} size={34} />
              </div>
              <p className={`text-sm font-medium ${reward.owned ? '' : 'text-muted-foreground'}`}>{reward.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {reward.kind_label}・{RARITY_LABELS[reward.rarity]}
              </p>
              {reward.description && (
                <p className="text-[11px] leading-snug text-muted-foreground">{reward.description}</p>
              )}

              {reward.owned && reward.equippable && (
                <Button
                  variant={reward.equipped ? 'default' : 'outline'}
                  size="sm"
                  disabled={busy === reward.key}
                  onClick={() => act(reward.key, () => equipTitle(reward.equipped ? '' : reward.key))}
                  className="w-full text-xs"
                >
                  {reward.equipped ? '名乗っている' : '名乗る'}
                </Button>
              )}
              {reward.owned && reward.featurable && (
                <Button
                  variant={reward.featured ? 'default' : 'outline'}
                  size="sm"
                  disabled={busy === reward.key}
                  onClick={() => act(reward.key, () => toggleFeatured(reward.key))}
                  className="w-full text-xs"
                >
                  {reward.featured ? '掲げている' : `掲げる（${page.max_featured}個まで）`}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 実績 ── */}
      <section className="space-y-3">
        <SectionTitle icon={<Award size={18} />}>実績</SectionTitle>
        <ul className="space-y-2">
          {page.achievements.map((row) => (
            <li key={row.key} className="space-y-1.5 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={row.completed_at ? 'font-medium' : 'font-medium text-muted-foreground'}>
                  {row.name}
                </span>
                <span className="tabular-nums text-sm text-muted-foreground">
                  {row.completed_at
                    ? `達成（${new Date(row.completed_at).toLocaleDateString('ja-JP')}）`
                    : `${row.progress} / ${row.condition_target}`}
                </span>
              </div>
              {!row.completed_at && <Bar value={row.progress} max={row.condition_target} />}
              {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 記録（石板） ── */}
      <section className="space-y-3">
        <SectionTitle icon={<Gem size={18} />}>記録</SectionTitle>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {page.stats.map((row) => (
            <div
              key={row.key}
              className="rounded-xl border border-border bg-[color-mix(in_srgb,var(--card)_92%,var(--foreground))] p-3 text-center"
            >
              <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {row.value.toLocaleString()}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">{row.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

const RARITY_LABELS: Record<Rarity, string> = {
  common: 'ふつう',
  uncommon: 'やや希少',
  rare: '希少',
  legendary: '伝説',
}

// 種類ごとの絵柄。画像を入れるまではこれで出す（あとから差し替えられる）
const KIND_ICONS: Record<RewardKind, typeof Crown> = {
  title: Crown,
  medal: Medal,
  treasure: Gem,
  honor: Award,
}

function RewardIcon({ reward, size }: { reward: RewardRow; size: number }) {
  if (reward.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={reward.image_url}
        alt={reward.name}
        width={size}
        height={size}
        className={reward.owned ? '' : 'opacity-40 grayscale'}
        loading="lazy"
      />
    )
  }

  const Icon = KIND_ICONS[reward.kind]
  // 未獲得は鍵を重ねる。色を落とすだけだと「まだ読み込み中」に見える
  return (
    <span className="relative inline-flex" style={{ color: reward.owned ? 'var(--palace)' : undefined }}>
      <Icon size={size} className={reward.owned ? '' : 'text-muted-foreground/40'} />
      {!reward.owned && (
        <Lock size={Math.round(size * 0.4)} className="absolute -bottom-0.5 -right-0.5 text-muted-foreground" />
      )}
    </span>
  )
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold">
      <span style={{ color: 'var(--palace)' }}>{icon}</span>
      {children}
    </h2>
  )
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt>{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">
        {value.toLocaleString()}
        {unit}
      </dd>
    </div>
  )
}

function Bar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${ratio * 100}%`, backgroundColor: 'var(--palace)' }}
      />
    </div>
  )
}
