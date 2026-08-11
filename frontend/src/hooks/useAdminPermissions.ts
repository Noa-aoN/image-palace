'use client'

import { useAdminStore } from '@/stores/admin'
import { canOperate, canAdminister } from '@/lib/admin-roles'

/**
 * いまの人が、運営の書き込み操作をできるか。
 *
 * 各パネルが自分で store から借りる。ページから prop で渡さないのは、
 * 経由するページが10枚あり、渡し忘れたところだけ守りが緩んで見えるため
 * （見た目の話とはいえ、押せない釦が出ているのは同じくらい分かりにくい）。
 *
 * 判定そのものは `@/lib/admin-roles` に置いてある（純粋な関数・テスト済み）。
 * ここはストアに繋ぐだけ。
 */
export function useCanOperate(): boolean {
  return canOperate(useAdminStore((s) => s.session))
}

/** 権限・お金・セキュリティ（プラン・収支の値・役割）を触れるか */
export function useCanAdminister(): boolean {
  return canAdminister(useAdminStore((s) => s.session))
}
