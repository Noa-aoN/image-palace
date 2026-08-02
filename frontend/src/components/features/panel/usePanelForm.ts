'use client'

import { useRightPanelStore } from '@/stores/rightPanel'

/**
 * 作成フォームなどを右パネルで開くための小さな取り回し。
 *
 * これまで各ページは `creating` のようなローカル状態でその場に展開していた。
 * パネルへ移すと開閉の主体がパネル側へ移るため、状態もパネルのストアを見るようにする。
 * ローカル状態を残すと「パネルを閉じたのにページはまだ開いているつもり」の食い違いが起きる。
 *
 * 使い方:
 *   const form = usePanelForm('view-create', 'キャンバスを作成')
 *   <Button onClick={form.open}>新規作成</Button>
 *   <PanelSlotContent sectionKey="view-create">…{form.close}…</PanelSlotContent>
 */
export function usePanelForm(key: string, title: string) {
  const openSection = useRightPanelStore((s) => s.openSection)
  const close = useRightPanelStore((s) => s.close)
  const mode = useRightPanelStore((s) => s.mode)
  const section = useRightPanelStore((s) => s.section)

  return {
    /** このフォームがパネルで開いているか */
    isOpen: mode === 'section' && section?.key === key,
    open: () => openSection({ key, title }),
    close,
  }
}
