'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { useRightPanelStore } from '@/stores/rightPanel'
import { CreateItemForm } from './CreateItemForm'

/**
 * カード作成を右パネルで行うための一式。
 *
 * これまでは専用ページ（/items/new）へ遷移していたが、作成中に一覧が見えなくなり、
 * 作り終えて戻るまで文脈が途切れていた。パネルなら一覧を見ながら続けて作れる。
 *
 * 置き場所を 1 か所にまとめてあるのは、作成の入口が複数ページにあるため。
 * 呼び出し側は CardCreateButton を置き、同じページで CardCreatePanelSlot を描くだけでよい。
 */
const SECTION_KEY = 'card-create'

/** パネルのカード作成を開く。入口が増えてもここを呼べばよい */
export function useOpenCardCreate() {
  const openSection = useRightPanelStore((s) => s.openSection)
  // ワードリストを指定すると、その単語を入れた状態で開く
  return (wordlistId?: string) =>
    openSection({
      key: SECTION_KEY,
      title: 'カードを作成',
      href: wordlistId ? `/items/new?wordlist=${wordlistId}` : '/items/new',
      params: wordlistId ? { wordlist: wordlistId } : undefined,
    })
}

/** 作成の入口。見た目は呼び出し側で変えられるよう variant / size を通す */
export function CardCreateButton({
  variant = 'outline',
  size = 'sm',
  label = '作成',
}: {
  variant?: 'default' | 'outline'
  size?: 'sm' | 'default'
  label?: string
}) {
  const open = useOpenCardCreate()
  return (
    <Button variant={variant} size={size} onClick={() => open()} className="flex items-center gap-1">
      <Plus size={14} />
      {label}
    </Button>
  )
}

/**
 * パネルへ差し込む中身。作成フォームはページ用のものをそのまま使う。
 * パネルは幅が狭いので、フォーム側の横並びが潰れないよう縦に流す。
 */
export function CardCreatePanelSlot() {
  const section = useRightPanelStore((s) => s.section)
  const wordlistId = section?.key === SECTION_KEY ? section.params?.wordlist : undefined

  return (
    <PanelSlotContent sectionKey={SECTION_KEY}>
      <div className="[&_.grid]:grid-cols-1">
        {/* 開き直すたびに初期値を取り込ませたいので、指定が変わったら作り直す */}
        <CreateItemForm key={wordlistId ?? 'blank'} inPanel wordlistId={wordlistId} />
      </div>
    </PanelSlotContent>
  )
}
