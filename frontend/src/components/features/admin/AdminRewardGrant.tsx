'use client'

import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAdminUsers, grantAdminReward, type AdminRewardDefinition } from '@/lib/api/admin'
import type { AdminUser } from '@/types/admin'
import { useCanOperate } from '@/hooks/useAdminPermissions'
import { ReadOnlyNotice } from '@/components/features/admin/ReadOnlyNotice'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { isSubmitEnter } from '@/lib/enter-key'

/**
 * 手で配る。表彰など、条件では表せないものに使う。
 *
 * **重要操作**として扱う。
 *   - 相手は探して選ぶ（id を打たせない。打ち間違えると別の人に配ってしまう）
 *   - 理由は必須（サーバー側でも空を弾く）
 *   - 押す前に「誰に・何を」を読み上げる形で確かめる
 *
 * 誰に・何を・いつ・なぜ、が揃って初めて記録として使える。
 * あとから見て理由の分からない付与は、調べようがない。
 */
/**
 * 手で配る口。
 *
 * 常に画面の下に開いていると、見に来ただけの人にも配る操作が見えている。
 * 必要なときだけ右パネルで開く
 */
export const REWARD_GRANT_PANEL_KEY = 'admin-reward-grant'

export function AdminRewardGrant({ rewards }: { rewards: AdminRewardDefinition[] }) {
  const canWrite = useCanOperate()
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<AdminUser[] | null>(null)
  const [target, setTarget] = useState<AdminUser | null>(null)
  const [rewardKey, setRewardKey] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  // いま進めている配布を指す鍵。押し直しのときに作り直さないため、状態として持つ。
  // **運営には見せない**（意識させるものではない）
  const [eventKey, setEventKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reward = rewards.find((r) => r.key === rewardKey)
  const ready = Boolean(target && reward && reason.trim())

  const search = async () => {
    if (!query.trim()) return
    setBusy(true)
    setError(null)
    try {
      const page = await getAdminUsers({ q: query.trim() })
      setCandidates(page.users)
    } catch {
      setError('探せませんでした')
    } finally {
      setBusy(false)
    }
  }

  const grant = async () => {
    if (!target || !reward) return
    setBusy(true)
    setError(null)
    setMessage(null)

    // この1回の配布を指す鍵。**失敗して押し直しても同じ値を使う**ので、
    // 二重に配られない。成功したら捨てて、次は別の配布として扱う
    const key = eventKey ?? `admin:grant:${crypto.randomUUID()}`
    setEventKey(key)

    try {
      const result = await grantAdminReward({
        user_id: target.id,
        reward_key: reward.key,
        reason: reason.trim(),
        event_key: key,
      })
      setMessage(
        result.granted
          ? `${target.email} に「${reward.name}」を配りました。`
          : `${target.email} には、この配布ぶんが既に届いています。`
      )
      setReason('')
      setEventKey(null) // 次は別の配布
    } catch {
      setError('配れませんでした。もう一度押しても、二重には配られません。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PanelSlotContent sectionKey={REWARD_GRANT_PANEL_KEY}>
      <div className="space-y-3">
      {!canWrite && <ReadOnlyNotice what="手で配る操作" />}
      {/* 書き込みの釦はまとめて囲って止める。1つずつ disabled を書くと、
          あとから釦を足したときに付け忘れる（付け忘れると押せてしまう） */}
      <fieldset disabled={!canWrite} className="contents">

      <div className="space-y-1.5">
        <Label htmlFor="grant-user">相手を探す</Label>
        <div className="flex gap-2">
          <Input
            id="grant-user"
            value={query}
            placeholder="メールアドレス・表示名"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (isSubmitEnter(e)) search()
            }}
          />
          <Button variant="outline" onClick={search} disabled={busy || !query.trim()}>
            探す
          </Button>
        </div>
      </div>

      {candidates && candidates.length === 0 && (
        <p className="text-sm text-muted-foreground">見つかりませんでした。</p>
      )}

      {candidates && candidates.length > 0 && (
        <ul className="space-y-1">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => {
                  setTarget(candidate)
                  // 相手を変えたら別の配布。前の鍵は捨てる
                  setEventKey(null)
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  target?.id === candidate.id
                    ? 'border-[var(--palace)] bg-muted/50'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                {candidate.email}
                {candidate.name && <span className="ml-2 text-muted-foreground">{candidate.name}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="grant-reward">配るもの</Label>
        <select
          id="grant-reward"
          value={rewardKey}
          onChange={(e) => {
            setRewardKey(e.target.value)
            // 配るものを変えたら別の配布。前の鍵は捨てる
            setEventKey(null)
          }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">選んでください</option>
          {rewards.map((r) => (
            <option key={r.key} value={r.key}>
              {r.kind_label}／{r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="grant-reason">理由（必須）</Label>
        <Input
          id="grant-reason"
          value={reason}
          placeholder="不具合のお詫び / 表彰 など"
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          誰に・何を・いつ・なぜ を監査ログに残します。あとから理由の分からない付与は調べようがありません。
        </p>
      </div>

      {/* 押す前に「誰に・何を」を読み上げる。選び間違いは、配ったあとでは戻せない */}
      {ready && (
        <p className="flex items-start gap-2 rounded-lg border border-[var(--palace)]/40 bg-[var(--palace)]/5 px-3 py-2 text-sm">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--palace)' }} />
          <span>
            <strong>{target?.email}</strong> に「<strong>{reward?.name}</strong>」を配ります。
          </span>
        </p>
      )}

      <Button onClick={grant} disabled={!ready || busy}>
        {busy ? '配っています…' : '配る'}
      </Button>

      {message && <p className="text-sm" style={{ color: 'var(--palace)' }}>{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      </fieldset>
      </div>
    </PanelSlotContent>
  )
}
