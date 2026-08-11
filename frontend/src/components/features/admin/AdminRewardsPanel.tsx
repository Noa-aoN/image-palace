'use client'

import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminRewardGrant } from './AdminRewardGrant'
import {
  getAdminRewards,
  updateAdminAchievement,
  updateAdminMission,
  updateAdminRewardDefinition,
  type AdminRewardsPage,
} from '@/lib/api/admin'
import { useCanOperate } from '@/hooks/useAdminPermissions'
import { ReadOnlyNotice } from '@/components/features/admin/ReadOnlyNotice'

type Tab = 'rewards' | 'achievements' | 'missions'

const TABS: { value: Tab; label: string; note: string }[] = [
  { value: 'rewards', label: '獲得物', note: '何を配るか。名前・レア度・公開' },
  { value: 'achievements', label: '実績', note: '一度きりの到達点。条件と報酬' },
  { value: 'missions', label: 'ミッション', note: '繰り返すもの・期間限定' },
]

/**
 * 獲得物・実績・ミッションの管理。
 *
 * 3つは別の表だが、運営から見ると「何を配るか」という1つの話なので1つの面にまとめる。
 * 画面を分けると、実績を足したのに獲得物を足し忘れる、といった片手落ちが起きる。
 *
 * ここで変えられるのは**量と見せ方**（レア度・条件の数・公開・期間）だけにする。
 * 条件の種類そのものはコード側の登録簿が持つ（数え方を画面から作れてしまうと、
 * 数えられない条件を保存できてしまう）。
 */
export function AdminRewardsPanel() {
  const canWrite = useCanOperate()
  const [page, setPage] = useState<AdminRewardsPage | null>(null)
  const [tab, setTab] = useState<Tab>('rewards')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    getAdminRewards()
      .then(setPage)
      .catch(() => setError('読み込めませんでした'))
  }, [])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!page) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={14} />
        読み込み中…
      </p>
    )
  }

  const conditionLabel = (type: string) =>
    page.condition_types.find((c) => c.value === type)?.label ?? type

  const saveReward = async (id: string, patch: Parameters<typeof updateAdminRewardDefinition>[1]) => {
    setBusy(id)
    try {
      const next = await updateAdminRewardDefinition(id, patch)
      setPage({ ...page, rewards: page.rewards.map((r) => (r.id === id ? next : r)) })
    } catch {
      setError('保存できませんでした')
    } finally {
      setBusy(null)
    }
  }

  const saveAchievement = async (id: string, patch: Parameters<typeof updateAdminAchievement>[1]) => {
    setBusy(id)
    try {
      const next = await updateAdminAchievement(id, patch)
      setPage({ ...page, achievements: page.achievements.map((a) => (a.id === id ? next : a)) })
    } catch {
      setError('保存できませんでした')
    } finally {
      setBusy(null)
    }
  }

  const saveMission = async (id: string, patch: Parameters<typeof updateAdminMission>[1]) => {
    setBusy(id)
    try {
      const next = await updateAdminMission(id, patch)
      setPage({ ...page, missions: page.missions.map((m) => (m.id === id ? next : m)) })
    } catch {
      setError('保存できませんでした')
    } finally {
      setBusy(null)
    }
  }

  const seriesName = (id: string | null) => page.series.find((s) => s.id === id)?.name

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">獲得物・実績・ミッション</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {TABS.find((t) => t.value === tab)?.note}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={tab === t.value ? 'default' : 'outline'}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {!canWrite && <ReadOnlyNotice what="公開の切り替えと手で配る操作" />}

      {/* 切替（タブ）は止めない。見るだけの人も行き来できるようにする。
          止めるのは書き込みだけ。1つずつ disabled を書くと、
          あとから釦を足したときに付け忘れる */}
      <fieldset disabled={!canWrite} className="contents">

      {tab === 'rewards' && (
        <Table head={['獲得物', '種別', 'レア度', '持っている人', '公開']}>
          {page.rewards.map((reward) => (
            <tr key={reward.id} className="border-t border-border">
              <Td>
                <span className="font-medium">{reward.name}</span>
                <span className="block text-xs text-muted-foreground">{reward.key}</span>
              </Td>
              <Td>{reward.kind_label}</Td>
              <Td>
                <select
                  value={reward.rarity_level}
                  disabled={busy === reward.id}
                  onChange={(e) => saveReward(reward.id, { rarity_level: Number(e.target.value) })}
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                >
                  {page.rarity_levels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </Td>
              <Td className="tabular-nums">{reward.owned_count}</Td>
              <Td>
                <Toggle
                  on={reward.published}
                  busy={busy === reward.id}
                  onChange={(published) => saveReward(reward.id, { published })}
                />
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === 'achievements' && (
        <Table head={['実績', '条件', '達成した人', '有効', '公開']}>
          {page.achievements.map((achievement) => (
            <tr key={achievement.id} className="border-t border-border">
              <Td>
                <span className="font-medium">{achievement.name}</span>
                <span className="block text-xs text-muted-foreground">{achievement.category ?? '—'}</span>
              </Td>
              <Td>
                <span className="text-xs text-muted-foreground">
                  {conditionLabel(achievement.condition_type)}
                </span>
                <NumberField
                  value={achievement.condition_target}
                  busy={busy === achievement.id}
                  onSave={(condition_target) => saveAchievement(achievement.id, { condition_target })}
                />
              </Td>
              <Td className="tabular-nums">{achievement.completed_count}</Td>
              <Td>
                <Toggle
                  on={achievement.enabled}
                  busy={busy === achievement.id}
                  onChange={(enabled) => saveAchievement(achievement.id, { enabled })}
                />
              </Td>
              <Td>
                <Toggle
                  on={achievement.published}
                  busy={busy === achievement.id}
                  onChange={(published) => saveAchievement(achievement.id, { published })}
                />
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === 'missions' && (
        <Table head={['ミッション', '区分', '条件', '期間', '有効']}>
          {page.missions.map((mission) => (
            <tr key={mission.id} className="border-t border-border">
              <Td>
                <span className="font-medium">{mission.name}</span>
                {mission.mission_series_id && (
                  <span className="block text-xs" style={{ color: 'var(--palace)' }}>
                    {seriesName(mission.mission_series_id)} 第{mission.series_step}段
                  </span>
                )}
              </Td>
              <Td>
                <select
                  value={mission.cadence}
                  disabled={busy === mission.id}
                  onChange={(e) => saveMission(mission.id, { cadence: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                >
                  {page.cadences.map((cadence) => (
                    <option key={cadence} value={cadence}>
                      {cadence}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>
                <span className="text-xs text-muted-foreground">{conditionLabel(mission.condition_type)}</span>
                <NumberField
                  value={mission.condition_target}
                  busy={busy === mission.id}
                  onSave={(condition_target) => saveMission(mission.id, { condition_target })}
                />
              </Td>
              <Td className="text-xs text-muted-foreground">
                {mission.starts_at || mission.ends_at ? (
                  <>
                    {mission.starts_at ? new Date(mission.starts_at).toLocaleDateString('ja-JP') : '—'}
                    {' 〜 '}
                    {mission.ends_at ? new Date(mission.ends_at).toLocaleDateString('ja-JP') : '—'}
                  </>
                ) : (
                  '常時'
                )}
              </Td>
              <Td>
                <Toggle
                  on={mission.enabled}
                  busy={busy === mission.id}
                  onChange={(enabled) => saveMission(mission.id, { enabled })}
                />
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <AdminRewardGrant rewards={page.rewards} />

      {/* 期間が終わったら消さずに「無効」にする。消すと user_missions の履歴が浮く */}
      <p className="text-xs text-muted-foreground">
        期間限定を終えるときは、定義を消さずに「有効」を外してください。消すと、達成した記録の行き先が無くなります。
      </p>
      </fieldset>
    </section>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>
}

function Toggle({
  on,
  busy,
  onChange,
}: {
  on: boolean
  busy: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onChange(!on)}
      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-50 ${
        on ? 'border-[var(--palace)] text-[var(--palace)]' : 'border-border text-muted-foreground'
      }`}
    >
      {on ? 'オン' : 'オフ'}
    </button>
  )
}

/** 数だけを直す欄。押すまで保存しない（打っている途中で保存すると、途中の数で保存される） */
function NumberField({
  value,
  busy,
  onSave,
}: {
  value: number
  busy: boolean
  onSave: (next: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const changed = draft !== String(value)

  return (
    <span className="mt-0.5 flex items-center gap-1.5">
      <Input
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        className="h-7 w-24 text-sm"
      />
      {changed && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !/^\d+$/.test(draft) || Number(draft) < 1}
          onClick={() => onSave(Number(draft))}
          className="h-7 px-2 text-xs"
        >
          保存
        </Button>
      )}
    </span>
  )
}
