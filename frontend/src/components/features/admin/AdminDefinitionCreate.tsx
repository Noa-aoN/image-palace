'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createAdminAchievement,
  createAdminMission,
  createAdminRewardDefinition,
  type AdminRewardsPage,
} from '@/lib/api/admin'
import { useCanOperate } from '@/hooks/useAdminPermissions'
import { ReadOnlyNotice } from '@/components/features/admin/ReadOnlyNotice'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'

/**
 * 定義を新しく作る口。
 *
 * **「作る」と「配る」を混ぜない。** ここで増えるのは「何があるか」であって、
 * 誰かの持ち物ではない。隣の「手で配る」は、既にある獲得物を特定の人へ渡す操作。
 * 同じ画面に並ぶので、見出しと説明文でそこを繰り返し断っている。
 *
 * 鍵（key）は後から変えられない。既に配った持ち物がこの鍵を指すため、
 * 変えると手元にある獲得物の指し先が消える。作るときだけ入力させる。
 */
export const DEFINITION_CREATE_PANEL_KEY = 'admin-definition-create'

type Kind = 'reward' | 'achievement' | 'mission'

const KIND_LABELS: Record<Kind, string> = {
  reward: '獲得物',
  achievement: '実績',
  mission: 'ミッション',
}

const KIND_NOTES: Record<Kind, string> = {
  reward: '配られる品物そのもの。条件は持たない（実績・ミッション側が指す）',
  achievement: '条件を満たすと自動で達成になる。報酬に獲得物やクレジットを指定できる',
  mission: '周期のある課題。日課・週課は、その期間に入ってからの数を見る',
}

export function AdminDefinitionCreate({
  page,
  onCreated,
}: {
  page: AdminRewardsPage
  onCreated: () => void
}) {
  const canWrite = useCanOperate()
  const [kind, setKind] = useState<Kind>('reward')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  // 共通
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [published, setPublished] = useState(true)

  // 獲得物
  const [rewardKind, setRewardKind] = useState(page.kinds[0] ?? 'medal')
  const [rarity, setRarity] = useState(page.rarity_levels[1] ?? 2)
  const [category, setCategory] = useState('')

  // 実績・ミッション
  const [conditionType, setConditionType] = useState(page.condition_types[0]?.value ?? '')
  const [conditionTarget, setConditionTarget] = useState(1)
  const [cadence, setCadence] = useState(page.cadences[0] ?? 'onboarding')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const ready = key.trim() !== '' && name.trim() !== ''

  const reset = () => {
    setKey('')
    setName('')
    setDescription('')
    setCategory('')
    setStartsAt('')
    setEndsAt('')
    setConditionTarget(1)
  }

  const submit = async () => {
    setBusy(true)
    setErrors([])
    setMessage(null)
    try {
      const common = {
        key: key.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        published,
      }

      if (kind === 'reward') {
        await createAdminRewardDefinition({
          ...common,
          kind: rewardKind,
          rarity_level: rarity,
          category: category.trim() || undefined,
        })
      } else if (kind === 'achievement') {
        await createAdminAchievement({
          ...common,
          category: category.trim() || undefined,
          condition_type: conditionType,
          condition_target: conditionTarget,
        })
      } else {
        await createAdminMission({
          ...common,
          cadence,
          condition_type: conditionType,
          condition_target: conditionTarget,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
        })
      }

      setMessage(`「${name}」を作りました。まだ誰にも配られていません。`)
      reset()
      onCreated()
    } catch (e) {
      const detail = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors
      setErrors(detail?.length ? detail : ['作れませんでした'])
    } finally {
      setBusy(false)
    }
  }

  return (
    <PanelSlotContent sectionKey={DEFINITION_CREATE_PANEL_KEY}>
      <div className="space-y-3">
        {!canWrite && <ReadOnlyNotice what="定義を作る操作" />}
        {/* 書き込みの釦はまとめて囲って止める。1つずつ disabled を書くと、
            あとから釦を足したときに付け忘れる */}
        <fieldset disabled={!canWrite} className="contents">
          <p className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
            ここで作るのは<strong>「何があるか」</strong>です。作っただけでは誰の持ち物も増えません。
            特定の人へ渡すときは「手で配る」を使ってください。
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="def-kind">種別</Label>
            <select
              id="def-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              {(Object.keys(KIND_LABELS) as Kind[]).map((value) => (
                <option key={value} value={value}>
                  {KIND_LABELS[value]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{KIND_NOTES[kind]}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="def-key">鍵（key）</Label>
            <Input
              id="def-key"
              value={key}
              placeholder="medal_new_thing"
              onChange={(e) => setKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              英小文字・数字・下線のみ。<strong>後から変えられません</strong>
              （配った持ち物がこの鍵を指すため）
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="def-name">表示名</Label>
            <Input id="def-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="def-description">説明</Label>
            <Input
              id="def-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {kind === 'reward' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="def-reward-kind">品目</Label>
                <select
                  id="def-reward-kind"
                  value={rewardKind}
                  onChange={(e) => setRewardKind(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {page.kinds.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="def-rarity">レア度</Label>
                <select
                  id="def-rarity"
                  value={rarity}
                  onChange={(e) => setRarity(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {page.rarity_levels.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {kind !== 'reward' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="def-condition">条件</Label>
                <select
                  id="def-condition"
                  value={conditionType}
                  onChange={(e) => setConditionType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {page.condition_types.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  ここに無いものは数える手立てがないため選べません
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="def-target">いくつで達成か</Label>
                <Input
                  id="def-target"
                  type="number"
                  min={1}
                  value={conditionTarget}
                  onChange={(e) => setConditionTarget(Math.max(1, Number(e.target.value)))}
                />
              </div>
            </>
          )}

          {kind === 'mission' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="def-cadence">周期</Label>
                <select
                  id="def-cadence"
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {page.cadences.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="def-starts">開始</Label>
                  <Input
                    id="def-starts"
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="def-ends">終了</Label>
                  <Input
                    id="def-ends"
                    type="date"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {(kind === 'achievement' || kind === 'reward') && (
            <div className="space-y-1.5">
              <Label htmlFor="def-category">分類</Label>
              <Input
                id="def-category"
                value={category}
                placeholder={page.categories[0] ?? ''}
                onChange={(e) => setCategory(e.target.value)}
                list="def-category-options"
              />
              <datalist id="def-category-options">
                {page.categories.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            すぐ公開する（外すと、作るだけで見せない）
          </label>

          {errors.length > 0 && (
            <ul className="space-y-0.5 text-sm text-destructive">
              {errors.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
          {message && <p className="text-sm text-emerald-600 dark:text-emerald-500">{message}</p>}

          <Button onClick={submit} disabled={!ready || busy} className="w-full">
            {busy ? '作っています…' : `${KIND_LABELS[kind]}を作る`}
          </Button>
        </fieldset>
      </div>
    </PanelSlotContent>
  )
}

/** 一覧側に置く開き口 */
export function DefinitionCreateButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} className="flex items-center gap-1.5">
      <Plus size={14} />
      新しく作る
    </Button>
  )
}
