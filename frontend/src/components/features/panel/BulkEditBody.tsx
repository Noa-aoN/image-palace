'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRightPanelStore } from '@/stores/rightPanel'
import { EdgeStyleControls, NumberField } from './EdgeStyleControls'

// カードの既定サイズ（CardNode と一致）。サイズ揃えは幅から縦横比を維持して算出する。
const CARD_DEFAULT_W = 144
const CARD_DEFAULT_H = 172

// 右パネル: 複数選択の一括編集（接続線スタイル一括／カードのサイズ揃え／まとめて削除）。
export function BulkEditBody() {
  const itemIds = useRightPanelStore((s) => s.bulkItemIds)
  const edgeIds = useRightPanelStore((s) => s.bulkEdgeIds)
  const requestBulkStylePatch = useRightPanelStore((s) => s.requestBulkStylePatch)
  const requestBulkResize = useRightPanelStore((s) => s.requestBulkResize)
  const requestBulkRemove = useRightPanelStore((s) => s.requestBulkRemove)
  const close = useRightPanelStore((s) => s.close)

  const [width, setWidth] = useState(CARD_DEFAULT_W)
  const [confirming, setConfirming] = useState(false)

  const cardCount = itemIds.length
  const edgeCount = edgeIds.length

  const applyResize = () => {
    const height = Math.round((width * CARD_DEFAULT_H) / CARD_DEFAULT_W)
    requestBulkResize(itemIds, width, height)
  }
  const del = () => {
    requestBulkRemove(itemIds, edgeIds)
    close()
  }

  return (
    <div className="space-y-6">
      {cardCount > 1 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground">カード（{cardCount}件）のサイズをそろえる</h3>
          <div className="flex items-end gap-2">
            <NumberField label="幅" value={width} min={64} max={480} onChange={setWidth} />
            <Button variant="outline" size="sm" onClick={applyResize}>
              そろえる
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">縦横比を保ったまま、選択したカードを同じ幅にそろえます。</p>
        </section>
      )}

      {edgeCount > 0 && (
        <section className={cardCount > 1 ? 'space-y-3 border-t border-border pt-4' : 'space-y-3'}>
          <h3 className="text-xs font-semibold text-muted-foreground">接続線（{edgeCount}件）に一括反映</h3>
          {/* value 省略＝現在値の active 表示なし。選択で全接続線へ同じ値を適用する */}
          <EdgeStyleControls value={undefined} onChange={(partial) => requestBulkStylePatch(edgeIds, partial)} />
        </section>
      )}

      <section className="space-y-2 border-t border-border pt-4">
        {confirming ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              選択中の{cardCount > 0 ? `カード${cardCount}件` : ''}
              {cardCount > 0 && edgeCount > 0 ? '・' : ''}
              {edgeCount > 0 ? `接続線${edgeCount}件` : ''}
              を削除します。よろしいですか？
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={del}
                className="flex-1 text-destructive hover:text-destructive"
              >
                削除する
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)} className="flex-1">
                キャンセル
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
            className="flex w-full items-center justify-center gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 size={14} />
            選択をまとめて削除
          </Button>
        )}
      </section>
    </div>
  )
}
