'use client'

import { useEffect, useState } from 'react'
import { Crown, Medal, Sparkles, Trophy, Award, Gem, HelpCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import {
  getAchievements,
  equipTitle,
  toggleFeatured,
  type AchievementsPage,
  type RewardKind,
  type RewardPreview,
} from '@/lib/api/achievements'
import { RewardCard, RewardArt } from './RewardCard'
import { RewardDetail } from './RewardDetail'
import { rarityStyle } from './rarity'

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
  // 種別（何を見るか）と、状態（持っているか）は別の軸。混ぜると
  // 「未獲得の勲章だけ」が選べなくなる
  const [kindFilter, setKindFilter] = useState<'all' | RewardKind>('all')
  const [ownFilter, setOwnFilter] = useState<'all' | 'owned' | 'locked'>('all')
  // 押した札の詳細。狭い画面ではホバーが無いので、これが唯一の説明になる
  const [openKey, setOpenKey] = useState<string | null>(null)

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
    if (kindFilter !== 'all' && r.kind !== kindFilter) return false
    if (ownFilter === 'owned') return r.owned
    if (ownFilter === 'locked') return !r.owned
    return true
  })

  // 種別ごとに折り返して並べる。ひと続きにすると、どこから別の種類か分からない
  const KIND_ORDER: RewardKind[] = ['title', 'medal', 'treasure', 'honor']
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    label: page.rewards.find((r) => r.kind === kind)?.kind_label ?? kind,
    rows: rewards.filter((r) => r.kind === kind),
  })).filter((g) => g.rows.length > 0)

  return (
    <div className="space-y-8">
      {/* ── いまの自分 ── */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Crown size={20} style={{ color: 'var(--palace)' }} />
            {page.summary.title ? (
              <span className="text-lg font-semibold">{page.summary.title.name}</span>
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">まだ名乗っていません</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {page.summary.featured.map((reward) => (
              <RewardArt key={reward.key} reward={reward} size={26} />
            ))}
          </div>
        </div>

        {/* 「ありません」で終わらせない。次に何をすれば名乗れるかを出す */}
        {!page.summary.title && page.summary.next_title && (
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
            {page.summary.next_title.condition ?? 'もう少し進める'}と、称号
            <strong className="mx-1">「{page.summary.next_title.name}」</strong>
            を獲得できます
            {page.summary.next_title.remaining > 0 && (
              <span className="ml-1 tabular-nums text-muted-foreground">
                （あと {page.summary.next_title.remaining}）
              </span>
            )}
          </p>
        )}
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
                {/* もうすぐ獲得＝まだ手に入れていない */}
                <RewardPreviews rewards={row.rewards} earned={false} />
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
                {/* 「やること」ではなく「報酬への道」に見せる。何が貰えるか分からないと、やる気にならない */}
                <RewardPreviews rewards={mission.rewards} earned={mission.completed} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 獲得物 ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <SectionTitle icon={<Medal size={18} />}>獲得物</SectionTitle>
          {/* 種別の意味は毎回は要らないが、初めて見る人には要る。開いたときだけ出す */}
          <RewardKindsHelp />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['all', 'すべて'],
              ['title', '称号'],
              ['medal', '勲章'],
              ['treasure', '褒賞'],
              ['honor', '表彰'],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} active={kindFilter === value} onClick={() => setKindFilter(value)}>
              {label}
            </Chip>
          ))}

          {/* 状態は別の軸なので、行の反対側へ寄せる */}
          <div className="ml-auto flex gap-1.5">
            {(
              [
                ['all', 'すべて'],
                ['owned', '獲得済み'],
                ['locked', '未獲得'],
              ] as const
            ).map(([value, label]) => (
              <Chip key={value} active={ownFilter === value} onClick={() => setOwnFilter(value)} subtle>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">ここに出せるものがありません。</p>
        ) : (
          groups.map((group) => (
            <div key={group.kind} className="space-y-2">
              <h3 className="flex items-baseline gap-2 text-sm font-medium">
                {group.label}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {group.rows.filter((r) => r.owned).length} / {group.rows.length}
                </span>
              </h3>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.rows.map((reward) => (
                  <li key={reward.key}>
                    <RewardCard
                      reward={reward}
                      onOpen={() => setOpenKey(reward.key)}
                      onToggleFeatured={() => act(reward.key, () => toggleFeatured(reward.key))}
                      busy={busy === reward.key}
                    >
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
                    </RewardCard>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* ── 実績（分類ごと） ── */}
      <section className="space-y-4">
        <SectionTitle icon={<Award size={18} />}>実績</SectionTitle>
        {/* 分類ごとに分ける。1本の長い列にすると、どこを見ればよいか分からない */}
        {page.categories.map((category) => {
          const rows = page.achievements.filter((a) => (a.category ?? 'その他') === category)
          if (rows.length === 0) return null

          const done = rows.filter((r) => r.completed_at).length
          return (
            <div key={category} className="space-y-2">
              <h3 className="flex items-baseline gap-2 text-sm font-medium">
                {category}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {done} / {rows.length}
                </span>
              </h3>
              <ul className="space-y-2">
                {rows.map((row) => (
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
                    <RewardPreviews rewards={row.rewards} earned={Boolean(row.completed_at)} />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      {/* 押した札の詳細。狭い画面ではホバーが無いので、ここが唯一の説明になる */}
      {openKey && (() => {
        const reward = page.rewards.find((r) => r.key === openKey)
        if (!reward) return null
        return (
          <RewardDetail
            reward={reward}
            busy={busy === reward.key}
            onClose={() => setOpenKey(null)}
            onEquip={() => act(reward.key, () => equipTitle(reward.equipped ? '' : reward.key))}
            onFeature={() => act(reward.key, () => toggleFeatured(reward.key))}
          />
        )
      })()}

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

/**
 * 報酬の下見。何が貰えるか分からないと「やってみよう」と思えない。
 *
 * まだ手に入れていないものは色を落とす。**取りに行く場所**なので、
 * 色が付いていると既に持っているように見える。
 *
 * 行の右端へ寄せる。名前や進捗は左から読むもので、報酬は「その先にあるもの」。
 * 同じ列に混ぜると、どこまでが条件でどこからが報酬なのか分からなくなる。
 */
function RewardPreviews({ rewards, earned }: { rewards: RewardPreview[]; earned: boolean }) {
  if (rewards.length === 0) return null

  return (
    <ul className="flex flex-wrap items-center justify-end gap-1.5 pt-0.5">
      {rewards.map((reward, index) => (
        <li key={reward.key ?? `credits-${index}`}>
          {reward.type === 'credits' ? (
            <span
              className={`rounded-full bg-muted/60 px-2 py-0.5 text-[11px] ${
                earned ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {reward.amount} cr
            </span>
          ) : (
            <span
              className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
              title={`${reward.name}（${reward.kind_label}）`}
            >
              {reward.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reward.image_url}
                  alt=""
                  width={16}
                  height={16}
                  loading="lazy"
                  className={earned ? '' : 'opacity-45 grayscale'}
                />
              ) : null}
              <span className={earned ? rarityStyle(reward.rarity_tier).text : undefined}>{reward.name}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
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

function Chip({
  active,
  onClick,
  subtle,
  children,
}: {
  active: boolean
  onClick: () => void
  /** 副軸（状態）はやや控えめに。主軸（種別）と同じ強さだと、どちらが主か分からない */
  subtle?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? subtle
            ? 'border-[var(--palace)] text-[var(--palace)]'
            : 'border-transparent text-white'
          : 'border-border text-muted-foreground hover:bg-muted'
      }`}
      style={active && !subtle ? { backgroundColor: 'var(--palace)' } : undefined}
    >
      {children}
    </button>
  )
}

/**
 * 種別の意味。
 *
 * 称号・勲章・褒賞・表彰は似ているが役割が違う。毎回説明を並べると邪魔なので、
 * 押したときだけ右パネルで出す。今後、種類が増えてもここに足せる。
 */
function RewardKindsHelp() {
  const panel = usePanelForm(REWARD_KINDS_PANEL_KEY, '獲得物の種類')

  return (
    <>
      <button
        type="button"
        onClick={panel.open}
        aria-expanded={panel.isOpen}
        aria-label="獲得物の種類について"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <HelpCircle size={16} />
      </button>

      <PanelSlotContent sectionKey={REWARD_KINDS_PANEL_KEY}>
        <dl className="space-y-4 text-sm">
          {KIND_HELP.map((entry) => (
            <div key={entry.label} className="space-y-1">
              <dt className="flex items-center gap-2 font-medium">
                <span style={{ color: 'var(--palace)' }}>{entry.icon}</span>
                {entry.label}
                <span className="text-xs text-muted-foreground">{entry.verb}</span>
              </dt>
              <dd className="text-muted-foreground">{entry.description}</dd>
            </div>
          ))}
          <div className="space-y-1 border-t border-border pt-3">
            <dt className="font-medium">レア度</dt>
            <dd className="text-muted-foreground">印の数が多いほど希少です（1〜9）。色も段ごとに変わります。</dd>
          </div>
        </dl>
      </PanelSlotContent>
    </>
  )
}

const REWARD_KINDS_PANEL_KEY = 'achievement-reward-kinds'

const KIND_HELP = [
  {
    label: '称号',
    verb: '名乗るもの',
    icon: <Crown size={16} />,
    description: '1つだけ選んで名乗れます。エントランスの「宮殿の主人」にも出ます。',
  },
  {
    label: '勲章',
    verb: '掲げるもの',
    icon: <Medal size={16} />,
    description: '功績のしるし。いくつか選んで並べて掲げられます。',
  },
  {
    label: '褒賞',
    verb: '飾るもの',
    icon: <Gem size={16} />,
    description: '手に入れた品。マイルームに飾れるようにする準備をしています。',
  },
  {
    label: '表彰',
    verb: '選ばれたこと',
    icon: <Award size={16} />,
    description: '運営が選んで贈るもの。条件では手に入りません。',
  },
]
