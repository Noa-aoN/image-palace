'use client'

import { useCallback, useEffect, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { AdminRewardGrant } from './AdminRewardGrant'
import {
  getAdminRewards,
  updateAdminAchievement,
  updateAdminMission,
  updateAdminRewardDefinition,
  type AdminRewardsPage,
} from '@/lib/api/admin'
import { Gift, Pencil } from 'lucide-react'
import { useRightPanelStore } from '@/stores/rightPanel'
import {
  groupByOrder,
  groupAchievements,
  REWARD_KIND_ORDER,
  REWARD_KIND_LABELS,
  MISSION_CADENCE_ORDER,
  MISSION_CADENCE_LABELS,
} from '@/lib/admin-rewards-grouping'
import {
  AdminRewardEditPanel,
  REWARD_EDIT_PANEL_KEY,
  type EditTarget,
} from '@/components/features/admin/AdminRewardEditPanel'
import { REWARD_GRANT_PANEL_KEY } from '@/components/features/admin/AdminRewardGrant'
import {
  AdminDefinitionCreate,
  DEFINITION_CREATE_PANEL_KEY,
  DefinitionCreateButton,
} from '@/components/features/admin/AdminDefinitionCreate'
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
  // いま直しているもの。一覧は見る場所、右パネルが直す場所
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const openSection = useRightPanelStore((s) => s.openSection)

  const openEdit = (target: EditTarget) => {
    setEditing(target)
    openSection({ key: REWARD_EDIT_PANEL_KEY, title: '編集' })
  }

  // 作った直後に一覧へ載せたいので、読み込みを名前付きにして呼び直せるようにする
  const load = useCallback(
    () =>
      getAdminRewards()
        .then(setPage)
        .catch(() => setError('読み込めませんでした')),
    []
  )

  useEffect(() => {
    load()
  }, [load])

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

      {tab === 'rewards' &&
        groupByOrder(page.rewards, (r) => r.kind, REWARD_KIND_ORDER, REWARD_KIND_LABELS).map((group) => (
          <Group key={group.key} label={group.label} count={group.rows.length}>
            {group.rows.map((reward) => (
              <Row key={reward.id} onOpen={() => openEdit({ type: 'reward', row: reward })}>
                <RowMain name={reward.name} sub={reward.key} />
                <RowMeta>
                  <span>{reward.rarity_tier}</span>
                  <span className="tabular-nums">{reward.owned_count} 人</span>
                  <PublishedMark on={reward.published} />
                </RowMeta>
              </Row>
            ))}
          </Group>
        ))}

      {tab === 'achievements' &&
        groupAchievements(page.achievements).map((group) => (
          <Group key={group.key} label={group.label} count={group.rows.length}>
            {group.rows.map((achievement) => (
              <Row key={achievement.id} onOpen={() => openEdit({ type: 'achievement', row: achievement })}>
                <RowMain name={achievement.name} sub={`${conditionLabel(achievement.condition_type)} ${achievement.condition_target}`} />
                <RowMeta>
                  <span className="tabular-nums">{achievement.completed_count} 人</span>
                  {!achievement.enabled && <span className="text-muted-foreground">無効</span>}
                  <PublishedMark on={achievement.published} />
                </RowMeta>
              </Row>
            ))}
          </Group>
        ))}

      {tab === 'missions' &&
        groupByOrder(page.missions, (m) => m.cadence, MISSION_CADENCE_ORDER, MISSION_CADENCE_LABELS).map((group) => (
          <Group key={group.key} label={group.label} count={group.rows.length}>
            {group.rows.map((mission) => (
              <Row key={mission.id} onOpen={() => openEdit({ type: 'mission', row: mission })}>
                <RowMain
                  name={mission.name}
                  sub={`${conditionLabel(mission.condition_type)} ${mission.condition_target}`}
                  note={
                    mission.mission_series_id
                      ? `${seriesName(mission.mission_series_id)} 第${mission.series_step}段`
                      : undefined
                  }
                />
                <RowMeta>
                  {(mission.starts_at || mission.ends_at) && (
                    <span>
                      {mission.starts_at ? new Date(mission.starts_at).toLocaleDateString('ja-JP') : '—'}
                      {' 〜 '}
                      {mission.ends_at ? new Date(mission.ends_at).toLocaleDateString('ja-JP') : '—'}
                    </span>
                  )}
                  {!mission.enabled && <span className="text-muted-foreground">無効</span>}
                  <PublishedMark on={mission.published} />
                </RowMeta>
              </Row>
            ))}
          </Group>
        ))}

      {/* 常に画面の下に開いていると、見に来ただけの人にも配る操作が見えている。
          必要なときだけ開く */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => openSection({ key: REWARD_GRANT_PANEL_KEY, title: '手で配る' })}
          className="flex items-center gap-1.5"
        >
          <Gift size={14} />
          手で配る
        </Button>
        {/* 「配る」の隣に「作る」を置く。**別の操作**なので、
            開くパネルも文言も分けてある（作っただけでは誰の持ち物も増えない） */}
        <DefinitionCreateButton
          onClick={() => openSection({ key: DEFINITION_CREATE_PANEL_KEY, title: '新しく作る' })}
        />
      </div>

      <AdminRewardGrant rewards={page.rewards} />
      <AdminDefinitionCreate page={page} onCreated={load} />
      <AdminRewardEditPanel
        target={editing}
        series={page.series}
        busy={busy !== null}
        onSaveReward={saveReward}
        onSaveAchievement={saveAchievement}
        onSaveMission={saveMission}
        onRewardImageChanged={(reward) =>
          setPage((current) =>
            current
              ? { ...current, rewards: current.rewards.map((r) => (r.id === reward.id ? reward : r)) }
              : current
          )
        }
      />

      {/* 期間が終わったら消さずに「無効」にする。消すと user_missions の履歴が浮く */}
      <p className="text-xs text-muted-foreground">
        期間限定を終えるときは、定義を消さずに「有効」を外してください。消すと、達成した記録の行き先が無くなります。
      </p>
      </fieldset>
    </section>
  )
}

/**
 * 種別ごとの束。見出し＋余白＋薄い線で切る。
 * 二重線まで引くと、管理画面のわりに飾りが強くなる
 */
function Group({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-1 pt-2">
      <div className="flex items-baseline gap-2 border-b border-border/70 pb-1">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <ul className="divide-y divide-border/60">{children}</ul>
    </div>
  )
}

/** 1件。行ごと押せる（どこを押しても開く。小さな鉛筆を狙わせない） */
function Row({ onOpen, children }: { onOpen: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 py-2 text-left transition-colors hover:bg-muted/50"
      >
        {children}
        <Pencil size={13} className="shrink-0 text-muted-foreground" />
      </button>
    </li>
  )
}

function RowMain({ name, sub, note }: { name: string; sub?: string; note?: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{name}</span>
      {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      {note && (
        <span className="block truncate text-xs" style={{ color: 'var(--palace)' }}>
          {note}
        </span>
      )}
    </span>
  )
}

function RowMeta({ children }: { children: React.ReactNode }) {
  return <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">{children}</span>
}

/** 公開しているかは、切り替えではなく状態として見せる（切り替えは右パネルで） */
function PublishedMark({ on }: { on: boolean }) {
  return on ? (
    <span className="text-muted-foreground">公開</span>
  ) : (
    <span className="rounded bg-muted px-1.5 py-0.5">非公開</span>
  )
}
