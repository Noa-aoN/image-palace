'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Box as BoxIcon, LayoutGrid, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { addViewItems, createView, getViews } from '@/lib/api/views'
import { addItemsToBox, createBox, getBoxes } from '@/lib/api/boxes'
import {
  IMPLEMENTED_VIEW_TYPES,
  VIEW_TYPES,
  VIEW_TYPE_DESCRIPTIONS,
  VIEW_TYPE_LABELS,
} from '@/lib/view-types'
import { BOX_KIND, defaultBulkName } from '@/lib/items/bulk-use'
import type { Item } from '@/types/item'

export const BULK_USE_PANEL_KEY = 'items-bulk-use'

/**
 * 行き先の系統。**入口をここで分ける。**
 *
 * ひとつの並びにキャンバスの種別とボックスを混ぜていたが、
 * この2つは選ぶ場面が違う（並べて考えるのか、まとめて持ち歩くのか）。
 * ドロップダウンで先に選ばせて、パネルは片方だけを扱う。
 */
export type BulkUseFamily = 'canvas' | 'box'

/** 足せる先。キャンバスとボックスを1つの並びとして扱う */
type Target = { id: string; name: string; kind: string; isBox: boolean }

/**
 * 選んだカードを、キャンバスやボックスで使う。
 *
 * カードを作ったあと「で、これをどう使うのか」が地続きでなかった。
 * 一覧で選んだところから、そのまま置き場所へ渡せるようにする。
 *
 * **新しく作るのと、いまあるものへ足すのを、同じ場所に置く。**
 * 集めたカードの行き先は、たいてい既にある。作る道しか無いと、
 * 「デッキ2」「デッキ3」が増えていくことになる。
 *
 * **カードは作成・追加と同時に渡す。** 1枚ずつ入れると 50 枚で 50 往復になる。
 * この製品の遅さは往復の本数で決まる。
 *
 * **準備中の種別も灰色で見せる。** 消すと「無い」と読まれる。
 * あることは見せて、いまは選べないことだけを伝える。
 */
export function BulkUsePanel({
  family,
  selected,
  onCreated,
  onClose,
}: {
  family: BulkUseFamily
  selected: Item[]
  /** 渡し終えたとき。呼び出し側が選択を解く */
  onCreated: () => void
  onClose: () => void
}) {
  const router = useRouter()
  const isBoxFamily = family === 'box'
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [kind, setKind] = useState<string>(isBoxFamily ? BOX_KIND : 'deck')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ids = selected.map((item) => item.id)
  // 空間配置は点を選ばないと置けない。ここからは作らせず、
  // 「スペースから作る」へ促すほうが迷わない
  const choices = VIEW_TYPES.filter((t) => t !== 'space_map')

  // 足せる先。**開いてから読む**（一覧を見ているだけの人に往復させない）
  const [targets, setTargets] = useState<Target[] | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)

  // 系統ごとに、その系統のものだけを読む（箱を探しているときに板は要らない）
  useEffect(() => {
    if (mode !== 'existing' || targets !== null) return
    let alive = true
    void (async () => {
      try {
        if (isBoxFamily) {
          const boxes = await getBoxes(100)
          if (alive) setTargets(boxes.map((b) => ({ id: b.id, name: b.name, kind: BOX_KIND, isBox: true })))
          return
        }
        const views = await getViews(100)
        if (!alive) return
        setTargets(
          views
            .filter((v) => v.view_type !== 'space_map')
            .map((v) => ({ id: v.id, name: v.name, kind: v.view_type, isBox: false }))
        )
      } catch {
        if (alive) setError('入れ先を読めませんでした。時間を置いてお試しください。')
      }
    })()
    return () => {
      alive = false
    }
  }, [mode, targets, isBoxFamily])

  const create = async () => {
    const label = name.trim() || defaultBulkName(kind, selected.map((i) => i.title))
    setBusy(true)
    setError(null)
    try {
      if (kind === BOX_KIND) {
        const box = await createBox(label, undefined, ids)
        onCreated()
        router.push(`/boxes/${box.id}`)
        return
      }
      const view = await createView(label, kind, undefined, ids)
      onCreated()
      router.push(`/views/${view.id}`)
    } catch {
      setError('作れませんでした。時間を置いてお試しください。')
      setBusy(false)
    }
  }

  const addToExisting = async () => {
    const target = targets?.find((t) => t.id === targetId)
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      if (target.isBox) await addItemsToBox(target.id, ids)
      else await addViewItems(target.id, ids)
      onCreated()
      router.push(target.isBox ? `/boxes/${target.id}` : `/views/${target.id}`)
    } catch {
      setError('足せませんでした。時間を置いてお試しください。')
      setBusy(false)
    }
  }

  return (
    <PanelSlotContent sectionKey={BULK_USE_PANEL_KEY}>
      <div className="space-y-4">
        {/* **何枚を動かすのかだけ言う。** カードの絵を並べると、
            選んだ数だけ画像を読みに行くことになる（50枚選べば50件）。
            ここで要るのは「取り違えていないか」の確認で、それは数で足りる */}
        <p className="text-sm text-muted-foreground">
          選んだ <span className="font-medium text-foreground">{selected.length}</span> 枚を
        </p>

        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <ModeTab active={mode === 'new'} onClick={() => setMode('new')}>
            新しく作る
          </ModeTab>
          <ModeTab active={mode === 'existing'} onClick={() => setMode('existing')}>
            いまあるものへ足す
          </ModeTab>
        </div>

        {mode === 'new' ? (
          <>
            {/* ボックスは種別がひとつしかない。選ばせる意味が無いので出さない */}
            {!isBoxFamily && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">どの形にしますか</p>
                <div className="space-y-1">
                  {choices.map((type) => {
                    const ready = IMPLEMENTED_VIEW_TYPES.has(type)
                    return (
                      <Choice
                        key={type}
                        active={kind === type}
                        disabled={!ready}
                        icon={<LayoutGrid size={15} />}
                        label={VIEW_TYPE_LABELS[type] ?? type}
                        hint={ready ? VIEW_TYPE_DESCRIPTIONS[type] : '準備中です'}
                        onClick={() => setKind(type)}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="bulk-use-name" className="block text-xs text-muted-foreground">
                名前
              </label>
              <Input
                id="bulk-use-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={defaultBulkName(kind, selected.map((i) => i.title))}
                disabled={busy}
              />
              {/* 空欄でも作れる、と先に言う。名前を考える手間で止まらないように */}
              <p className="text-xs text-muted-foreground">
                空欄のままなら「{defaultBulkName(kind, selected.map((i) => i.title))}」で作ります。あとから変えられます。
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">どれに足しますか</p>
            {targets === null ? (
              <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Spinner size={13} /> 読み込んでいます…
              </p>
            ) : targets.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                足せるものがまだありません。「新しく作る」から作れます。
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {targets.map((target) => (
                  <Choice
                    key={`${target.isBox ? 'box' : 'view'}-${target.id}`}
                    active={targetId === target.id}
                    icon={target.isBox ? <BoxIcon size={15} /> : <LayoutGrid size={15} />}
                    label={target.name}
                    hint={target.isBox ? 'ボックス' : (VIEW_TYPE_LABELS[target.kind] ?? target.kind)}
                    onClick={() => setTargetId(target.id)}
                  />
                ))}
              </div>
            )}
            {/* 二重に入らないことを先に言う。選び直しても増えない、と分かれば押しやすい */}
            <p className="text-xs text-muted-foreground">
              すでに入っているカードは、そのままにします。
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {mode === 'new' ? (
            <Button size="sm" onClick={create} disabled={busy || selected.length === 0}>
              {busy ? <Spinner size={13} /> : <Plus size={13} />}
              {selected.length} 枚で作る
            </Button>
          ) : (
            <Button size="sm" onClick={addToExisting} disabled={busy || !targetId || selected.length === 0}>
              {busy ? <Spinner size={13} /> : <Plus size={13} />}
              {selected.length} 枚を足す
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            やめる
          </Button>
        </div>

        {/* スペース配置だけは、先にスペースを選ばないと置けない */}
        {!isBoxFamily && (
          <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
            スペースに配置したいときは、スペースを開いてから置きます。
          </p>
        )}
      </div>
    </PanelSlotContent>
  )
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function Choice({
  active,
  disabled = false,
  icon,
  label,
  hint,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  icon: React.ReactNode
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'border-transparent' : 'border-border hover:bg-muted'
      }`}
      style={active ? { backgroundColor: 'color-mix(in srgb, var(--palace) 12%, transparent)' } : undefined}
    >
      <span className="mt-0.5 shrink-0" style={{ color: 'var(--palace)' }}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  )
}
