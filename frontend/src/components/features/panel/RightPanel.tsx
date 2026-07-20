'use client'

import { useCallback, useEffect, useRef, type PointerEvent } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useRightPanelStore } from '@/stores/rightPanel'
import { useUiStore } from '@/stores/ui'
import { ItemDetailBody } from '@/components/features/items/ItemDetailBody'
import { BoardCardsList } from './BoardCardsList'
import { AddCardsBody } from './AddCardsBody'
import { ObjectList } from './ObjectList'
import { EdgePropertiesBody } from './EdgePropertiesBody'
import { BoardSettingsBody } from './BoardSettingsBody'
import { PanelShell } from './PanelShell'

const MIN_W = 300
const MAX_W = 560

// アプリ右側の統一インスペクタ。mode に応じて中身を出し分ける。
// closed のときは何も描画せず、レイアウトに影響しない。
export function RightPanel() {
  const mode = useRightPanelStore((s) => s.mode)
  const itemId = useRightPanelStore((s) => s.itemId)
  const viewId = useRightPanelStore((s) => s.viewId)
  const edge = useRightPanelStore((s) => s.edge)
  const close = useRightPanelStore((s) => s.close)
  const openBoardCards = useRightPanelStore((s) => s.openBoardCards)
  const openBoardObjects = useRightPanelStore((s) => s.openBoardObjects)
  const width = useUiStore((s) => s.rightPanelWidth)
  const setWidth = useUiStore((s) => s.setRightPanelWidth)
  const pathname = usePathname()

  // 別画面へ遷移したら閉じる（選択状態を持ち越さない）
  useEffect(() => {
    close()
  }, [pathname, close])

  // 左端ドラッグで幅を調整（パネルは右端固定なので width = 画面右端 - ポインタ x）
  const dragging = useRef(false)
  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])
  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      const next = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX))
      setWidth(next)
    },
    [setWidth]
  )
  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  if (mode === 'closed') return null

  // 詳細/編集モードは戻るラベルで文脈が分かるためタイトルは省略する。
  const title =
    mode === 'board-cards'
      ? '配置カード一覧'
      : mode === 'add-cards'
        ? 'カードを配置'
        : mode === 'board-objects'
          ? 'オブジェクト一覧'
          : mode === 'board-settings'
            ? 'ボード設定'
            : undefined

  // 一覧 > 詳細 の親子関係。詳細/編集からは対応する一覧へ戻す。
  const onBack =
    mode === 'card' && viewId
      ? () => openBoardCards(viewId)
      : mode === 'edge' && viewId
        ? () => openBoardObjects(viewId)
        : undefined
  const backLabel = mode === 'card' ? '配置カード一覧' : mode === 'edge' ? 'オブジェクト一覧' : undefined

  return (
    <aside
      // サイドバー（左）の対となる構造パネル。ivory 背景＋palace ボーダーで対称に、影は付けない。
      // モバイルでも表示し、画面外にはみ出さないよう最大 90vw に収める（狭幅ではほぼ全幅）。
      className="absolute right-0 top-0 bottom-0 z-30 max-w-[90vw]"
      style={{ width, backgroundColor: 'var(--ivory)', borderLeft: '1px solid var(--palace)' }}
    >
      {/* 幅調整ハンドル（左端） */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize"
        aria-hidden="true"
      />
      <PanelShell
        title={title}
        onBack={onBack}
        backLabel={backLabel}
        onClose={close}
        headerAction={
          mode === 'card' && itemId ? (
            <Link
              href={viewId ? `/items/${itemId}?board=${viewId}` : `/items/${itemId}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="詳細ページを別タブで開く"
              className="rounded-md p-1 transition-colors hover:bg-black/5 hover:text-foreground"
            >
              <ExternalLink size={15} />
            </Link>
          ) : undefined
        }
      >
        {mode === 'card' && itemId && <ItemDetailBody itemId={itemId} />}
        {mode === 'board-cards' && viewId && <BoardCardsList viewId={viewId} />}
        {mode === 'add-cards' && viewId && <AddCardsBody viewId={viewId} />}
        {mode === 'board-objects' && viewId && <ObjectList viewId={viewId} />}
        {mode === 'board-settings' && viewId && <BoardSettingsBody />}
        {mode === 'edge' && viewId && edge && <EdgePropertiesBody key={edge.id} viewId={viewId} />}
      </PanelShell>
    </aside>
  )
}
