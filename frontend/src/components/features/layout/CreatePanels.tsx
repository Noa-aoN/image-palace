'use client'

import { useRouter } from 'next/navigation'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { useRightPanelStore } from '@/stores/rightPanel'
import { useOpenCardCreate } from '@/components/features/items/CardCreatePanel'
import { CreateViewForm } from '@/components/features/views/CreateViewForm'
import { CreateSpaceForm } from '@/components/features/spaces/CreateSpaceForm'
import { CreateBoxForm } from '@/components/features/boxes/CreateBoxForm'

/**
 * 「作る」をどこからでも右パネルで開くための一式。
 *
 * これまでヘッダーの「＋」は作成ページへ**移動**していた。移動すると、
 * いま見ていたものが消える。作りたいのは目の前のものの続きなので、
 * 見えたまま作れるほうがよい（カード作成は既にそうなっていた）。
 *
 * パネルの中身はページ用のフォームをそのまま使う。作成の入口が
 * ヘッダー・サイドバー・各ページと複数あるので、**置き場所はここ1か所**にまとめる。
 *
 * マテリアルだけはページのまま。あれは1つのフォームではなく、
 * 何を作るかを選ぶ入口（ワードリスト／ピクチャーリスト…）なので、
 * パネルに入れると選択肢が窮屈になる。
 */
export const CREATE_VIEW_KEY = 'create-view'
export const CREATE_SPACE_KEY = 'create-space'
export const CREATE_BOX_KEY = 'create-box'

export type CreateKind = 'item' | 'view' | 'space' | 'box' | 'material'

export const CREATE_ITEMS: { kind: CreateKind; label: string; href: string }[] = [
  { kind: 'item', label: 'カードを作成', href: '/items/new' },
  { kind: 'view', label: 'キャンバスを作成', href: '/views/new' },
  { kind: 'space', label: 'スペースを作成', href: '/spaces/new' },
  { kind: 'box', label: 'ボックスを作成', href: '/boxes/new' },
  { kind: 'material', label: 'マテリアルを作成', href: '/materials/new' },
]

/** 種別を渡すと、パネルを開く（マテリアルだけはページへ移動する） */
export function useOpenCreate() {
  const openSection = useRightPanelStore((s) => s.openSection)
  const openCard = useOpenCardCreate()
  const router = useRouter()

  return (kind: CreateKind) => {
    if (kind === 'item') return openCard()
    if (kind === 'view') return openSection({ key: CREATE_VIEW_KEY, title: 'キャンバスを作成', href: '/views/new' })
    if (kind === 'space') return openSection({ key: CREATE_SPACE_KEY, title: 'スペースを作成', href: '/spaces/new' })
    if (kind === 'box') return openSection({ key: CREATE_BOX_KEY, title: 'ボックスを作成', href: '/boxes/new' })
    router.push('/materials/new')
  }
}

/**
 * パネルへ差し込む中身。アプリのレイアウトに1度だけ置く。
 *
 * 作り終えたらパネルを閉じて、作ったものへ移る。**閉じずに移ると**、
 * 移った先でパネルが開いたままになり、作ったものが半分隠れる。
 */
export function CreatePanelSlots() {
  const closePanel = useRightPanelStore((s) => s.close)
  const router = useRouter()

  const go = (href: string) => {
    closePanel()
    router.push(href)
  }

  return (
    <>
      <PanelSlotContent sectionKey={CREATE_VIEW_KEY}>
        <CreateViewForm onCreated={(view) => go(`/views/${view.id}`)} />
      </PanelSlotContent>
      <PanelSlotContent sectionKey={CREATE_SPACE_KEY}>
        <CreateSpaceForm onCreated={(space) => go(`/spaces/${space.id}`)} />
      </PanelSlotContent>
      <PanelSlotContent sectionKey={CREATE_BOX_KEY}>
        <CreateBoxForm onCreated={(box) => go(`/boxes/${box.id}`)} />
      </PanelSlotContent>
    </>
  )
}
