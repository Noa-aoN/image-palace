'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import {
  MAX_VISIBLE_FIELDS,
  buildLayoutRows,
  moveRow,
  toggleVisible,
  visibleCount,
  type LayoutCandidate,
  type LayoutRow,
  isFixedPosition,
} from '@/lib/card-list-layout'

// 組み込みの候補。利用者が作った項目より前に並べる（どのカードにもあるため）
const BUILTIN_CANDIDATES: LayoutCandidate[] = [
  { key: 'title', label: '見出し語', builtin: true },
  // 見出し語の右に出る一文字。**下へ積まない**ので、並べ替えも数の勘定もしない
  { key: 'item_type', label: '種別の印', builtin: true },
  { key: 'image', label: 'イメージ', builtin: true },
  { key: 'meaning', label: '意味・説明', builtin: true },
]
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { getPropertyDefinitions } from '@/lib/api/properties'
import { getSettings, updateSettings } from '@/lib/api/settings'
import {
  CARD_COLUMN_CHOICES,
  CARD_ROW_CHOICES,
  MAX_CARDS_PER_PAGE,
  availableRowChoices,
  cardsPerPage,
  type CardDisplay,
} from '@/hooks/useCardDisplay'

const PANEL_KEY = 'items-display'

/**
 * カード一覧の見え方の設定。
 *
 * 一覧に置くのはボタン1つだけで、中身は右パネルで開く。
 * 作り直しパネルと同じ作りにして、置き場所が違っても迷わないようにする。
 * 棚そのものを見る面積を、設定のために削らないためでもある。
 *
 * 値は端末ごとに覚える（useCardDisplay）。保存ボタンは置かない。
 * 見え方は押した瞬間に結果が見えるので、確定させる操作を挟む意味がない。
 *
 * 見出し語だけは例外で、アカウントの設定として保存する。どの項目を名前として出すかは
 * サーバー側で解決しないと、一覧の payload に全項目を積むことになって重いため。
 */
export function CardDisplayPanel({
  display,
  onChange,
  onLayoutSaved,
  showRows = true,
}: {
  display: CardDisplay
  onChange: (patch: Partial<CardDisplay>) => void
  /**
   * 表示項目を保存し終えたとき。
   * 出す項目・並び・絵の有無はサーバーが解決して一覧の payload に載るので、
   * **保存しただけでは棚は変わらない。** 取り直しの合図をここで出す。
   */
  onLayoutSaved?: () => void
  /**
   * 1ページの行数を出すか。
   *
   * ページ送りのある一覧でだけ意味を持つ。デッキは1枚の面に全部並ぶので、
   * 出すと**押しても何も起きない設定**が並ぶことになる。
   */
  showRows?: boolean
}) {
  const panel = usePanelForm(PANEL_KEY, '表示')
  const rowChoices = availableRowChoices(display.columns)
  const perPage = cardsPerPage(display)
  const layout = useCardListLayout(panel.isOpen, onLayoutSaved)
  // 掴んで動かしている行。HTML5 の drag は「どこから」を持たないので自分で覚える
  const [dragging, setDragging] = useState<number | null>(null)
  // つまみを押している行だけが動かせる
  const [grabbed, setGrabbed] = useState<number | null>(null)

  return (
    <>
      <Button variant="outline" size="sm" onClick={panel.open} aria-expanded={panel.isOpen}>
        <LayoutGrid size={14} className="mr-1" />
        表示
      </Button>

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <div className="space-y-5">
          {/* 説明は「選ぶと何が変わるか」だけに絞る。仕組みの話（枚数でなく行数で持つ等）は
              下の「◯列 × ◯行 ＝ ◯枚」を見れば分かるので、文にはしない */}
          <p className="text-xs text-muted-foreground">この端末だけの設定です。</p>

          <div className="space-y-2">
            <Label>画像の収め方</Label>
            <div className="flex flex-wrap gap-2">
              <Chip active={display.fit === 'natural'} onClick={() => onChange({ fit: 'natural' })}>
                実寸
              </Chip>
              <Chip active={display.fit === 'uniform'} onClick={() => onChange({ fit: 'uniform' })}>
                そろえる
              </Chip>
            </div>
            <p className="text-xs text-muted-foreground">
              {display.fit === 'uniform'
                ? '正方形にそろえ、余白を付けて画像全体を収めます。棚が波打ちません。'
                : 'カードの縦横比のまま、画像は枠いっぱいに入ります。'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>列数</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_COLUMN_CHOICES.map((count) => (
                <Chip key={count} active={display.columns === count} onClick={() => onChange({ columns: count })}>
                  {count}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              広い画面での列数です。狭い画面では自動で減り、多いほど単語名は省略されます。
            </p>
          </div>

          {/* ページ送りのある一覧でだけ意味を持つ。デッキでは出さない */}
          {showRows && (
            <>
              <div className="space-y-2">
                <Label>1ページの行数</Label>
                <div className="flex flex-wrap gap-2">
                  {rowChoices.map((count) => (
                    <Chip key={count} active={display.rows === count} onClick={() => onChange({ rows: count })}>
                      {count}
                    </Chip>
                  ))}
                </div>
                {rowChoices.length < CARD_ROW_CHOICES.length && (
                  <p className="text-xs text-muted-foreground">1ページ {MAX_CARDS_PER_PAGE} 枚までです。</p>
                )}
              </div>
              <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <strong className="text-foreground">
                  {display.columns} 列 × {display.rows} 行
                </strong>{' '}
                ＝ 1ページ <strong className="text-foreground">{perPage} 枚</strong>
              </p>
            </>
          )}

          {/* 列数・行数と、出す項目は別の話。線で区切って、混ざらないようにする */}
          <hr className="border-border" />

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label>表示項目</Label>
              <span className="text-xs text-muted-foreground">
                出す {layout.shown} / {MAX_VISIBLE_FIELDS}
                {layout.saving && ' 保存中…'}
              </span>
            </div>

            <ul className="space-y-1">
              {layout.rows.map((row, index) => (
                <li
                  key={row.key}
                  // 掴めるのはつまみを押している間だけ（行そのものを掴めると文字を選べない）
                  draggable={grabbed === index}
                  onDragStart={() => setDragging(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragging !== null) layout.move(dragging, index)
                    setDragging(null)
                    setGrabbed(null)
                  }}
                  onDragEnd={() => {
                    setDragging(null)
                    setGrabbed(null)
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                    row.visible ? 'border-border' : 'border-dashed border-border/60'
                  } ${dragging === index ? 'opacity-50' : ''}`}
                >
                  <GripVertical
                    size={14}
                    onPointerDown={() => setGrabbed(index)}
                    onPointerUp={() => setGrabbed(null)}
                    className="shrink-0 cursor-grab touch-none text-muted-foreground"
                    aria-hidden
                  />

                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.visible}
                      onChange={() => layout.toggle(row.key)}
                      className="shrink-0"
                    />
                    <span className={`truncate ${row.visible ? '' : 'text-muted-foreground'}`}>
                      {layout.labelOf(row.key)}
                    </span>
                  </label>

                  {/* 置き場所が決まっている項目には、動かす道を出さない。
                      押せる釦を出しておいて何も起きないと、効かないのか壊れたのかが分からない */}
                  {isFixedPosition(row.key) ? (
                    <span className="shrink-0 text-3xs text-muted-foreground">見出し語の右</span>
                  ) : (
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => layout.move(index, index - 1)}
                      disabled={index === 0}
                      aria-label={`${layout.labelOf(row.key)}を上へ`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => layout.move(index, index + 1)}
                      disabled={index === layout.rows.length - 1}
                      aria-label={`${layout.labelOf(row.key)}を下へ`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  )}
                </li>
              ))}
            </ul>

            {layout.notice && <p className="text-xs text-destructive">{layout.notice}</p>}
            <p className="text-xs text-muted-foreground">
              上から順に出ます。値の無い項目は「-」として出るので、入れ忘れに気づけます。
              読み方や別名などの項目を作ると、ここに増えます。
            </p>
          </div>

        </div>
      </PanelSlotContent>
    </>
  )
}

/**
 * 名前として出す項目の選択。
 *
 * 選択肢は利用者が作った項目から作る。同じ識別名が種別をまたいで存在しうるので
 * 識別名で畳む（「読み方」を種別ごとに作っていても、選ぶのは1つでよい）。
 * 文字として出せる型（text / list）だけを候補にする。日付や URL を名前に出しても読めない。
 *
 * パネルを開いたときに読む。一覧を出すたびに毎回引く必要はない。
 */
function useCardListLayout(isOpen: boolean, onSaved?: () => void) {
  const [rows, setRows] = useState<LayoutRow[]>([])
  const [candidates, setCandidates] = useState<LayoutCandidate[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || loaded) return
    let cancelled = false
    Promise.all([getSettings(), getPropertyDefinitions()])
      .then(([settings, defs]) => {
        if (cancelled) return
        // 候補は「組み込み」＋「利用者が作った項目」。
        // 同じ識別名が種別をまたいで存在しうるので畳む（読み方を種別ごとに作っていても1つ）
        const userDefs = Array.from(
          defs
            .filter((d) => d.value_type === 'text' || d.value_type === 'list')
            .reduce((acc, d) => {
              if (!acc.has(d.key)) acc.set(d.key, { key: d.key, label: d.label, builtin: false })
              return acc
            }, new Map<string, LayoutCandidate>())
            .values()
        )
        const all = [...BUILTIN_CANDIDATES, ...userDefs]
        setCandidates(all)
        setRows(buildLayoutRows(settings.card_list_layout ?? [], all))
        setLoaded(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isOpen, loaded])

  const save = async (next: LayoutRow[]) => {
    const previous = rows
    setRows(next)
    setSaving(true)
    try {
      const saved = await updateSettings({ card_list_layout: next })
      setRows(buildLayoutRows(saved.card_list_layout ?? next, candidates))
      onSaved?.()
    } catch {
      setRows(previous) // 失敗したら元に戻す
      setNotice('保存できませんでした')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (key: string) => {
    const { rows: next, rejected } = toggleVisible(rows, key)
    if (rejected) {
      setNotice(`一覧に出せるのは${MAX_VISIBLE_FIELDS}件までです。どれかを隠してから選んでください。`)
      return
    }
    setNotice(null)
    save(next)
  }

  const move = (from: number, to: number) => {
    const next = moveRow(rows, from, to)
    if (next === rows) return
    setNotice(null)
    save(next)
  }

  const labelOf = (key: string) => candidates.find((c) => c.key === key)?.label ?? key

  return { rows, labelOf, toggle, move, saving, notice, shown: visibleCount(rows) }
}

function Chip({
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
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
      }`}
      style={active ? { backgroundColor: 'var(--palace)' } : undefined}
    >
      {children}
    </button>
  )
}
