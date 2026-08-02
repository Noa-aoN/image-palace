'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { useRightPanelStore } from '@/stores/rightPanel'
import { CreateViewForm } from '@/components/features/views/CreateViewForm'
import { CreateSpaceForm } from '@/components/features/spaces/CreateSpaceForm'
import { CreateBoxForm } from '@/components/features/boxes/CreateBoxForm'
import { CreateWordlistFlow } from '@/components/features/wordlists/CreateWordlistFlow'
import type { View } from '@/types/view'
import type { Space } from '@/types/space'
import type { Box } from '@/types/box'
import type { Wordlist } from '@/types/wordlist'

/**
 * ライブラリの棚ごとの作成操作。
 *
 * 棚は種別ごとに分かれているので、作成もその場（棚の見出し横）から始められるようにする。
 * 一覧ページまで移動してから作る、という往復をなくすのが狙い。
 * 中身は各一覧ページと同じフォームを使い回すため、作成後の挙動もページ側と揃う。
 */
export type LibraryCreateKind = 'deck' | 'freeboard' | 'space_map' | 'road' | 'room' | 'box' | 'wordlist'

const TITLES: Record<LibraryCreateKind, string> = {
  deck: 'デッキを作成',
  freeboard: 'フリーボードを作成',
  space_map: 'スペース配置を作成',
  road: 'ロードを作成',
  room: 'ルームを作成',
  box: 'ボックスを作成',
  wordlist: 'ワードリストを作成',
}

const sectionKey = (kind: LibraryCreateKind) => `library-create-${kind}`

/** 棚の見出し横に置く作成ボタン。カードの棚のものと見た目を揃える */
export function LibraryCreateButton({ kind }: { kind: LibraryCreateKind }) {
  const openSection = useRightPanelStore((s) => s.openSection)
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={TITLES[kind]}
      onClick={() => openSection({ key: sectionKey(kind), title: TITLES[kind] })}
      className="flex items-center gap-1"
    >
      <Plus size={14} />
      作成
    </Button>
  )
}

/**
 * 棚ごとの作成フォームをまとめてパネルへ差し込む。
 * 開いているセクションの分だけが描かれるので、ライブラリに 1 つ置けばよい。
 * 作成できたものは呼び出し側の一覧へ即座に足す（再取得を待たせない）。
 */
export function LibraryCreatePanels({
  onViewCreated,
  onSpaceCreated,
  onBoxCreated,
  onWordlistCreated,
}: {
  onViewCreated: (view: View) => void
  onSpaceCreated: (space: Space) => void
  onBoxCreated: (box: Box) => void
  onWordlistCreated: (wordlist: Wordlist) => void
}) {
  const close = useRightPanelStore((s) => s.close)

  return (
    <>
      {(['deck', 'freeboard', 'space_map'] as const).map((kind) => (
        <PanelSlotContent key={kind} sectionKey={sectionKey(kind)}>
          <CreateViewForm
            defaultType={kind}
            onCreated={(created) => {
              onViewCreated(created)
              close()
            }}
            onCancel={close}
          />
        </PanelSlotContent>
      ))}

      {(['road', 'room'] as const).map((kind) => (
        <PanelSlotContent key={kind} sectionKey={sectionKey(kind)}>
          <CreateSpaceForm
            defaultType={kind}
            onCreated={(created) => {
              onSpaceCreated(created)
              close()
            }}
            onCancel={close}
          />
        </PanelSlotContent>
      ))}

      <PanelSlotContent sectionKey={sectionKey('wordlist')}>
        <CreateWordlistFlow
          onCreated={(created) => {
            onWordlistCreated(created)
            close()
          }}
        />
      </PanelSlotContent>

      <PanelSlotContent sectionKey={sectionKey('box')}>
        <CreateBoxForm
          onCreated={(created) => {
            onBoxCreated(created)
            close()
          }}
          onCancel={close}
        />
      </PanelSlotContent>
    </>
  )
}
